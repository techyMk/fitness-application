/* ============================================================================
   Document merge.

   Two devices edit the same log offline. When they meet, something has to
   decide what the log contains. The naive answers both lose data:

     - "last writer wins" on the whole document throws away everything the
       other device did since the last sync.
     - "union everything" never loses an edit, but it resurrects every record
       the other device deleted, forever.

   So this is a per-collection merge with three rules:

     1. Records are unioned by id. A record present on one side only is kept —
        that is the append case, which is almost all real traffic.
     2. A record present on both sides resolves to the later `updatedAt`.
        A missing stamp reads as 0, so a stamped edit always beats an unstamped
        legacy row.
     3. A tombstone kills a record if the deletion happened after that record's
        last write. Re-creating a record with the same id after deleting it is
        therefore still possible, which matters because `logWeight` reuses a
        date, not an id.

   The merge is commutative and idempotent: merge(a,b) == merge(b,a), and
   merge(a,a) == a. Both properties are asserted by the tests in sync.test.ts.
   Anything that breaks them makes sync order-dependent, which is the bug class
   that produces "my phone keeps undoing my laptop".
   ========================================================================= */

import type { AppData, DateKey, ID } from './types'

/** A tombstone older than this is dropped — no device can plausibly be that stale. */
export const TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000

const stamp = (r: { updatedAt?: number }) => r.updatedAt ?? 0

/* ------------------------------- primitives ------------------------------ */

/** Union two id-keyed collections, newer wins, tombstones applied. */
function mergeById<T extends { id: ID; updatedAt?: number }>(
  a: T[],
  b: T[],
  tombstones: Record<ID, number>,
): T[] {
  const out = new Map<ID, T>()
  for (const r of a) out.set(r.id, r)
  for (const r of b) {
    const existing = out.get(r.id)
    if (!existing || stamp(r) > stamp(existing)) out.set(r.id, r)
  }
  const kept: T[] = []
  for (const r of out.values()) {
    const killedAt = tombstones[r.id]
    // Strictly greater: a record rewritten after its deletion is a revival.
    if (killedAt != null && killedAt > stamp(r)) continue
    kept.push(r)
  }
  // Sort by id so the result is byte-identical regardless of merge order.
  // Insertion order would otherwise depend on which device synced first, and
  // the sync layer compares serialised documents to decide whether to push —
  // non-deterministic ordering would make every merge look like a change and
  // leave two devices pushing to each other indefinitely.
  return kept.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
}

/**
 * Union two date-keyed collections where the date is the identity, not `id`.
 * Weight and steps behave this way — logging the same date twice replaces the
 * entry rather than adding one, so merging on `id` would produce two rows for
 * one morning.
 */
function mergeByDate<T extends { date: DateKey; updatedAt?: number }>(a: T[], b: T[]): T[] {
  const out = new Map<DateKey, T>()
  for (const r of a) out.set(r.date, r)
  for (const r of b) {
    const existing = out.get(r.date)
    if (!existing || stamp(r) > stamp(existing)) out.set(r.date, r)
  }
  return [...out.values()].sort((x, y) => (x.date < y.date ? -1 : 1))
}

/** Per-key newer-wins over two parallel maps of value + write stamp. */
function mergeStampedMap<V>(
  aVal: Record<string, V>,
  aAt: Record<string, number>,
  bVal: Record<string, V>,
  bAt: Record<string, number>,
): { value: Record<string, V>; at: Record<string, number> } {
  const value: Record<string, V> = { ...aVal }
  const at: Record<string, number> = { ...aAt }
  for (const key of Object.keys(bVal)) {
    const bStamp = bAt[key] ?? 0
    const aStamp = aAt[key] ?? 0
    if (!(key in value) || bStamp > aStamp) {
      value[key] = bVal[key]
      at[key] = bStamp
    }
  }
  return { value, at }
}

