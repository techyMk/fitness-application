import 'dotenv/config'
import { neon } from '@neondatabase/serverless'

/* ============================================================================
   Neon connection + schema.

   The HTTP driver issues one fetch per query, which suits serverless: no idle
   TCP connections to leak and nothing to pool. Use the *pooled* Neon URL.

   `isConfigured` exists so the app degrades instead of crashing when the
   database is absent. That is not defensive padding — it is the product
   requirement: login is optional (spec §42), so a user who never signs in must
   get a fully working app from a deployment with no database at all.
   ========================================================================= */

const url = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || ''

const isPlaceholder = (u) =>
  !u || u.includes('USER:PASSWORD') || u.includes('ep-xxxx') || u.includes('<')

export const isConfigured = !isPlaceholder(url)

export const sql = isConfigured ? neon(url, { fullResults: true }) : null

/** Max bytes of photo storage per account. Neon's free tier is 0.5 GB total. */
export const PHOTO_QUOTA_BYTES = Number(process.env.PHOTO_QUOTA_BYTES || 200 * 1024 * 1024)

export async function initSchema() {
  if (!sql) return

  await sql`create extension if not exists pgcrypto`

  await sql`create table if not exists users (
    id            uuid primary key default gen_random_uuid(),
    email         text unique not null,
    password_hash text not null,
    created_at    timestamptz not null default now(),
    last_seen_at  timestamptz
  )`

  /* One row per account. The whole AppData document lives in `doc`.
     `rev` is the optimistic-concurrency token: a push is only accepted when the
     client's base revision still matches, which is what stops a stale device
     from overwriting a newer document. */
  await sql`create table if not exists snapshots (
    user_id    uuid primary key references users(id) on delete cascade,
    rev        bigint not null default 1,
    doc        jsonb not null,
    updated_at timestamptz not null default now(),
    device_id  text
  )`

  /* Refresh tokens are stored hashed, never in the clear — a database leak must
     not hand out sessions. `family` ties a rotation chain together so that
     re-use of an already-spent token can revoke every descendant at once. */
  await sql`create table if not exists refresh_tokens (
    token_hash text primary key,
    user_id    uuid not null references users(id) on delete cascade,
    family     uuid not null,
    used       boolean not null default false,
    expires_at timestamptz not null,
    created_at timestamptz not null default now()
  )`
  await sql`create index if not exists refresh_user_idx on refresh_tokens (user_id)`
  await sql`create index if not exists refresh_family_idx on refresh_tokens (family)`

  /* Progress photos. bytea rather than object storage keeps the deployment to
     one service; PHOTO_QUOTA_BYTES caps the damage. Swap this table for S3/R2
     presigned URLs when storage outgrows Neon — see README. */
  await sql`create table if not exists photos (
    user_id    uuid not null references users(id) on delete cascade,
    key        text not null,
    mime       text not null default 'image/jpeg',
    bytes      integer not null,
    data       bytea not null,
    created_at timestamptz not null default now(),
    primary key (user_id, key)
  )`
  await sql`create index if not exists photos_user_idx on photos (user_id)`
}

/** Drop expired/spent refresh tokens. Cheap enough to run on boot. */
export async function pruneTokens() {
  if (!sql) return
  await sql`delete from refresh_tokens where expires_at < now()`
}
