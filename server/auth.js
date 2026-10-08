import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { sql } from './db.js'

/* ============================================================================
   Authentication primitives.

   Token design:
     access   short-lived JWT, returned in the response body, held in memory by
              the client. Never written to localStorage, so an XSS bug cannot
              read a long-lived credential out of storage.
     refresh  opaque 32-byte random string in an httpOnly cookie. Stored only as
              a SHA-256 hash, rotated on every use, and bound to a `family` so
              that replaying a spent token revokes the whole chain.

   Rotation with re-use detection is the part worth keeping: if a refresh token
   is ever presented twice, either the network replayed it or it was stolen.
   Either way the safe response is to kill every session descended from it.
   ========================================================================= */

const ACCESS_TTL = '15m'
const REFRESH_TTL_DAYS = 60
const BCRYPT_ROUNDS = 12

export const JWT_SECRET = process.env.JWT_SECRET || ''

/**
 * A missing secret is fatal in production — with a fallback, every deployment
 * would share a guessable signing key and anyone could mint a valid token.
 * In development we generate an ephemeral one so `npm run dev` just works
 * (sessions then die on restart, which is the correct trade for a dev box).
 */
export function resolveSecret() {
  if (JWT_SECRET) return JWT_SECRET
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production. Refusing to start with a default.')
  }
  const ephemeral = crypto.randomBytes(32).toString('hex')
  console.warn('⚠️  JWT_SECRET not set — using an ephemeral dev secret. Sessions end on restart.')
  return ephemeral
}

const SECRET = resolveSecret()

/* -------------------------------- passwords ------------------------------- */

export const hashPassword = (plain) => bcrypt.hash(plain, BCRYPT_ROUNDS)
export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash)

/** Mirrors the client-side rule so the two never disagree. */
export function passwordProblem(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters.'
  }
  if (password.length > 200) return 'Password must be under 200 characters.'
  return null
}

export function normaliseEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

export function emailProblem(email) {
  // Deliberately permissive: the only reliable validator is sending a mail.
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.'
  if (email.length > 254) return 'That email address is too long.'
  return null
}

/* --------------------------------- tokens --------------------------------- */

export const signAccess = (user) =>
  jwt.sign({ sub: user.id, email: user.email }, SECRET, { expiresIn: ACCESS_TTL })

export function verifyAccess(token) {
  try {
    return jwt.verify(token, SECRET)
  } catch {
    return null
  }
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex')

export async function issueRefresh(userId, family = crypto.randomUUID()) {
  const token = crypto.randomBytes(32).toString('base64url')
  const expires = new Date(Date.now() + REFRESH_TTL_DAYS * 86_400_000)
  await sql`insert into refresh_tokens (token_hash, user_id, family, expires_at)
            values (${sha256(token)}, ${userId}, ${family}, ${expires.toISOString()})`
  return { token, family, expires }
}

/**
 * Spend a refresh token and issue its successor.
 * Returns null when the token is unknown, expired, or already spent — and in
 * the already-spent case, revokes the entire family first.
 */
export async function rotateRefresh(token) {
  if (!token) return null
  const hash = sha256(token)

  const { rows } = await sql`
    select token_hash, user_id, family, used, expires_at
    from refresh_tokens where token_hash = ${hash}`
  const row = rows[0]
  if (!row) return null

  if (row.used) {
    // Replay: the only honest interpretation is that this token leaked.
    await sql`delete from refresh_tokens where family = ${row.family}`
    return null
  }
  if (new Date(row.expires_at) < new Date()) {
    await sql`delete from refresh_tokens where token_hash = ${hash}`
    return null
  }

  await sql`update refresh_tokens set used = true where token_hash = ${hash}`
  const next = await issueRefresh(row.user_id, row.family)
  return { userId: row.user_id, ...next }
}

export async function revokeFamilyFor(token) {
  if (!token) return
  const { rows } = await sql`select family from refresh_tokens where token_hash = ${sha256(token)}`
  if (rows[0]) await sql`delete from refresh_tokens where family = ${rows[0].family}`
}

/* -------------------------------- cookies --------------------------------- */

export const REFRESH_COOKIE = 'forge_rt'

/**
 * A readable companion to the httpOnly refresh cookie. It carries no secret —
 * it exists only so the client can tell "there might be a session here" from
 * "definitely anonymous" without firing a request. The refresh cookie itself
 * is invisible to JS by design, so without this hint every anonymous page load
 * would make a doomed call to /api/auth/refresh and log a 401.
 */
export const SESSION_HINT_COOKIE = 'forge_has_session'

export function hintCookieOptions() {
  return {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: REFRESH_TTL_DAYS * 86_400_000,
  }
}

export function refreshCookieOptions() {
  return {
    httpOnly: true,
    // Lax is enough because the API and the app are same-origin (see README).
    // It also means the cookie is not sent on cross-site POSTs, which removes
    // the CSRF exposure a bare refresh endpoint would otherwise have.
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/auth',
    maxAge: REFRESH_TTL_DAYS * 86_400_000,
  }
}

/* ------------------------------- middleware ------------------------------- */

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  const claims = token ? verifyAccess(token) : null
  if (!claims) return res.status(401).json({ error: 'Sign in to continue.' })
  req.userId = claims.sub
  req.userEmail = claims.email
  next()
}

/* ------------------------------ rate limiting ----------------------------- */

/**
 * Fixed-window limiter, in memory.
 *
 * Adequate for a single instance, which is what this deploys as. On multiple
 * instances each gets its own window, so the effective limit multiplies by the
 * instance count — move to Redis or the platform's own limiter before scaling
 * out. Guarding the auth routes matters most: without it, password login is an
 * open offline-speed brute-force oracle.
 */
export function rateLimit({ windowMs = 15 * 60_000, max = 20, key = 'default' } = {}) {
  const hits = new Map()

  return (req, res, next) => {
    const now = Date.now()
    const id = `${key}:${req.ip}`
    const entry = hits.get(id)

    if (!entry || now > entry.resetAt) {
      hits.set(id, { count: 1, resetAt: now + windowMs })
    } else {
      entry.count += 1
      if (entry.count > max) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
        res.set('Retry-After', String(retryAfter))
        return res.status(429).json({
          error: `Too many attempts. Try again in ${Math.ceil(retryAfter / 60)} minutes.`,
        })
      }
    }

    // Opportunistic sweep so the map cannot grow without bound.
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k)
    }
    next()
  }
}
