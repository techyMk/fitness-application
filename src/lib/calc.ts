/* ============================================================================
   The calculation engine. Everything the user doesn't type is derived here:
   targets, weight trend, goal prediction, the transformation score, PRs and
   progression suggestions.

   Guiding rule from the brief: minimum input, maximum feedback. So every
   function in here degrades gracefully on thin data and says so — a prediction
   with four data points returns `confidence: 'low'` rather than a number
   presented as fact.
   ========================================================================= */

import type {
  ActivityLevel,
  AppData,
  CheckIn,
  DateKey,
  Equipment,
  Goal,
  GoalType,
  PersonalRecord,
  Profile,
  SetEntry,
  Targets,
  WeightEntry,
  WorkoutSession,
} from './types'
import { addDays, daysBetween, lastNDays, today, weekStart } from './date'

/* ------------------------------ unit helpers ------------------------------ */

export const KG_PER_LB = 0.45359237
export const KM_PER_MI = 1.609344

export const kgToLb = (kg: number) => kg / KG_PER_LB
export const lbToKg = (lb: number) => lb * KG_PER_LB
export const kmToMi = (km: number) => km / KM_PER_MI
export const miToKm = (mi: number) => mi * KM_PER_MI
export const cmToIn = (cm: number) => cm / 2.54
export const inToCm = (inch: number) => inch * 2.54

/* --------------------------- energy & targets ---------------------------- */

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  extreme: 1.9,
}

/** Mifflin–St Jeor. For 'unspecified' we take the midpoint of the two constants. */
export function bmr(weightKg: number, heightCm: number, age: number, sex: Profile['sex']): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  if (sex === 'male') return base + 5
  if (sex === 'female') return base - 161
  return base - 78
}

export function tdee(p: Pick<Profile, 'heightCm' | 'age' | 'sex' | 'activity'>, weightKg: number) {
  return bmr(weightKg, p.heightCm, p.age, p.sex) * ACTIVITY_FACTOR[p.activity]
}

/** Calorie offset by goal, as a fraction of maintenance. */
const GOAL_OFFSET: Record<GoalType, number> = {
  'fat-loss': -0.2,
  'muscle-gain': 0.12,
  recomp: -0.05,
  maintenance: 0,
  general: 0,
  custom: 0,
}

/** Protein g per kg bodyweight by goal — the one macro the app nags about. */
const PROTEIN_PER_KG: Record<GoalType, number> = {
  'fat-loss': 2.0,
  'muscle-gain': 1.8,
  recomp: 2.0,
  maintenance: 1.6,
  general: 1.4,
  custom: 1.6,
}

const STEP_TARGET: Record<ActivityLevel, number> = {
  sedentary: 6000,
  light: 8000,
  moderate: 10000,
  very: 12000,
  extreme: 12000,
}

const WORKOUTS_PER_WEEK: Record<GoalType, number> = {
  'fat-loss': 4,
  'muscle-gain': 5,
  recomp: 4,
  maintenance: 3,
  general: 3,
  custom: 4,
}

/**
 * Suggested daily targets. Floored at a safe intake (1,400 kcal female-leaning,
 * 1,600 male) so an aggressive deficit never produces a dangerous number.
 */
export function suggestTargets(
  p: Pick<Profile, 'heightCm' | 'age' | 'sex' | 'activity' | 'goal' | 'experience'>,
  weightKg: number,
): Targets {
  const maintenance = tdee(p, weightKg)
  const floor = p.sex === 'female' ? 1400 : 1600
  const calories = Math.max(floor, Math.round((maintenance * (1 + GOAL_OFFSET[p.goal])) / 10) * 10)

  const protein = Math.round(weightKg * PROTEIN_PER_KG[p.goal])
  // Fat at 25% of intake, carbs take the remainder. 9 kcal/g fat, 4 kcal/g carb.
  const fat = Math.round((calories * 0.25) / 9)
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4))

  return {
    calories,
    protein,
    carbs,
    fat,
    steps: STEP_TARGET[p.activity],
    sleepHours: 7.5,
    workoutsPerWeek: WORKOUTS_PER_WEEK[p.goal],
  }
}

