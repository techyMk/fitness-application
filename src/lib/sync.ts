/* ============================================================================
   Sync orchestration.

   One cycle:
     1. pull  the server's document
     2. merge it with the local one (lib/merge.ts — commutative, lossless)
     3. push  the result if it differs from what the server holds
     4. on 409, re-merge against the newer server copy and retry

   Retries are bounded. An unbounded "merge and retry" loop against a busy
   account is a livelock, and the merge is idempotent so a later cycle will
   converge anyway — there is nothing to gain from spinning here.

   Photos travel separately. They are large, immutable once written, and
   addressed by a key that already lives in the document, so they sync as a
   simple set difference rather than through the merge.
   ========================================================================= */

import type { AppData } from './types'
import { mergeDocs } from './merge'
import * as api from './api'
import { getBlob, putBlob } from './db'

const MAX_ATTEMPTS = 4

export type SyncPhase = 'idle' | 'syncing' | 'photos' | 'ok' | 'offline' | 'error'

export interface SyncResult {
  phase: SyncPhase
  /** the document to commit locally — null when nothing changed */
  doc: AppData | null
  rev: number
  message?: string
  photosUp: number
  photosDown: number
}

/**
 * Content fingerprint used to decide "is a push worth making".
 *
 * Deliberately excludes the fields that change as a *result* of syncing, so a
 * successful sync does not itself look like a change and trigger another one.
 * This is why merge.ts goes to the trouble of sorting its output — without
 * deterministic ordering this comparison would never settle.
 */
function fingerprint(d: AppData): string {
  const { rev, syncedAt, deviceId, records, nonGymRecords, ...rest } = d
  void rev
  void syncedAt
  void deviceId
  void records
  void nonGymRecords
  return JSON.stringify(rest)
}

export async function syncNow(local: AppData): Promise<SyncResult> {
  let working = local
  let rev = local.rev ?? 0
  let pushed = false

  try {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const remote = await api.pull()

      if (remote.doc) {
        working = mergeDocs(working, remote.doc)
        // The merge's output is what both sides should converge on, so the
        // base revision for the push is whatever the server just reported.
        rev = remote.rev
        // Nothing of ours to contribute and nothing new to take: done.
        if (fingerprint(working) === fingerprint(remote.doc)) {
          return finish('ok', working, rev, pushed)
        }
      } else {
        rev = 0
      }

      const result = await api.push(rev, working, local.deviceId)
      if (!result.conflict) {
        rev = result.rev
        pushed = true
        return finish('ok', working, rev, pushed)
      }

      // Someone else wrote between our pull and our push. Fold their version in
      // and go round again.
      if (result.doc) working = mergeDocs(working, result.doc)
      rev = result.rev
    }

    // Converged far enough to be safe — the local document now contains
    // everything we saw, it just has not landed yet. The next cycle finishes it.
    return finish('ok', working, rev, pushed, 'Sync will finish on the next pass.')
  } catch (e) {
    if (e instanceof api.ApiError) {
      if (e.status === 401) return fail('error', 'Your session expired. Sign in again.')
      if (e.code === 'NO_DATABASE') return fail('offline', 'Sync is not set up on this server.')
      return fail('error', e.message)
    }
    // fetch() rejects on a dead network, which is an expected state, not a bug.
    return fail('offline', 'No connection. Your log is safe on this device.')
  }

  function finish(
    phase: SyncPhase,
    doc: AppData,
    atRev: number,
    didPush: boolean,
    message?: string,
  ): SyncResult {
    void didPush
    return {
      phase,
      doc: { ...doc, rev: atRev, syncedAt: Date.now() },
      rev: atRev,
      message,
      photosUp: 0,
      photosDown: 0,
    }
  }

  function fail(phase: SyncPhase, message: string): SyncResult {
    return { phase, doc: null, rev, message, photosUp: 0, photosDown: 0 }
  }
}

/* --------------------------------- photos -------------------------------- */

/**
 * Reconcile photo blobs against the server as a set difference.
 *
 * Runs after the document sync so `doc.photos` already lists everything either
 * device knows about. Missing blobs are not an error: a photo row whose blob
 * has not arrived yet renders its "image unavailable" state and fills in on a
 * later pass.
 */
export async function syncPhotos(doc: AppData): Promise<{ up: number; down: number }> {
  let up = 0
  let down = 0

  const remote = await api.listPhotos()
  const remoteKeys = new Set(remote.keys)
  const wanted = doc.photos.map((p) => p.blobKey)

  for (const key of wanted) {
    if (remoteKeys.has(key)) {
      // Server has it; make sure we do too.
      if (!(await getBlob(key))) {
        const blob = await api.downloadPhoto(key)
        if (blob) {
          await putBlob(key, blob)
          down++
        }
      }
      continue
    }

    // Server lacks it — upload if this device holds the bytes.
    const blob = await getBlob(key)
    if (!blob) continue
    try {
      await api.uploadPhoto(key, await blobToDataUrl(blob))
      up++
    } catch (e) {
      // A full quota should stop the loop, not retry 40 more times.
      if (e instanceof api.ApiError && e.code === 'QUOTA') throw e
    }
  }

  // Blobs the server holds for photos no longer in the document are orphans
  // from a deletion that synced before its cleanup did.
  const live = new Set(wanted)
  for (const key of remote.keys) {
    if (!live.has(key)) await api.deletePhotoRemote(key).catch(() => {})
  }

  return { up, down }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

/* ------------------------------ image shrink ------------------------------ */

/**
 * Downscale a camera photo before it is ever stored.
 *
 * A modern phone camera produces 3–6 MB per shot. Ninety days of three angles
 * would be well over a gigabyte — past the device quota, past Neon's free tier,
 * and far past what a progress photo needs. 1280px on the long edge at JPEG
 * q0.82 lands around 120–180 KB and is still more than enough to see a change.
 *
 * Returns the original blob untouched if anything about the decode fails; a
 * slightly-too-large photo is a much better outcome than a lost one.
 */
export async function shrinkImage(
  file: Blob,
  maxEdge = 1280,
  quality = 0.82,
): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size < 400_000) {
      bitmap.close()
      return file
    }

    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return file
    }
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()

    const out = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    )
    return out && out.size < file.size ? out : file
  } catch {
    return file
  }
}