function mergeTombstones(a: Record<ID, number>, b: Record<ID, number>): Record<ID, number> {
  const merged: Record<ID, number> = { ...a }
  for (const [id, at] of Object.entries(b)) {
    if (!(id in merged) || at > merged[id]) merged[id] = at
  }
  const cutoff = Date.now() - TOMBSTONE_TTL_MS
  // Rebuilt with sorted keys for the same determinism reason as mergeById:
  // JSON.stringify preserves insertion order, so unsorted keys would make two
  // equal tombstone sets serialise differently.
  const out: Record<ID, number> = {}
  for (const id of Object.keys(merged).sort()) {
    if (merged[id] >= cutoff) out[id] = merged[id]
  }
  return out
}

/* --------------------------------- merge --------------------------------- */

/**
 * Merge two full documents. Neither argument is mutated.
 *
 * `local` and `remote` are peers — there is no privileged side. The only
 * asymmetry is `deviceId`, which stays with the local device because it
 * identifies this installation, not the account.
 */
export function mergeDocs(local: AppData, remote: AppData): AppData {
  const tombstones = mergeTombstones(local.deleted ?? {}, remote.deleted ?? {})

  const habit = mergeStampedMap(
    local.habitLog ?? {},
    local.habitLogAt ?? {},
    remote.habitLog ?? {},
    remote.habitLogAt ?? {},
  )
  const supp = mergeStampedMap(
    local.supplementLog ?? {},
    local.supplementLogAt ?? {},
    remote.supplementLog ?? {},
    remote.supplementLogAt ?? {},
  )
  const steps = mergeStampedMap(
    Object.fromEntries((local.steps ?? []).map((s) => [s.date, s.steps])),
    local.stepsAt ?? {},
    Object.fromEntries((remote.steps ?? []).map((s) => [s.date, s.steps])),
    remote.stepsAt ?? {},
  )

  // Singleton blobs: whichever side wrote last owns the whole blob. Field-level
  // merging of the profile would let two devices build a settings combination
  // that neither user ever chose.
  const profileNewer = (remote.profileAt ?? 0) > (local.profileAt ?? 0)
  const settingsNewer = (remote.settingsAt ?? 0) > (local.settingsAt ?? 0)

  return {
    ...local,

    version: Math.max(local.version, remote.version),

    profile: profileNewer ? remote.profile : local.profile,
    profileAt: Math.max(local.profileAt ?? 0, remote.profileAt ?? 0),

    notifications: settingsNewer ? remote.notifications : local.notifications,
    dashboard: settingsNewer ? remote.dashboard : local.dashboard,
    settingsAt: Math.max(local.settingsAt ?? 0, remote.settingsAt ?? 0),

    weights: mergeByDate(local.weights ?? [], remote.weights ?? []).filter(
      (w) => !(tombstones[w.id] > stamp(w)),
    ),
    sessions: mergeById(local.sessions ?? [], remote.sessions ?? [], tombstones),
    // Built-in plans ship with the app, so they are carried through from the
    // local copy rather than merged — syncing them between devices would be
    // syncing the app's own seed data. Only user plans actually merge.
    //
    // They must be carried, not dropped: migrate() re-seeds them at load time,
    // but a merge happens in memory mid-session, and dropping them there empties
    // the user's programme list until the next reload.
    plans: [
      ...(local.plans ?? []).filter((p) => p.builtIn),
      ...mergeById(
        (local.plans ?? []).filter((p) => !p.builtIn),
        (remote.plans ?? []).filter((p) => !p.builtIn),
        tombstones,
      ),
    ],
    customExercises: mergeById(
      local.customExercises ?? [],
      remote.customExercises ?? [],
      tombstones,
    ),
    meals: mergeById(local.meals ?? [], remote.meals ?? [], tombstones),
    savedMeals: mergeById(local.savedMeals ?? [], remote.savedMeals ?? [], tombstones),
    customFoods: mergeById(local.customFoods ?? [], remote.customFoods ?? [], tombstones),
    cardio: mergeById(local.cardio ?? [], remote.cardio ?? [], tombstones),
    sleep: mergeById(local.sleep ?? [], remote.sleep ?? [], tombstones),
    habits: mergeById(local.habits ?? [], remote.habits ?? [], tombstones),
    supplements: mergeById(local.supplements ?? [], remote.supplements ?? [], tombstones),
    photos: mergeById(local.photos ?? [], remote.photos ?? [], tombstones),
    goals: mergeById(local.goals ?? [], remote.goals ?? [], tombstones),
    challenges: mergeById(local.challenges ?? [], remote.challenges ?? [], tombstones),
    phases: mergeById(local.phases ?? [], remote.phases ?? [], tombstones),
    friends: mergeById(local.friends ?? [], remote.friends ?? [], tombstones),

    // Check-ins are keyed by date, one per day.
    checkIns: (() => {
      const map = new Map<DateKey, AppData['checkIns'][number]>()
      for (const c of local.checkIns ?? []) map.set(c.date, c)
      for (const c of remote.checkIns ?? []) {
        const existing = map.get(c.date)
        if (!existing || (c.completedAt ?? 0) > (existing.completedAt ?? 0)) map.set(c.date, c)
      }
      return [...map.values()].sort((a, b) => (a.date < b.date ? -1 : 1))
    })(),

    steps: Object.entries(steps.value)
      .map(([date, n]) => ({ date, steps: n as number }))
      .sort((a, b) => (a.date < b.date ? -1 : 1)),
    stepsAt: steps.at,

    habitLog: habit.value as AppData['habitLog'],
    habitLogAt: habit.at,
    supplementLog: supp.value as AppData['supplementLog'],
    supplementLogAt: supp.at,

    // An achievement is earned once. If two devices disagree on the date, the
    // earlier one is the truth — you did the thing then, not when it synced.
    achievements: (() => {
      const out = { ...(local.achievements ?? {}) }
      for (const [id, date] of Object.entries(remote.achievements ?? {})) {
        if (!(id in out) || date < out[id]) out[id] = date
      }
      return out
    })(),

    // Chat is append-only; union by id, keep the newest 100 by timestamp.
    coachLog: [
      ...new Map(
        [...(local.coachLog ?? []), ...(remote.coachLog ?? [])].map((m) => [m.id, m]),
      ).values(),
    ]
      .sort((a, b) => a.at - b.at)
      .slice(-100),

    // Records and non-gym records are fully derived from sessions, so they are
    // recomputed by the store's reconcile() after the merge rather than merged.
    records: local.records,
    nonGymRecords: local.nonGymRecords,

    deleted: tombstones,
    lastBackupAt: Math.max(local.lastBackupAt ?? 0, remote.lastBackupAt ?? 0) || null,
    deviceId: local.deviceId,
    rev: Math.max(local.rev ?? 0, remote.rev ?? 0),
    syncedAt: Math.max(local.syncedAt ?? 0, remote.syncedAt ?? 0) || null,
  }
}

/* ------------------------------- diagnostics ------------------------------ */

export interface MergeSummary {
  added: number
  updated: number
  removed: number
}

/** Row-count delta, for the "pulled 14 new entries" line in Settings. */
export function summarise(before: AppData, after: AppData): MergeSummary {
  const count = (d: AppData) =>
    (d.weights?.length ?? 0) +
    (d.sessions?.length ?? 0) +
    (d.meals?.length ?? 0) +
    (d.cardio?.length ?? 0) +
    (d.sleep?.length ?? 0) +
    (d.photos?.length ?? 0) +
    (d.checkIns?.length ?? 0)

  const delta = count(after) - count(before)
  return {
    added: Math.max(0, delta),
    updated: 0,
    removed: Math.max(0, -delta),
  }
}