/* --------------------------- weight & trend ------------------------------ */

export interface WeightStats {
  start: number | null
  current: number | null
  target: number
  /** signed: negative means lost */
  change: number | null
  /** 0–100, clamped; how far between start and target */
  progressPct: number
  remaining: number | null
  /** 7-day exponentially-weighted trend, resistant to a single salty-dinner spike */
  trend: number | null
  /** kg per week from the trend line over the window */
  ratePerWeek: number | null
  weeklyAverage: number | null
  entries: WeightEntry[]
}

const byDate = (a: { date: DateKey }, b: { date: DateKey }) => (a.date < b.date ? -1 : 1)

export function weightStats(data: AppData): WeightStats {
  const p = data.profile
  const entries = [...data.weights].sort(byDate)
  const target = p?.targetWeightKg ?? 0
  const start = p?.startWeightKg ?? entries[0]?.kg ?? null
  const current = entries.at(-1)?.kg ?? start

  const change = start != null && current != null ? current - start : null
  const remaining = current != null ? current - target : null

  let progressPct = 0
  if (start != null && current != null && start !== target) {
    progressPct = clamp(((start - current) / (start - target)) * 100, 0, 100)
  }

  return {
    start,
    current,
    target,
    change,
    progressPct,
    remaining,
    trend: ewmaTrend(entries),
    ratePerWeek: ratePerWeek(entries),
    weeklyAverage: averageOf(entries.filter((e) => e.date >= addDays(today(), -6)).map((e) => e.kg)),
    entries,
  }
}

/**
 * Exponentially weighted moving average over the last 14 entries, alpha 0.25.
 * This is the number shown as "trend" — it moves slower than the scale, which is
 * the point: it stops a 0.8 kg water swing reading as failure.
 */
export function ewmaTrend(entries: WeightEntry[], alpha = 0.25): number | null {
  const recent = entries.slice(-14)
  if (!recent.length) return null
  let acc = recent[0].kg
  for (let i = 1; i < recent.length; i++) acc = alpha * recent[i].kg + (1 - alpha) * acc
  return round(acc, 2)
}

/** Least-squares slope over the last 28 days, converted to kg/week. */
export function ratePerWeek(entries: WeightEntry[], windowDays = 28): number | null {
  const from = addDays(today(), -windowDays)
  const pts = entries
    .filter((e) => e.date >= from)
    .map((e) => ({ x: daysBetween(from, e.date), y: e.kg }))
  if (pts.length < 3) return null

  const n = pts.length
  const sx = pts.reduce((a, p) => a + p.x, 0)
  const sy = pts.reduce((a, p) => a + p.y, 0)
  const sxy = pts.reduce((a, p) => a + p.x * p.y, 0)
  const sxx = pts.reduce((a, p) => a + p.x * p.x, 0)
  const denom = n * sxx - sx * sx
  if (denom === 0) return null
  return round(((n * sxy - sx * sy) / denom) * 7, 3)
}

export type Confidence = 'none' | 'low' | 'medium' | 'high'

export interface Prediction {
  /** null when the trend points away from the target, or data is too thin */
  date: DateKey | null
  weeksAway: number | null
  ratePerWeek: number | null
  confidence: Confidence
  /** why there's no date — surfaced verbatim in the UI */
  reason?: 'no-data' | 'flat' | 'wrong-way' | 'reached'
}

/**
 * Goal date estimate from the *actual* trend, not from the planned deficit.
 * Deliberately refuses to answer when the data can't support it — the brief asks
 * for estimates, and an estimate that pretends to precision is worse than none.
 */
