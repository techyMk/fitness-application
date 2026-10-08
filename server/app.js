import express from 'express'
import cookieParser from 'cookie-parser'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isConfigured, initSchema, PHOTO_QUOTA_BYTES, pruneTokens, sql } from './db.js'
import {
  REFRESH_COOKIE,
  SESSION_HINT_COOKIE,
  emailProblem,
  hintCookieOptions,
  hashPassword,
  issueRefresh,
  normaliseEmail,
  passwordProblem,
  rateLimit,
  refreshCookieOptions,
  requireAuth,
  revokeFamilyFor,
  rotateRefresh,
  signAccess,
  verifyPassword,
} from './auth.js'

/* ============================================================================
   The API.

   Everything here is optional to the product: the app is fully usable with no
   account and no database (spec §42). These endpoints add durability and
   multi-device sync on top of a log that already works offline.

   Routes are mounted under /api and the built client is served from the same
   origin, so there is no CORS configuration and the refresh cookie can be
   SameSite=Lax. That is a deliberate deployment choice — see README.
   ========================================================================= */

const app = express()

app.set('trust proxy', 1) // correct req.ip behind Vercel/Fly/nginx
app.use(express.json({ limit: '12mb' })) // a long history with photos is chunky
app.use(cookieParser())

/* Minimal hardening. Not a substitute for a CDN's headers, but these are the
   ones that matter for an API serving a single-page app. */
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff')
  res.set('Referrer-Policy', 'same-origin')
  res.set('X-Frame-Options', 'DENY')
  next()
})

const needsDb = (_req, res, next) =>
  isConfigured
    ? next()
    : res.status(503).json({
        error: 'Sync is not configured on this server. The app works without an account.',
        code: 'NO_DATABASE',
      })

const authLimiter = rateLimit({ windowMs: 15 * 60_000, max: 20, key: 'auth' })

/* --------------------------------- health --------------------------------- */

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, sync: isConfigured })
})

/* ---------------------------------- auth ---------------------------------- */

function setSession(res, user, refresh) {
  res.cookie(REFRESH_COOKIE, refresh.token, refreshCookieOptions())
  res.cookie(SESSION_HINT_COOKIE, '1', hintCookieOptions())
  return { accessToken: signAccess(user), user: { id: user.id, email: user.email } }
}

function clearSession(res) {
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions())
  res.clearCookie(SESSION_HINT_COOKIE, hintCookieOptions())
}

app.post('/api/auth/register', needsDb, authLimiter, async (req, res) => {
  const email = normaliseEmail(req.body?.email)
  const password = req.body?.password

  const problem = emailProblem(email) || passwordProblem(password)
  if (problem) return res.status(400).json({ error: problem })

  const { rows: existing } = await sql`select id from users where email = ${email}`
  if (existing.length) {
    return res.status(409).json({ error: 'That email already has an account. Sign in instead.' })
  }

  const hash = await hashPassword(password)
  const { rows } = await sql`
    insert into users (email, password_hash) values (${email}, ${hash})
    returning id, email`
  const user = rows[0]
  const refresh = await issueRefresh(user.id)
  res.status(201).json(setSession(res, user, refresh))
})

app.post('/api/auth/login', needsDb, authLimiter, async (req, res) => {
  const email = normaliseEmail(req.body?.email)
  const password = req.body?.password
  if (!email || !password) return res.status(400).json({ error: 'Enter your email and password.' })

  const { rows } = await sql`select id, email, password_hash from users where email = ${email}`
  const user = rows[0]

  // One message for "no such user" and "wrong password" so the endpoint cannot
  // be used to enumerate which addresses have accounts.
  const ok = user && (await verifyPassword(password, user.password_hash))
  if (!ok) return res.status(401).json({ error: 'Email or password is incorrect.' })

  await sql`update users set last_seen_at = now() where id = ${user.id}`
  const refresh = await issueRefresh(user.id)
  res.json(setSession(res, user, refresh))
})

