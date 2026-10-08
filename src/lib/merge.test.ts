/* ============================================================================
   Merge tests.

   These exist because a merge bug does not throw — it silently eats a workout
   you logged three weeks ago, and you find out when the chart looks wrong. The
   properties below are the ones that keep sync trustworthy:

     commutative   merge(a,b) deep-equals merge(b,a)
     idempotent    merge(a,a) deep-equals a
     lossless      a record on one side only always survives
     final         a deletion is not undone by the other device's copy
   ========================================================================= */

import { describe, expect, it } from 'vitest'
import { mergeDocs } from './merge'
import { emptyData } from './store'
import type { AppData, WeightEntry, WorkoutSession } from './types'

/**
 * Recent on purpose. Tombstones older than TOMBSTONE_TTL_MS are pruned, so a
 * fixture dated in the past would have its deletions silently swept away and
 * the deletion tests would pass for the wrong reason.
 */
const T0 = Date.now() - 60_000

function doc(patch: Partial<AppData> = {}): AppData {
  return { ...emptyData(), deviceId: 'dev-test', ...patch }
}

const weight = (id: string, date: string, kg: number, updatedAt = T0): WeightEntry => ({
  id,
  date,
  kg,
  updatedAt,
})

const session = (id: string, date: string, updatedAt = T0): WorkoutSession => ({
  id,
  date,
  title: 'Legs',
  startedAt: updatedAt,
  sets: [],
  volumeKg: 1000,
  completed: true,
  updatedAt,
})

/** Compare ignoring fields the merge is explicitly allowed to take from `local`. */
function comparable(d: AppData) {
  const { deviceId, records, nonGymRecords, ...rest } = d
  void deviceId
  void records
  void nonGymRecords
  return JSON.parse(JSON.stringify(rest))
}

/* --------------------------------- laws ---------------------------------- */

describe('merge laws', () => {
  it('is idempotent — merging a document with itself changes nothing', () => {
    const a = doc({
      weights: [weight('w1', '2026-10-01', 80)],
      sessions: [session('s1', '2026-10-01')],
      habitLog: { '2026-10-01': ['h1'] },
      habitLogAt: { '2026-10-01': T0 },
    })
    expect(comparable(mergeDocs(a, a))).toEqual(comparable(a))
  })

  it('is commutative — neither device wins by syncing first', () => {
    const a = doc({
      weights: [weight('w1', '2026-10-01', 80, T0)],
      sessions: [session('s1', '2026-10-01', T0)],
      deleted: { x1: T0 + 50 },
    })
    const b = doc({
      weights: [weight('w2', '2026-10-02', 79.5, T0 + 100)],
      sessions: [session('s2', '2026-10-02', T0 + 100)],
      deleted: { x2: T0 + 10 },
    })
    expect(comparable(mergeDocs(a, b))).toEqual(comparable(mergeDocs(b, a)))
  })
})

/* ------------------------------- no data loss ----------------------------- */

describe('no data loss', () => {
  it('keeps records that exist on only one side', () => {
    const phone = doc({ sessions: [session('s1', '2026-10-01')] })
    const laptop = doc({ sessions: [session('s2', '2026-10-02')] })
    const out = mergeDocs(phone, laptop)
    expect(out.sessions.map((s) => s.id).sort()).toEqual(['s1', 's2'])
  })

  it('keeps the later edit when both sides changed the same record', () => {
    const older = doc({ weights: [weight('w1', '2026-10-01', 80, T0)] })
    const newer = doc({ weights: [weight('w1', '2026-10-01', 79, T0 + 1000)] })
    expect(mergeDocs(older, newer).weights[0].kg).toBe(79)
    expect(mergeDocs(newer, older).weights[0].kg).toBe(79)
  })

  it('treats a missing write stamp as older than any stamped edit', () => {
    const legacy = doc({ weights: [{ id: 'w1', date: '2026-10-01', kg: 90 }] })
    const stamped = doc({ weights: [weight('w1', '2026-10-01', 75, T0)] })
    expect(mergeDocs(legacy, stamped).weights[0].kg).toBe(75)
  })

  it('does not duplicate a weigh-in logged for the same date on two devices', () => {
    // logWeight() reuses the date, so two devices produce different ids for
    // the same morning. Merging on id alone would show two entries for one day.
    const phone = doc({ weights: [weight('w-phone', '2026-10-01', 80, T0)] })
    const laptop = doc({ weights: [weight('w-laptop', '2026-10-01', 79.8, T0 + 10)] })
    const out = mergeDocs(phone, laptop)
    expect(out.weights).toHaveLength(1)
    expect(out.weights[0].kg).toBe(79.8)
  })
})

/* ------------------------------- deletions -------------------------------- */

