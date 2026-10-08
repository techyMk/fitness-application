/* ============================================================================
   Account + sync context.

   The rule this file exists to protect: **the app works identically without an
   account.** Signing in is an upgrade that adds durability and a second device,
   never a gate. So every path here degrades to "anonymous, local only" —
   no server, no database on the server, offline, expired session — and none of
   those states block a single feature.

   Sync runs:
     - once when a session is established
     - when the tab regains focus, if it has been more than MIN_INTERVAL
     - when the browser reports the network came back
     - on an explicit tap in Settings

   Deliberately NOT on every mutation: logging a set would otherwise fire a
   round trip per tap, which is the opposite of the few-seconds-per-set rule.
   ========================================================================= */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import * as api from './api'
import { syncNow, syncPhotos, type SyncPhase } from './sync'
import { useStore } from './store'

const MIN_INTERVAL_MS = 60_000

export interface AuthValue {
  /** null until the server has been asked whether sync exists at all */
  available: boolean | null
  user: api.User | null
  /** true while the initial session probe is in flight */
  loading: boolean

  phase: SyncPhase
  lastMessage: string | null
  syncedAt: number | null

  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  changePassword: (current: string, next: string) => Promise<void>
  deleteAccount: () => Promise<void>
  sync: (reason?: string) => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, actions, ready } = useStore()
  const [available, setAvailable] = useState<boolean | null>(null)
  const [user, setUser] = useState<api.User | null>(null)
  const [loading, setLoading] = useState(true)
  const [phase, setPhase] = useState<SyncPhase>('idle')
  const [lastMessage, setLastMessage] = useState<string | null>(null)

  // The sync closure needs the *current* document, but must not be rebuilt on
  // every keystroke — a changing callback identity would re-arm the effects
  // below on each render and sync in a loop.
  const docRef = useRef(data)
  docRef.current = data

  const inFlight = useRef(false)
  const lastRun = useRef(0)

  /* ------------------------------ boot probe ----------------------------- */

  useEffect(() => {
    let alive = true
    ;(async () => {
      const ok = await api.checkSync()
      if (!alive) return
      setAvailable(ok)
      if (!ok) {
        setLoading(false)
        return
      }
      const who = await api.me()
      if (!alive) return
      setUser(who)
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [])

  /* -------------------------------- syncing ------------------------------ */

  const sync = useCallback(
    async (reason = 'manual') => {
      if (!user || inFlight.current) return
      // Hydration has to finish first, or the first cycle would push an empty
      // document over a year of real history.
      if (!ready) return

      inFlight.current = true
      lastRun.current = Date.now()
      setPhase('syncing')
      setLastMessage(null)

      try {
        const result = await syncNow(docRef.current)

        if (result.doc) {
          actions.importData(result.doc)
          // importData replaces the document, so read back from the ref on the
          // next tick rather than trusting the stale closure value.
          docRef.current = result.doc
        }

        if (result.phase !== 'ok') {
          setPhase(result.phase)
          setLastMessage(result.message ?? null)
          return
        }

        setPhase('photos')
        try {
          const photos = await syncPhotos(docRef.current)
          if (photos.up || photos.down) {
            setLastMessage(
              [
                photos.up ? `${photos.up} photo${photos.up === 1 ? '' : 's'} uploaded` : null,
                photos.down ? `${photos.down} downloaded` : null,
              ]
                .filter(Boolean)
                .join(', '),
            )
          }
        } catch (e) {
          // Photo trouble must not present as "sync failed" — the log itself
          // is already safely synced at this point.
          setLastMessage(
            e instanceof api.ApiError && e.code === 'QUOTA'
              ? 'Photo storage is full. The rest of your log synced.'
              : 'Your log synced. Some photos will retry later.',
          )
        }

        setPhase('ok')
        if (reason === 'manual' && !lastMessage) setLastMessage('Everything is up to date.')
      } finally {
        inFlight.current = false
      }
    },
    // `lastMessage` is read only to decide on a cosmetic string; including it
    // would rebuild the callback on every status change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, ready, actions],
  )

  /* ------------------------- when to run a cycle ------------------------- */

  // On sign-in / session restore.
  useEffect(() => {
    if (user && ready) void sync('session')
  }, [user, ready, sync])

  // On focus and on reconnect, rate-limited.
  useEffect(() => {
    if (!user) return

    const maybe = (reason: string) => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastRun.current < MIN_INTERVAL_MS) return
      void sync(reason)
    }
    const onVisible = () => maybe('focus')
    const onOnline = () => void sync('online')

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
    }
  }, [user, sync])

  // A last push when the tab goes away, so a session logged and immediately
  // backgrounded is not stranded until the next launch.
  useEffect(() => {
    if (!user) return
    const onHide = () => {
      if (document.visibilityState === 'hidden' && !inFlight.current) void sync('hide')
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [user, sync])

  /* ------------------------------- actions ------------------------------- */

  const signIn = useCallback(async (email: string, password: string) => {
    setUser(await api.login(email, password))
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    setUser(await api.register(email, password))
  }, [])

  const signOut = useCallback(async () => {
    // Push anything outstanding before dropping the session, otherwise signing
    // out on a phone silently discards whatever it logged since the last cycle.
    if (user) {
      try {
        const result = await syncNow(docRef.current)
        if (result.doc) actions.importData(result.doc)
      } catch {
        // Offline sign-out is still a sign-out; the data stays on the device.
      }
    }
    await api.logout()
    setUser(null)
    setPhase('idle')
    setLastMessage(null)
  }, [user, actions])

  const changePassword = useCallback(async (current: string, next: string) => {
    await api.changePassword(current, next)
    // Every session was revoked, including this one.
    setUser(null)
  }, [])

  const deleteAccount = useCallback(async () => {
    await api.deleteAccount()
    setUser(null)
    setPhase('idle')
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      available,
      user,
      loading,
      phase,
      lastMessage,
      syncedAt: data.syncedAt ?? null,
      signIn,
      signUp,
      signOut,
      changePassword,
      deleteAccount,
      sync,
    }),
    [
      available,
      user,
      loading,
      phase,
      lastMessage,
      data.syncedAt,
      signIn,
      signUp,
      signOut,
      changePassword,
      deleteAccount,
      sync,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

/** "3 minutes ago" for the sync status line. */
export function fmtSyncAge(at: number | null): string {
  if (!at) return 'not yet synced'
  const secs = Math.round((Date.now() - at) / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}