app.post('/api/auth/refresh', needsDb, async (req, res) => {
  const rotated = await rotateRefresh(req.cookies?.[REFRESH_COOKIE])
  if (!rotated) {
    clearSession(res)
    return res.status(401).json({ error: 'Your session expired. Sign in again.' })
  }
  const { rows } = await sql`select id, email from users where id = ${rotated.userId}`
  const user = rows[0]
  if (!user) {
    clearSession(res)
    return res.status(401).json({ error: 'Your session expired. Sign in again.' })
  }
  res.json(setSession(res, user, rotated))
})

app.post('/api/auth/logout', needsDb, async (req, res) => {
  await revokeFamilyFor(req.cookies?.[REFRESH_COOKIE])
  clearSession(res)
  res.json({ ok: true })
})

app.get('/api/auth/me', needsDb, requireAuth, async (req, res) => {
  const { rows } = await sql`select id, email, created_at from users where id = ${req.userId}`
  if (!rows[0]) return res.status(401).json({ error: 'Sign in to continue.' })
  res.json({ user: rows[0] })
})

app.post('/api/auth/password', needsDb, requireAuth, authLimiter, async (req, res) => {
  const problem = passwordProblem(req.body?.next)
  if (problem) return res.status(400).json({ error: problem })

  const { rows } = await sql`select password_hash from users where id = ${req.userId}`
  if (!rows[0] || !(await verifyPassword(req.body?.current ?? '', rows[0].password_hash))) {
    return res.status(401).json({ error: 'Current password is incorrect.' })
  }

  await sql`update users set password_hash = ${await hashPassword(req.body.next)}
            where id = ${req.userId}`
  // Changing a password ends every other session, which is the whole point.
  await sql`delete from refresh_tokens where user_id = ${req.userId}`
  clearSession(res)
  res.json({ ok: true })
})

app.delete('/api/auth/account', needsDb, requireAuth, async (req, res) => {
  // Cascades through snapshots, refresh_tokens and photos.
  await sql`delete from users where id = ${req.userId}`
  clearSession(res)
  res.json({ ok: true })
})

/* ---------------------------------- sync ---------------------------------- */

app.get('/api/sync', needsDb, requireAuth, async (req, res) => {
  const { rows } = await sql`
    select rev, doc, updated_at from snapshots where user_id = ${req.userId}`
  if (!rows[0]) return res.json({ rev: 0, doc: null })
  res.json({ rev: Number(rows[0].rev), doc: rows[0].doc, updatedAt: rows[0].updated_at })
})

/**
 * Push. Succeeds only when the client's `baseRev` still matches the stored
 * revision; otherwise it returns 409 with the current document so the client
 * can merge and retry. The server never merges — merging needs the full
 * tombstone and write-stamp logic that already exists on the client, and
 * duplicating it here would be two implementations to keep in agreement.
 */
app.post('/api/sync', needsDb, requireAuth, async (req, res) => {
  const { baseRev, doc, deviceId } = req.body ?? {}
  if (!doc || typeof doc !== 'object') {
    return res.status(400).json({ error: 'Missing document.' })
  }
  if (!Number.isInteger(baseRev) || baseRev < 0) {
    return res.status(400).json({ error: 'Missing base revision.' })
  }

  const { rows: current } = await sql`
    select rev, doc from snapshots where user_id = ${req.userId}`

  if (!current[0]) {
    if (baseRev !== 0) {
      // Client thinks it synced before, but the server has nothing — the
      // account was reset. Tell it to start from zero rather than silently
      // accepting a push against a revision that no longer exists.
      return res.status(409).json({ rev: 0, doc: null })
    }
    const { rows } = await sql`
      insert into snapshots (user_id, rev, doc, device_id)
      values (${req.userId}, 1, ${JSON.stringify(doc)}::jsonb, ${deviceId ?? null})
      returning rev`
    return res.json({ rev: Number(rows[0].rev) })
  }

  const serverRev = Number(current[0].rev)
  if (serverRev !== baseRev) {
    return res.status(409).json({ rev: serverRev, doc: current[0].doc })
  }

  // Conditional update: the `rev = baseRev` predicate makes this atomic against
  // a concurrent push that slipped in between the select and the update.
  const { rows } = await sql`
    update snapshots
       set rev = rev + 1,
           doc = ${JSON.stringify(doc)}::jsonb,
           updated_at = now(),
           device_id = ${deviceId ?? null}
     where user_id = ${req.userId} and rev = ${baseRev}
     returning rev`

  if (!rows[0]) {
    const { rows: latest } = await sql`
      select rev, doc from snapshots where user_id = ${req.userId}`
    return res.status(409).json({ rev: Number(latest[0].rev), doc: latest[0].doc })
  }

  res.json({ rev: Number(rows[0].rev) })
})