export function predictGoal(data: AppData): Prediction {
  const s = weightStats(data)
  const rate = s.ratePerWeek
  const current = s.trend ?? s.current

  if (current == null || s.entries.length < 3 || rate == null) {
    return { date: null, weeksAway: null, ratePerWeek: rate, confidence: 'none', reason: 'no-data' }
  }

  const gap = s.target - current
  if (Math.abs(gap) < 0.3) {
    return { date: today(), weeksAway: 0, ratePerWeek: rate, confidence: 'high', reason: 'reached' }
  }
  if (Math.abs(rate) < 0.05) {
    return { date: null, weeksAway: null, ratePerWeek: rate, confidence: 'low', reason: 'flat' }
  }
  if (Math.sign(gap) !== Math.sign(rate)) {
    return {
      date: null,
      weeksAway: null,
      ratePerWeek: rate,
      confidence: 'low',
      reason: 'wrong-way',
    }
  }

  const weeks = gap / rate
  const span = s.entries.length
  const confidence: Confidence = span >= 21 ? 'high' : span >= 10 ? 'medium' : 'low'
  return {
    date: addDays(today(), Math.round(weeks * 7)),
    weeksAway: round(weeks, 1),
    ratePerWeek: rate,
    confidence,
  }
}

/* ------------------------------ day rollup ------------------------------- */

export interface DayTotals {
  calories: number
  protein: number
  carbs: number
  fat: number
  steps: number
  cardioMinutes: number
  cardioKm: number
  sleepMinutes: number
  workouts: number
  volumeKg: number
  weightKg: number | null
  habitsDone: number
  habitsTotal: number
  checkIn: CheckIn | null
  photos: number
}

export function dayTotals(data: AppData, date: DateKey): DayTotals {
  const meals = data.meals.filter((m) => m.date === date)
  let calories = 0
  let protein = 0
  let carbs = 0
  let fat = 0
  for (const m of meals) {
    for (const i of m.items) {
      calories += i.calories * i.qty
      protein += i.protein * i.qty
      carbs += i.carbs * i.qty
      fat += i.fat * i.qty
    }
  }

  const cardio = data.cardio.filter((c) => c.date === date)
  const sessions = data.sessions.filter((s) => s.date === date && s.completed)
  const activeHabits = data.habits.filter((h) => !h.archived)

  return {
    calories: Math.round(calories),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
    steps: data.steps.find((s) => s.date === date)?.steps ?? 0,
    cardioMinutes: cardio.reduce((a, c) => a + c.minutes, 0),
    cardioKm: round(cardio.reduce((a, c) => a + (c.distanceKm ?? 0), 0), 2),
    sleepMinutes: data.sleep.find((s) => s.date === date)?.minutes ?? 0,
    workouts: sessions.length,
    volumeKg: Math.round(sessions.reduce((a, s) => a + s.volumeKg, 0)),
    weightKg: data.weights.find((w) => w.date === date)?.kg ?? null,
    habitsDone: effectiveHabits(data, date).length,
    habitsTotal: activeHabits.length,
    checkIn: data.checkIns.find((c) => c.date === date) ?? null,
    photos: data.photos.filter((p) => p.date === date).length,
  }
}

/**
 * Habits marked done, including auto habits the data already satisfies. An
 * "auto" habit is never tapped — hitting the protein target ticks it. That is
 * the minimum-input rule applied to habit tracking.
 */
export function effectiveHabits(data: AppData, date: DateKey): string[] {
  const manual = new Set(data.habitLog[date] ?? [])
  const t = data.profile?.targets
  if (!t) return [...manual]

  const meals = data.meals.filter((m) => m.date === date)
  const protein = meals.reduce(
    (a, m) => a + m.items.reduce((b, i) => b + i.protein * i.qty, 0),
    0,
  )
  const calories = meals.reduce(
    (a, m) => a + m.items.reduce((b, i) => b + i.calories * i.qty, 0),
    0,
  )
  const steps = data.steps.find((s) => s.date === date)?.steps ?? 0
  const sleepMin = data.sleep.find((s) => s.date === date)?.minutes ?? 0
  const didWorkout = data.sessions.some((s) => s.date === date && s.completed)

  for (const h of data.habits) {
    if (h.archived || !h.auto) continue
    const hit =
      (h.auto === 'protein' && protein >= t.protein * 0.95) ||
      (h.auto === 'calories' && calories > 0 && calories <= t.calories * 1.05) ||
      (h.auto === 'steps' && steps >= t.steps) ||
      (h.auto === 'sleep' && sleepMin >= t.sleepHours * 60 * 0.9) ||
      (h.auto === 'workout' && didWorkout)
    if (hit) manual.add(h.id)
  }
  return [...manual]
}

