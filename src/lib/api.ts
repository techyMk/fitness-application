/* ============================================================================
   API client.

   The access token lives in a module variable, not localStorage. That means a
   page reload loses it — which is fine, because `refresh()` silently exchanges
   the httpOnly cookie for a new one at boot. The upside is that an XSS bug
   cannot read a credential out of storage, which is exactly the weakness the
   Anthropic-key path already has and that this one should not repeat.

   Every call goes through `request()`, which retries once after a 401 by
   refreshing. Concurrent 401s share a single in-flight refresh so a burst of
   requests cannot start a rotation stampede — and since refresh tokens are
   single-use with replay detection, a stampede would revoke the session.
   ========================================================================= */

import type { AppData } from './types'

export interface User {
  id: string
  email: string
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message)
  }
}

/** Server reachable and sync configured. Null until /api/health answers. */
let syncAvailable: boolean | null = null
let accessToken: string | null = null
let refreshing: Promise<boolean> | null = null

export const getToken = () => accessToken
export const setToken = (t: string | null) => {
  accessToken = t
}

async function parse(res: Response) {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return { error: text.slice(0, 200) }
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`)

  const res = await fetch(path, { ...init, headers, credentials: 'same-origin' })

  if (res.status === 401 && retry && path !== '/api/auth/refresh') {
    const ok = await refresh()
    if (ok) return request<T>(path, init, false)
  }

  if (!res.ok) {
    const body = await parse(res)
    throw new ApiError(
      body?.error || `Request failed (${res.status})`,
      res.status,
      body?.code,
    )
  }

  return (await parse(res)) as T
}

/* --------------------------------- health --------------------------------- */

export async function checkSync(): Promise<boolean> {
  if (syncAvailable !== null) return syncAvailable
  try {
    const res = await fetch('/api/health')
    if (!res.ok) throw new Error('unhealthy')
    const body = await res.json()
    syncAvailable = !!body.sync
  } catch {
    // No server at all — a static deployment. Anonymous mode, which is a
    // supported configuration, not an error.
    syncAvailable = false
  }
  return syncAvailable
}

/* ---------------------------------- auth ---------------------------------- */

interface SessionResponse {
  accessToken: string
  user: User
}

export async function register(email: string, password: string): Promise<User> {
  const r = await request<SessionResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  accessToken = r.accessToken
  return r.user
}

export async function login(email: string, password: string): Promise<User> {
  const r = await request<SessionResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  accessToken = r.accessToken
  return r.user
}

/**
 * True when the server has previously established a session in this browser.
 *
 * The refresh cookie is httpOnly and therefore invisible here, so the server
 * also sets a readable, secret-free companion. Checking it lets an anonymous
 * visitor skip a guaranteed-401 refresh call on every single page load.
 */
export function hasSessionHint(): boolean {
  return document.cookie.split('; ').some((c) => c.startsWith('forge_has_session='))
}

/** Exchange the refresh cookie for a new access token. Shared across callers. */
export function refresh(): Promise<boolean> {
  if (refreshing) return refreshing
  if (!hasSessionHint()) return Promise.resolve(false)
  refreshing = (async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'same-origin',
      })
      if (!res.ok) {
        accessToken = null
        return false
      }
      const body = (await res.json()) as SessionResponse
      accessToken = body.accessToken
      return true
    } catch {
      accessToken = null
      return false
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

export async function me(): Promise<User | null> {
  if (!accessToken && !(await refresh())) return null
  try {
    const r = await request<{ user: User }>('/api/auth/me')
    return r.user
  } catch {
    return null
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
  } finally {
    accessToken = null
  }
}

export async function changePassword(current: string, next: string): Promise<void> {
  await request('/api/auth/password', {
    method: 'POST',
    body: JSON.stringify({ current, next }),
  })
  // The server revoked every session, including this one.
  accessToken = null
}

export async function deleteAccount(): Promise<void> {
  await request('/api/auth/account', { method: 'DELETE' })
  accessToken = null
}

/* ---------------------------------- sync ---------------------------------- */

export interface PullResult {
  rev: number
  doc: AppData | null
}

export const pull = () => request<PullResult>('/api/sync')

export interface PushConflict {
  conflict: true
  rev: number
  doc: AppData | null
}
export interface PushOk {
  conflict: false
  rev: number
}

export async function push(
  baseRev: number,
  doc: AppData,
  deviceId: string,
): Promise<PushOk | PushConflict> {
  try {
    const r = await request<{ rev: number }>('/api/sync', {
      method: 'POST',
      body: JSON.stringify({ baseRev, doc, deviceId }),
    })
    return { conflict: false, rev: r.rev }
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) {
      // The 409 body carries the server's current state so the caller can merge
      // without a second round trip.
      const res = await fetch('/api/sync', {
        headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
        credentials: 'same-origin',
      })
      const body = (await res.json()) as PullResult
      return { conflict: true, rev: body.rev, doc: body.doc }
    }
    throw e
  }
}

/* --------------------------------- photos --------------------------------- */

export const listPhotos = () =>
  request<{ keys: string[]; used: number; quota: number }>('/api/photos')

export const uploadPhoto = (key: string, dataUrl: string) =>
  request<{ ok: true; bytes: number }>(`/api/photos/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: JSON.stringify({ dataUrl }),
  })

export async function downloadPhoto(key: string): Promise<Blob | null> {
  try {
    const res = await fetch(`/api/photos/${encodeURIComponent(key)}`, {
      headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
      credentials: 'same-origin',
    })
    if (res.status === 401 && (await refresh())) return downloadPhoto(key)
    if (!res.ok) return null
    return await res.blob()
  } catch {
    return null
  }
}

export const deletePhotoRemote = (key: string) =>
  request(`/api/photos/${encodeURIComponent(key)}`, { method: 'DELETE' })