/* --------------------------------- photos --------------------------------- */

app.get('/api/photos', needsDb, requireAuth, async (req, res) => {
  const { rows } = await sql`
    select key, bytes, mime from photos where user_id = ${req.userId}`
  const used = rows.reduce((a, r) => a + r.bytes, 0)
  res.json({ keys: rows.map((r) => r.key), used, quota: PHOTO_QUOTA_BYTES })
})

app.get('/api/photos/:key', needsDb, requireAuth, async (req, res) => {
  const { rows } = await sql`
    select mime, data from photos where user_id = ${req.userId} and key = ${req.params.key}`
  if (!rows[0]) return res.status(404).json({ error: 'No such photo.' })
  res.set('Content-Type', rows[0].mime)
  res.set('Cache-Control', 'private, max-age=31536000, immutable')
  res.send(Buffer.from(rows[0].data))
})

app.put('/api/photos/:key', needsDb, requireAuth, async (req, res) => {
  const { dataUrl } = req.body ?? {}
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    return res.status(400).json({ error: 'Expected a data URL.' })
  }

  const match = /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl)
  if (!match) return res.status(400).json({ error: 'Expected a base64 data URL.' })
  const [, mime, b64] = match
  if (!mime.startsWith('image/')) return res.status(400).json({ error: 'Images only.' })

  const buf = Buffer.from(b64, 'base64')
  if (buf.length === 0) return res.status(400).json({ error: 'That image is empty.' })

  const { rows: usage } = await sql`
    select coalesce(sum(bytes), 0)::bigint as used from photos
    where user_id = ${req.userId} and key <> ${req.params.key}`
  if (Number(usage[0].used) + buf.length > PHOTO_QUOTA_BYTES) {
    return res.status(413).json({
      error: 'Photo storage is full. Delete some photos to free space.',
      code: 'QUOTA',
    })
  }

  await sql`
    insert into photos (user_id, key, mime, bytes, data)
    values (${req.userId}, ${req.params.key}, ${mime}, ${buf.length}, ${buf})
    on conflict (user_id, key)
    do update set mime = excluded.mime, bytes = excluded.bytes, data = excluded.data`

  res.json({ ok: true, bytes: buf.length })
})

app.delete('/api/photos/:key', needsDb, requireAuth, async (req, res) => {
  await sql`delete from photos where user_id = ${req.userId} and key = ${req.params.key}`
  res.json({ ok: true })
})

/* ------------------------------ error handling ---------------------------- */

app.use('/api', (_req, res) => res.status(404).json({ error: 'No such endpoint.' }))

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  // Log the detail, return a generic message: stack traces and driver errors
  // routinely leak schema and connection details.
  console.error('[api]', err)
  if (res.headersSent) return
  res.status(500).json({ error: 'Something went wrong on the server.' })
})

/* --------------------------- static client (prod) ------------------------- */

export function serveClient() {
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
  app.use(express.static(dir, { maxAge: '1y', index: false }))

  // SPA fallback so deep links like /analytics resolve to the app rather than
  // 404. Written as middleware rather than app.get('*') because Express 5
  // swapped in a path-to-regexp that rejects a bare '*' at startup — the old
  // form throws before the server ever listens.
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    res.sendFile(path.join(dir, 'index.html'))
  })
}

export { initSchema, isConfigured, pruneTokens }
export default app