/* -------------------------- transformation score -------------------------- */

export interface ScorePart {
  key: 'workout' | 'nutrition' | 'protein' | 'movement' | 'sleep' | 'habits' | 'checkin'
  label: string
  /** 0–1 completion */
  value: number
  weight: number
  /** true when the day has no data for this input at all */
  empty: boolean
}

export interface Score {
  total: number
  parts: ScorePart[]
  /** kiln step 1–5, drives the ring colour */
  heat: 1 | 2 | 3 | 4 | 5
}

/**
 * Transformation score out of 100 (spec §29). Seven weighted inputs. The parts
 * are returned alongside the total because the Forge Ring paints one arc per
 * part — the score is only useful if you can see which input is cold.
 *
 * Nutrition scores a *band*, not a ceiling: eating 1,200 of a 2,200 target is
 * not a win, so the curve peaks inside 90–105% of target and falls off both
 * sides. A workout on a planned rest day still scores, it just isn't required.
 */
export function dayScore(data: AppData, date: DateKey): Score {
  const t = data.profile?.targets
  const d = dayTotals(data, date)
  const restDay = isRestDay(data, date)

  const parts: ScorePart[] = []
  const push = (
    key: ScorePart['key'],
    label: string,
    value: number,
    weight: number,
    empty: boolean,
  ) => parts.push({ key, label, value: clamp(value, 0, 1), weight, empty })

  if (!t) return { total: 0, parts, heat: 1 }

  // Training — on a rest day, resting IS the plan, so it scores full.
  push('workout', 'Training', restDay ? 1 : d.workouts > 0 ? 1 : 0, 22, !restDay && d.workouts === 0)

  // Calories — band around the target.
  push('nutrition', 'Calories', bandScore(d.calories, t.calories), 18, d.calories === 0)

  // Protein — a floor, not a band. More is fine.
  push('protein', 'Protein', d.protein / t.protein, 18, d.protein === 0)

  // Movement — steps, with cardio minutes able to cover a low-step day.
  const movement = Math.max(d.steps / t.steps, d.cardioMinutes / 45)
  push('movement', 'Movement', movement, 15, d.steps === 0 && d.cardioMinutes === 0)

  // Sleep — band; 10 hours isn't better than 8.
  push('sleep', 'Sleep', bandScore(d.sleepMinutes / 60, t.sleepHours, 0.12), 12, d.sleepMinutes === 0)

  push(
    'habits',
    'Habits',
    d.habitsTotal ? d.habitsDone / d.habitsTotal : 1,
    10,
    d.habitsTotal > 0 && d.habitsDone === 0,
  )

  push('checkin', 'Check-in', d.checkIn ? 1 : 0, 5, !d.checkIn)

  const total = Math.round(parts.reduce((a, p) => a + p.value * p.weight, 0))
  return { total, parts, heat: heatStep(total) }
}

/** 1 at target, tapering to 0 by `tolerance` either side (as a fraction). */
function bandScore(actual: number, target: number, tolerance = 0.3): number {
  if (!target) return 0
  if (actual === 0) return 0
  const ratio = actual / target
  // peak plateau slightly above target so hitting it exactly isn't punished
  if (ratio >= 0.9 && ratio <= 1.05) return 1
  const dist = ratio < 0.9 ? 0.9 - ratio : ratio - 1.05
  return clamp(1 - dist / tolerance, 0, 1)
}

export function heatStep(score: number): 1 | 2 | 3 | 4 | 5 {
  if (score >= 90) return 5
  if (score >= 75) return 4
  if (score >= 55) return 3
  if (score >= 35) return 2
  return 1
}

