/* ============================================================================
   Persistence. Two stores in one IndexedDB database:

   - `kv`    one row holding the whole AppData document. The dataset for a single
             person over a few years is small (tens of KB), so a document beats
             a dozen object stores: reads are one hop, writes are atomic, and
             backup/restore is a single JSON blob.
   - `blobs` progress photos, keyed by `blobKey`. These never enter app state —
             screens hold object URLs and revoke them on unmount — which keeps a
             90-day photo set out of the React tree.

   localStorage is used only as a crash-recovery mirror of the document, because
   IndexedDB writes are async and a user can close a PWA mid-write.
   ========================================================================= */

const DB_NAME = 'forge'
const DB_VERSION = 1
const KV = 'kv'
const BLOBS = 'blobs'
const DOC_KEY = 'app-data'
const MIRROR_KEY = 'forge:mirror'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(KV)) db.createObjectStore(KV)
      if (!db.objectStoreNames.contains(BLOBS)) db.createObjectStore(BLOBS)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>) {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode)
        const req = run(t.objectStore(store))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

/* ------------------------------ document --------------------------------- */

export async function loadDoc<T>(): Promise<T | null> {
  try {
    const row = await tx<T | undefined>(KV, 'readonly', (s) => s.get(DOC_KEY))
    if (row) return row
  } catch {
    // fall through to the mirror
  }
  try {
    const raw = localStorage.getItem(MIRROR_KEY)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

/** Writes are debounced by the caller (see store.tsx), so this stays simple. */
export async function saveDoc<T>(doc: T): Promise<void> {
  try {
    localStorage.setItem(MIRROR_KEY, JSON.stringify(doc))
  } catch {
    // quota — the IndexedDB write below is the source of truth anyway
  }
  await tx(KV, 'readwrite', (s) => s.put(doc, DOC_KEY))
}

/* -------------------------------- blobs ---------------------------------- */

export function putBlob(key: string, blob: Blob) {
  return tx(BLOBS, 'readwrite', (s) => s.put(blob, key))
}

export function getBlob(key: string) {
  return tx<Blob | undefined>(BLOBS, 'readonly', (s) => s.get(key))
}

export function deleteBlob(key: string) {
  return tx(BLOBS, 'readwrite', (s) => s.delete(key))
}

export function allBlobKeys() {
  return tx<IDBValidKey[]>(BLOBS, 'readonly', (s) => s.getAllKeys())
}

/* ------------------------------ diagnostics ------------------------------- */

export async function storageEstimate(): Promise<{ usedMb: number; quotaMb: number } | null> {
  if (!navigator.storage?.estimate) return null
  const { usage = 0, quota = 0 } = await navigator.storage.estimate()
  return { usedMb: usage / 1_048_576, quotaMb: quota / 1_048_576 }
}

/** Ask the browser to keep this origin's data through storage pressure. */
export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  try {
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export async function wipeAll() {
  localStorage.removeItem(MIRROR_KEY)
  await tx(KV, 'readwrite', (s) => s.clear())
  await tx(BLOBS, 'readwrite', (s) => s.clear())
}