describe('deletions', () => {
  it('stays deleted when the other device still has the record', () => {
    const deleter = doc({ sessions: [], deleted: { s1: T0 + 500 } })
    const stale = doc({ sessions: [session('s1', '2026-10-01', T0)] })
    expect(mergeDocs(deleter, stale).sessions).toHaveLength(0)
    expect(mergeDocs(stale, deleter).sessions).toHaveLength(0)
  })

  it('allows a record re-created after its deletion to survive', () => {
    const deleter = doc({ sessions: [], deleted: { s1: T0 + 500 } })
    const recreated = doc({ sessions: [session('s1', '2026-10-01', T0 + 900)] })
    expect(mergeDocs(deleter, recreated).sessions).toHaveLength(1)
  })

  it('prunes tombstones older than the TTL so they do not accumulate forever', () => {
    const ancient = Date.now() - 400 * 24 * 60 * 60 * 1000
    const out = mergeDocs(doc({ deleted: { old: ancient } }), doc())
    expect(out.deleted.old).toBeUndefined()
  })
})

/* -------------------------- map-shaped collections ------------------------ */

describe('map-shaped logs', () => {
  it('resolves habit ticks per day by the later edit', () => {
    const phone = doc({
      habitLog: { '2026-10-01': ['h1'] },
      habitLogAt: { '2026-10-01': T0 },
    })
    const laptop = doc({
      habitLog: { '2026-10-01': ['h1', 'h2'] },
      habitLogAt: { '2026-10-01': T0 + 100 },
    })
    expect(mergeDocs(phone, laptop).habitLog['2026-10-01']).toEqual(['h1', 'h2'])
  })

  it('lets un-ticking a habit win when it happened later', () => {
    const ticked = doc({ habitLog: { d: ['h1'] }, habitLogAt: { d: T0 } })
    const unticked = doc({ habitLog: { d: [] }, habitLogAt: { d: T0 + 100 } })
    expect(mergeDocs(ticked, unticked).habitLog.d).toEqual([])
  })

  it('merges step counts per date', () => {
    const a = doc({ steps: [{ date: 'd1', steps: 100 }], stepsAt: { d1: T0 } })
    const b = doc({ steps: [{ date: 'd1', steps: 900 }], stepsAt: { d1: T0 + 5 } })
    const out = mergeDocs(a, b)
    expect(out.steps).toHaveLength(1)
    expect(out.steps[0].steps).toBe(900)
  })

  it('keeps the earliest unlock date for an achievement', () => {
    const a = doc({ achievements: { 'first-pr': '2026-10-05' } })
    const b = doc({ achievements: { 'first-pr': '2026-09-01' } })
    expect(mergeDocs(a, b).achievements['first-pr']).toBe('2026-09-01')
    expect(mergeDocs(b, a).achievements['first-pr']).toBe('2026-09-01')
  })
})

/* ------------------------------- singletons ------------------------------- */

describe('singleton blobs', () => {
  it('takes the profile wholesale from the later writer', () => {
    const base = emptyData().profile
    void base
    const a = doc({
      profile: { ...doc().profile!, name: 'A' } as AppData['profile'],
      profileAt: T0,
    })
    const b = doc({
      profile: { ...doc().profile!, name: 'B' } as AppData['profile'],
      profileAt: T0 + 10,
    })
    // Both sides start with profile === null, so synthesise one for the test.
    const withA: AppData = { ...a, profile: { name: 'A' } as never, profileAt: T0 }
    const withB: AppData = { ...b, profile: { name: 'B' } as never, profileAt: T0 + 10 }
    expect((mergeDocs(withA, withB).profile as unknown as { name: string }).name).toBe('B')
    expect((mergeDocs(withB, withA).profile as unknown as { name: string }).name).toBe('B')
  })
})

/* ------------------------ the realistic two-device case ------------------- */

describe('two devices, a week apart', () => {
  it('ends with every entry from both and none of the deleted ones', () => {
    const shared = doc({
      weights: [weight('w0', '2026-09-30', 81, T0)],
      sessions: [session('s0', '2026-09-30', T0)],
    })

    // Phone: logs two sessions, deletes the shared weigh-in.
    const phone: AppData = {
      ...shared,
      weights: [],
      deleted: { w0: T0 + 1000 },
      sessions: [...shared.sessions, session('s1', '2026-10-01', T0 + 100), session('s2', '2026-10-02', T0 + 200)],
    }

    // Laptop: logs a weigh-in and edits the shared session's title.
    const laptop: AppData = {
      ...shared,
      weights: [...shared.weights, weight('w1', '2026-10-03', 79, T0 + 300)],
      sessions: [{ ...session('s0', '2026-09-30', T0 + 400), title: 'Legs (edited)' }],
    }

    const out = mergeDocs(phone, laptop)

    expect(out.sessions.map((s) => s.id).sort()).toEqual(['s0', 's1', 's2'])
    expect(out.sessions.find((s) => s.id === 's0')!.title).toBe('Legs (edited)')
    expect(out.weights.map((w) => w.id)).toEqual(['w1']) // w0 stayed deleted
    expect(comparable(out)).toEqual(comparable(mergeDocs(laptop, phone)))
  })
})