export function isRestDay(data: AppData, date: DateKey): boolean {
  const plan = data.plans.find((p) => p.id === data.activePlanId)
  if (!plan) return false
  const weekday = new Date(date + 'T00:00:00').getDay()
  const day = plan.days.find((d) => d.weekday === weekday)
  return day?.rest ?? false
}

export function averageScore(data: AppData, dates: DateKey[]): number {
  if (!dates.length) return 0
  return Math.round(dates.reduce((a, d) => a + dayScore(data, d).total, 0) / dates.length)
}

/* --------------------------------- streak -------------------------------- */

/**
 * Current streak = consecutive days back from today scoring >= 50, with today
 * forgiven until it has any data at all. Without that forgiveness the streak
 * would read 0 every morning, which is demoralising and wrong.
 */
export function currentStreak(data: AppData): number {
  let streak = 0
  let cursor = today()
  const t0 = dayTotals(data, cursor)
  const todayHasData =
    t0.calories > 0 || t0.workouts > 0 || t0.steps > 0 || t0.habitsDone > 0 || !!t0.checkIn
  if (!todayHasData) cursor = addDays(cursor, -1)

  for (let i = 0; i < 400; i++) {
    if (dayScore(data, cursor).total < 50) break
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}

export function longestStreak(data: AppData): number {
  const start = data.profile?.createdAt ?? today()
  let best = 0
  let run = 0
  let cursor = start
  while (cursor <= today()) {
    if (dayScore(data, cursor).total >= 50) {
      run++
      best = Math.max(best, run)
    } else run = 0
    cursor = addDays(cursor, 1)
  }
  return best
}

/* ----------------------------- training maths ---------------------------- */

/** Epley. Used for the "best performance" PR and progression suggestions. */
export function estimate1rm(weightKg: number, reps: number): number {
  if (reps <= 0) return 0
  if (reps === 1) return weightKg
  return round(weightKg * (1 + reps / 30), 1)
}

export function sessionVolume(sets: SetEntry[]): number {
  return Math.round(sets.filter((s) => s.done).reduce((a, s) => a + s.weightKg * s.reps, 0))
}

export interface LastPerformance {
  date: DateKey
  topSet: SetEntry
  sets: SetEntry[]
  volumeKg: number
}

/** The "Last workout: 20 kg × 10" line, pulled from the most recent session. */
export function lastPerformance(
  sessions: WorkoutSession[],
  exerciseId: string,
  before?: DateKey,
): LastPerformance | null {
  const candidates = sessions
    .filter(
      (s) =>
        s.completed &&
        (!before || s.date < before) &&
        s.sets.some((x) => x.exerciseId === exerciseId && x.done),
    )
    .sort(byDate)
  const s = candidates.at(-1)
  if (!s) return null

  const sets = s.sets.filter((x) => x.exerciseId === exerciseId && x.done)
  const topSet = sets.reduce((a, b) =>
    estimate1rm(b.weightKg, b.reps) > estimate1rm(a.weightKg, a.reps) ? b : a,
  )
  return {
    date: s.date,
    topSet,
    sets,
    volumeKg: Math.round(sets.reduce((a, x) => a + x.weightKg * x.reps, 0)),
  }
}

export interface Progression {
  weightKg: number
  repLow: number
  repHigh: number
  rationale: 'add-load' | 'add-reps' | 'hold' | 'deload' | 'first-time'
  /** smallest sensible increment for the equipment — 2.5 kg plates, 1.25 kg micro */
  step: number
}

/**
 * Opening load for an exercise nobody has logged yet. There is no honest
 * suggestion to make here — the app has no data — so these are conservative
 * "somewhere to start adjusting from" values, deliberately light. The UI labels
 * them as a starting point rather than a recommendation.
 */
const STARTING_LOAD_KG: Record<Equipment, number> = {
  barbells: 20, // an empty olympic bar
  'full-gym': 20,
  machines: 15,
  cables: 10,
  dumbbells: 7.5, // per hand
  bands: 0,
  bodyweight: 0,
}

export function startingLoad(equipment: Equipment, isBodyweight = false): number {
  if (isBodyweight) return 0
  return STARTING_LOAD_KG[equipment] ?? 10
}

/**
 * Smart progression (spec §15). Reads the last session's top set, its RPE and
 * whether the rep target was met, then moves one variable — load or reps, never
 * both. RPE is treated as advisory because it is optional input.
 */
export function suggestProgression(
  last: LastPerformance | null,
  repRange: [number, number] = [8, 12],
  isBodyweight = false,
  equipment: Equipment = 'barbells',
): Progression {
  const [lo, hi] = repRange
  if (!last) {
    return {
      weightKg: startingLoad(equipment, isBodyweight),
      repLow: lo,
      repHigh: hi,
      rationale: 'first-time',
      step: isBodyweight ? 0 : 2.5,
    }
  }

  const { weightKg, reps, rpe } = last.topSet
  const step = isBodyweight ? 0 : weightKg < 20 ? 1.25 : weightKg < 60 ? 2.5 : 5
  const hardSet = rpe != null && rpe >= 9.5
  const easySet = rpe != null && rpe <= 7

  // Three failed-feeling sessions in a row is the deload signal we can see from
  // one data point: top of range not reached AND the set was maximal.
  if (reps < lo && hardSet) {
    return {
      weightKg: round(Math.max(0, weightKg - step * 2), 2),
      repLow: lo,
      repHigh: hi,
      rationale: 'deload',
      step,
    }
  }

  if (reps >= hi && !hardSet) {
    if (isBodyweight) {
      return { weightKg: 0, repLow: reps + 1, repHigh: reps + 3, rationale: 'add-reps', step: 0 }
    }
    const bump = easySet ? step * 2 : step
    return {
      weightKg: round(weightKg + bump, 2),
      repLow: lo,
      repHigh: Math.min(hi, lo + 2),
      rationale: 'add-load',
      step,
    }
  }

  if (reps < hi) {
    return {
      weightKg,
      repLow: Math.min(hi, reps + 1),
      repHigh: hi,
      rationale: 'add-reps',
      step,
    }
  }

  return { weightKg, repLow: lo, repHigh: hi, rationale: 'hold', step }
}

/** Recompute the PR row for one exercise from the full session history. */
export function computeRecord(
  sessions: WorkoutSession[],
  exerciseId: string,
): PersonalRecord | null {
  const sets: Array<SetEntry & { date: DateKey }> = []
  for (const s of sessions) {
    if (!s.completed) continue
    for (const x of s.sets) if (x.exerciseId === exerciseId && x.done && x.reps > 0) {
      sets.push({ ...x, date: s.date })
    }
  }
  if (!sets.length) return null

  const heaviest = sets.reduce((a, b) => (b.weightKg > a.weightKg ? b : a))
  const mostReps = sets.reduce((a, b) => (b.reps > a.reps ? b : a))
  const best1 = sets.reduce((a, b) =>
    estimate1rm(b.weightKg, b.reps) > estimate1rm(a.weightKg, a.reps) ? b : a,
  )

  return {
    id: exerciseId,
    exerciseId,
    bestWeightKg: heaviest.weightKg,
    bestWeightReps: heaviest.reps,
    bestWeightDate: heaviest.date,
    bestReps: mostReps.reps,
    bestRepsWeightKg: mostReps.weightKg,
    bestRepsDate: mostReps.date,
    best1rmKg: estimate1rm(best1.weightKg, best1.reps),
    best1rmDate: best1.date,
  }
}

export interface PrHit {
  exerciseId: string
  kind: 'weight' | 'reps' | '1rm'
  value: number
  previous: number
}

/** PRs broken by a session, compared against records as they stood before it. */
export function detectPrs(
  session: WorkoutSession,
  priorSessions: WorkoutSession[],
): PrHit[] {
  const hits: PrHit[] = []
  const ids = [...new Set(session.sets.filter((s) => s.done).map((s) => s.exerciseId))]

  for (const id of ids) {
    const before = computeRecord(priorSessions, id)
    const after = computeRecord([...priorSessions, session], id)
    if (!after) continue
    if (!before) {
      hits.push({ exerciseId: id, kind: '1rm', value: after.best1rmKg, previous: 0 })
      continue
    }
    if (after.bestWeightKg > before.bestWeightKg) {
      hits.push({
        exerciseId: id,
        kind: 'weight',
        value: after.bestWeightKg,
        previous: before.bestWeightKg,
      })
    }
    if (after.bestReps > before.bestReps) {
      hits.push({ exerciseId: id, kind: 'reps', value: after.bestReps, previous: before.bestReps })
    }
    if (after.best1rmKg > before.best1rmKg + 0.4) {
      hits.push({ exerciseId: id, kind: '1rm', value: after.best1rmKg, previous: before.best1rmKg })
    }
  }
  return hits
}

/* -------------------------------- goals ---------------------------------- */

export interface GoalProgress {
  current: number
  target: number
  pct: number
  /** days left, negative when overdue */
  daysLeft: number | null
  done: boolean
  unit: string
}

export function goalProgress(data: AppData, g: Goal): GoalProgress {
  const to = today()
  const daysLeft = g.deadline ? daysBetween(to, g.deadline) : null
  const window = g.period === 'weekly' ? lastNDays(7) : g.period === 'daily' ? [to] : null

  let current = 0
  let unit = ''

  const sum = (fn: (d: DateKey) => number) =>
    (window ?? datesSince(g.startDate)).reduce((a, d) => a + fn(d), 0)

  switch (g.metric) {
    case 'weight': {
      const s = weightStats(data)
      const start = g.startValue ?? s.start ?? 0
      const cur = s.trend ?? s.current ?? start
      unit = 'kg'
      const span = start - g.target
      return {
        current: round(cur, 1),
        target: g.target,
        pct: span === 0 ? 100 : clamp(((start - cur) / span) * 100, 0, 100),
        daysLeft,
        done: span > 0 ? cur <= g.target : cur >= g.target,
        unit,
      }
    }
    case 'calories':
      current = Math.round(averageOf(window!.map((d) => dayTotals(data, d).calories)) ?? 0)
      unit = 'kcal/day'
      break
    case 'protein':
      current = Math.round(averageOf(window!.map((d) => dayTotals(data, d).protein)) ?? 0)
      unit = 'g/day'
      break
    case 'steps':
      current = g.period === 'total' ? sum((d) => dayTotals(data, d).steps) : Math.round(averageOf(window!.map((d) => dayTotals(data, d).steps)) ?? 0)
      unit = g.period === 'total' ? 'steps' : 'steps/day'
      break
    case 'workouts':
      current = sum((d) => dayTotals(data, d).workouts)
      unit = 'workouts'
      break
    case 'cardio-minutes':
      current = sum((d) => dayTotals(data, d).cardioMinutes)
      unit = 'min'
      break
    case 'sleep-hours':
      current = round(averageOf(window!.map((d) => dayTotals(data, d).sleepMinutes / 60)) ?? 0, 1)
      unit = 'h/night'
      break
    case 'challenge': {
      const c = data.challenges.find((x) => x.active)
      current = c ? clamp(daysBetween(c.startDate, to) + 1, 0, c.days) : 0
      unit = 'days'
      break
    }
  }

  const pct = g.target === 0 ? 0 : clamp((current / g.target) * 100, 0, 100)
  return { current, target: g.target, pct, daysLeft, done: pct >= 100, unit }
}

function datesSince(from: DateKey): DateKey[] {
  const n = Math.max(0, daysBetween(from, today()))
  return Array.from({ length: n + 1 }, (_, i) => addDays(from, i))
}

/* ------------------------------ weekly review ----------------------------- */

export interface WeeklyReview {
  weekStart: DateKey
  weekNumber: number
  weightChange: number | null
  avgCalories: number
  avgProtein: number
  workouts: number
  totalSteps: number
  avgSleepHours: number
  prs: number
  score: number
  volumeKg: number
  /** the single highest-leverage thing to change, derived from the weakest input */
  focus: { key: ScorePart['key']; label: string; message: string } | null
}

const FOCUS_COPY: Record<ScorePart['key'], string> = {
  workout: 'Get the planned sessions in. Consistency beats intensity this week.',
  nutrition: 'Keep calories inside the target band — log every meal, including snacks.',
  protein: 'Protein is the gap. Add one protein source to each meal.',
  movement: 'Add a 20-minute walk after dinner to close the step target.',
  sleep: 'Move lights-out 30 minutes earlier. Recovery is where the work lands.',
  habits: 'Pick the two habits that matter most and hit those daily.',
  checkin: 'Check in each evening — it takes 20 seconds and sharpens everything else.',
}

export function weeklyReview(data: AppData, anyDateInWeek: DateKey): WeeklyReview {
  const start = weekStart(anyDateInWeek)
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i)).filter((d) => d <= today())
  const totals = days.map((d) => dayTotals(data, d))

  const weighed = totals.filter((t) => t.weightKg != null)
  const weightChange =
    weighed.length >= 2 ? round(weighed.at(-1)!.weightKg! - weighed[0].weightKg!, 2) : null

  // Average nutrition over logged days only — zero-logged days would drag the
  // average into a lie.
  const loggedFood = totals.filter((t) => t.calories > 0)
  const slept = totals.filter((t) => t.sleepMinutes > 0)

  const sessions = data.sessions.filter(
    (s) => s.completed && s.date >= start && s.date <= addDays(start, 6),
  )

  // Weakest *required* input decides the focus line.
  const agg = new Map<ScorePart['key'], { sum: number; n: number; label: string }>()
  for (const d of days) {
    for (const p of dayScore(data, d).parts) {
      const row = agg.get(p.key) ?? { sum: 0, n: 0, label: p.label }
      row.sum += p.value
      row.n++
      agg.set(p.key, row)
    }
  }
  let focus: WeeklyReview['focus'] = null
  let worst = 1.1
  for (const [key, row] of agg) {
    const avg = row.sum / row.n
    if (avg < worst && avg < 0.85) {
      worst = avg
      focus = { key, label: row.label, message: FOCUS_COPY[key] }
    }
  }

  return {
    weekStart: start,
    weekNumber: data.profile ? weekNumberSince(data.profile.createdAt, start) : 1,
    weightChange,
    avgCalories: Math.round(averageOf(loggedFood.map((t) => t.calories)) ?? 0),
    avgProtein: Math.round(averageOf(loggedFood.map((t) => t.protein)) ?? 0),
    workouts: sessions.length,
    totalSteps: totals.reduce((a, t) => a + t.steps, 0),
    avgSleepHours: round(averageOf(slept.map((t) => t.sleepMinutes / 60)) ?? 0, 1),
    prs: countPrsInWeek(data, start),
    score: averageScore(data, days),
    volumeKg: Math.round(sessions.reduce((a, s) => a + s.volumeKg, 0)),
    focus,
  }
}

function weekNumberSince(createdAt: DateKey, start: DateKey): number {
  return Math.floor(daysBetween(weekStart(createdAt), start) / 7) + 1
}

function countPrsInWeek(data: AppData, start: DateKey): number {
  const end = addDays(start, 6)
  return data.records.filter(
    (r) =>
      (r.bestWeightDate >= start && r.bestWeightDate <= end) ||
      (r.best1rmDate >= start && r.best1rmDate <= end),
  ).length
}

/* ------------------------------- utilities ------------------------------- */

export function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n))
}

export function round(n: number, dp = 1) {
  const f = 10 ** dp
  return Math.round(n * f) / f
}

export function averageOf(xs: number[]): number | null {
  if (!xs.length) return null
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

export function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0)
}
