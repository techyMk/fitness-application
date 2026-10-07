/* ============================================================================
   Backup & restore.

   Login is not mandatory (spec §42), so "your account" is a device identity: a
   random `deviceId` minted on first run, carried inside the backup file. A
   restore on a new device adopts the old identity, which is what makes the
   journey continuous without an auth system.

   Photos are included as base64 inside the backup file. That makes files larger
   but means one file is genuinely everything — a backup that silently drops the
   day-one photo is not a backup.

   Note: spec §43 excludes CSV and PDF *export*. This is not that — it is the
   app's own restore format, which §42 requires. It is not a spreadsheet and is
   not offered as a data-portability feature.
   ========================================================================= */

import type { AppData } from './types'
import { allBlobKeys, getBlob, putBlob } from './db'
import { DATA_VERSION, emptyData } from './store'

const MAGIC = 'forge-backup'

interface BackupFile {
  magic: typeof MAGIC
  version: number
  createdAt: string
  deviceId: string
  data: AppData
  /** blobKey -> data URL */
  photos: Record<string, string>
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

async function dataUrlToBlob(url: string): Promise<Blob> {
  const res = await fetch(url)
  return res.blob()
}

export async function createBackup(data: AppData): Promise<Blob> {
  const photos: Record<string, string> = {}
  const keys = await allBlobKeys()
  for (const key of keys) {
    const blob = await getBlob(String(key))
    if (blob) photos[String(key)] = await blobToDataUrl(blob)
  }

  const file: BackupFile = {
    magic: MAGIC,
    version: DATA_VERSION,
    createdAt: new Date().toISOString(),
    deviceId: data.deviceId,
    data,
    photos,
  }
  return new Blob([JSON.stringify(file)], { type: 'application/json' })
}

export function backupFilename(): string {
  const d = new Date()
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
  return `forge-backup-${stamp}.json`
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.append(a)
  a.click()
  a.remove()
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export class RestoreError extends Error {}

export async function readBackup(file: File): Promise<AppData> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    throw new RestoreError('That file is not readable. Pick a Forge backup file (.json).')
  }

  const f = parsed as Partial<BackupFile>
  if (f?.magic !== MAGIC || !f.data) {
    throw new RestoreError('That is not a Forge backup. Pick the file Forge saved for you.')
  }
  if ((f.version ?? 0) > DATA_VERSION) {
    throw new RestoreError(
      'This backup came from a newer version of Forge. Update the app, then restore.',
    )
  }

  // Photos first — if a blob write fails we stop before replacing the log.
  if (f.photos) {
    for (const [key, url] of Object.entries(f.photos)) {
      try {
        await putBlob(key, await dataUrlToBlob(url))
      } catch {
        // A single unreadable photo must not block the whole restore; the photo
        // row will show its missing-image state.
      }
    }
  }

  return { ...emptyData(), ...f.data, deviceId: f.deviceId || f.data.deviceId }
}

export function fmtBackupAge(at: number | null): string | null {
  if (!at) return null
  const mins = Math.round((Date.now() - at) / 60_000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins} minutes ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}
