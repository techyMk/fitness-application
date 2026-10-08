/* ============================================================================
   App state. One document in a reducer, persisted on a debounce.

   Why a single document rather than per-entity stores: every interesting screen
   in this app is a cross-entity read (the score needs food + training + sleep +
   habits in one pass), so splitting state would mean joining it back together on
   every render. One document keeps reads trivial and writes atomic.

   Mutations are exposed as named actions on `useStore().actions` — screens never
   touch the reducer directly, so derived bookkeeping (PR recomputation,
   achievement unlocks, auto-habit ticks) happens in exactly one place.
   ========================================================================= */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type {
  AppData,
  CardioEntry,
  Challenge,
  CheckIn,
  CoachMessage,
  DashCard,
  DateKey,
  Exercise,
  Food,
  Goal,
  Habit,
  ID,
  MealEntry,
  MealType,
  NotificationPrefs,
  Phase,
  Profile,
  ProgressPhoto,
  SavedMeal,
  SetEntry,
  SleepEntry,
  Supplement,
  Theme,
  WeightEntry,
  WorkoutPlan,
  WorkoutSession,
} from './types'
import { computeRecord, detectPrs, sessionVolume, type PrHit } from './calc'
import { SEED_PLANS } from '../data/exercises'
import { newlyEarned } from '../data/achievements'
import { deleteBlob, loadDoc, putBlob, saveDoc } from './db'
import { addDays, today } from './date'

/* ------------------------------ initial data ----------------------------- */

/**
 * 1 → 2 added the sync fields (rev, tombstones, per-record write stamps).
 * migrate() fills them in additively, so a v1 document opens unchanged and
 * simply has no sync history until its first write.
 */
export const DATA_VERSION = 2

export const DEFAULT_DASHBOARD: DashCard[] = [
  { id: 'challenge', visible: true },
  { id: 'score', visible: true },
  { id: 'weight', visible: true },
  { id: 'nutrition', visible: true },
  { id: 'workout', visible: true },
  { id: 'movement', visible: true },
  { id: 'sleep', visible: true },
  { id: 'habits', visible: true },
  { id: 'records', visible: true },
]

const DEFAULT_NOTIFICATIONS: NotificationPrefs = {
  enabled: false,
  workout: true,
  checkIn: true,
  nutrition: false,
  protein: true,
  sleep: false,
  supplements: false,
  challenge: true,
  goals: false,
  checkInTime: '20:30',
  workoutTime: '18:00',
}

/** Write stamp for sync. Module scope so record factories can reach it too. */
const now = () => Date.now()

function uid(prefix = ''): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}${Date.now().toString(36)}${rand}`
}

export function emptyData(): AppData {
  return {
    version: DATA_VERSION,
    profile: null,
    weights: [],
    sessions: [],
    plans: SEED_PLANS,
    activePlanId: null,
    customExercises: [],
    records: [],
    nonGymRecords: [],
    meals: [],
    savedMeals: [],
    customFoods: [],
    cardio: [],
    steps: [],
    sleep: [],
    habits: [],
    habitLog: {},
    supplements: [],
    supplementLog: {},
    checkIns: [],
    photos: [],
    goals: [],
    challenges: [],
    phases: [],
    achievements: {},
    notifications: DEFAULT_NOTIFICATIONS,
    dashboard: DEFAULT_DASHBOARD,
    friends: [],
    coachLog: [],
    lastBackupAt: null,
    deviceId: uid('dev-'),

    rev: 0,
    syncedAt: null,
    deleted: {},
    habitLogAt: {},
    supplementLogAt: {},
    profileAt: 0,
    settingsAt: 0,
    stepsAt: {},
  }
}

/** Starter habits, seeded at onboarding. The auto ones are never tapped. */
function starterHabits(): Habit[] {
  const createdAt = today()
  return [
    { id: uid('h-'), updatedAt: now(), name: 'Train as planned', icon: 'dumbbell', auto: 'workout', createdAt },
    { id: uid('h-'), updatedAt: now(), name: 'Hit protein target', icon: 'beef', auto: 'protein', createdAt },
    { id: uid('h-'), updatedAt: now(), name: 'Hit step target', icon: 'footprints', auto: 'steps', createdAt },
    { id: uid('h-'), updatedAt: now(), name: 'No junk food', icon: 'ban', createdAt },
  ]
}

/* --------------------------------- actions -------------------------------- */

type Action =
  | { t: 'hydrate'; data: AppData }
  | { t: 'patch'; fn: (d: AppData) => AppData }

function reducer(state: AppData, action: Action): AppData {
  switch (action.t) {
    case 'hydrate':
      return action.data
    case 'patch':
      return action.fn(state)
  }
}

/* ------------------------- derived bookkeeping ---------------------------- */

/**
 * Runs after any mutation that could change records or unlock a badge. Kept in
 * one place so no screen can forget it.
 */
function reconcile(d: AppData): AppData {
  const exerciseIds = new Set<string>()
  for (const s of d.sessions) if (s.completed) for (const x of s.sets) exerciseIds.add(x.exerciseId)

  const records = [...exerciseIds]
    .map((id) => computeRecord(d.sessions, id))
    .filter((r): r is NonNullable<typeof r> => r != null)

  const nonGym = computeNonGymRecords(d)

  const withRecords: AppData = { ...d, records, nonGymRecords: nonGym }
  const unlocked = newlyEarned(withRecords)
  if (!unlocked.length) return withRecords

  const achievements = { ...withRecords.achievements }
  for (const id of unlocked) achievements[id] = today()
  return { ...withRecords, achievements }
}

function computeNonGymRecords(d: AppData): AppData['nonGymRecords'] {
  const out: AppData['nonGymRecords'] = []

  // Fastest 5K — from any cardio entry covering at least 5 km.
  const fiveKs = d.cardio.filter((c) => (c.distanceKm ?? 0) >= 5)
  if (fiveKs.length) {
    const best = fiveKs.reduce((a, b) =>
      b.minutes / (b.distanceKm ?? 1) < a.minutes / (a.distanceKm ?? 1) ? b : a,
    )
    const pace = best.minutes / (best.distanceKm ?? 1)
    out.push({ key: 'fastest-5k', value: Math.round(pace * 5), date: best.date, label: 'min' })
  }

  const longest = d.cardio.reduce<CardioEntry | null>(
    (a, b) => (!a || b.minutes > a.minutes ? b : a),
    null,
  )
  if (longest) {
    out.push({ key: 'longest-cardio', value: longest.minutes, date: longest.date, label: 'min' })
  }

  const topSteps = d.steps.reduce<AppData['steps'][number] | null>(
    (a, b) => (!a || b.steps > a.steps ? b : a),
    null,
  )
  if (topSteps) {
    out.push({ key: 'highest-steps', value: topSteps.steps, date: topSteps.date, label: 'steps' })
  }

  const longestWorkout = d.sessions
    .filter((s) => s.completed && s.durationSec)
    .reduce<WorkoutSession | null>((a, b) => (!a || b.durationSec! > a.durationSec! ? b : a), null)
  if (longestWorkout) {
    out.push({
      key: 'longest-workout',
      value: Math.round(longestWorkout.durationSec! / 60),
      date: longestWorkout.date,
      label: 'min',
    })
  }

  // Most workouts in any rolling calendar month.
  const byMonth = new Map<string, number>()
  for (const s of d.sessions) {
    if (!s.completed) continue
    const k = s.date.slice(0, 7)
    byMonth.set(k, (byMonth.get(k) ?? 0) + 1)
  }
  if (byMonth.size) {
    const [month, count] = [...byMonth.entries()].reduce((a, b) => (b[1] > a[1] ? b : a))
    out.push({ key: 'most-workouts-month', value: count, date: `${month}-01`, label: 'workouts' })
  }

  return out
}

/* ------------------------------- the context ----------------------------- */

export interface Actions {
  /* profile & settings */
  completeOnboarding: (profile: Omit<Profile, 'id' | 'createdAt'>, planId: ID | null) => void
  updateProfile: (patch: Partial<Profile>) => void
  setTheme: (theme: Theme) => void
  setDashboard: (cards: DashCard[]) => void
  setNotifications: (patch: Partial<NotificationPrefs>) => void

  /* weight */
  logWeight: (kg: number, date?: DateKey, note?: string) => void
  deleteWeight: (id: ID) => void

  /* training */
  startSession: (title: string, planId?: ID, dayIndex?: number) => WorkoutSession
  updateSession: (id: ID, patch: Partial<WorkoutSession>) => void
  addSet: (sessionId: ID, set: Omit<SetEntry, 'id'>) => void
  updateSet: (sessionId: ID, setId: ID, patch: Partial<SetEntry>) => void
  removeSet: (sessionId: ID, setId: ID) => void
  finishSession: (id: ID) => PrHit[]
  discardSession: (id: ID) => void
  savePlan: (plan: WorkoutPlan) => void
  deletePlan: (id: ID) => void
  setActivePlan: (id: ID | null) => void
  addCustomExercise: (e: Omit<Exercise, 'id' | 'custom'>) => Exercise
  deleteCustomExercise: (id: ID) => void

  /* nutrition */
  addMealItems: (date: DateKey, type: MealType, items: MealEntry['items']) => void
  removeMealItem: (mealId: ID, itemId: ID) => void
  updateMealItem: (mealId: ID, itemId: ID, patch: Partial<MealEntry['items'][number]>) => void
  saveMeal: (meal: Omit<SavedMeal, 'id'>) => void
  deleteSavedMeal: (id: ID) => void
  addCustomFood: (food: Omit<Food, 'id' | 'custom'>) => Food
  deleteCustomFood: (id: ID) => void

  /* movement & recovery */
  logCardio: (entry: Omit<CardioEntry, 'id'>) => void
  deleteCardio: (id: ID) => void
  logSteps: (date: DateKey, steps: number) => void
  logSleep: (entry: Omit<SleepEntry, 'id'>) => void
  deleteSleep: (id: ID) => void

  /* consistency */
  toggleHabit: (habitId: ID, date: DateKey) => void
  addHabit: (habit: Omit<Habit, 'id' | 'createdAt'>) => void
  updateHabit: (id: ID, patch: Partial<Habit>) => void
  deleteHabit: (id: ID) => void
  toggleSupplement: (id: ID, date: DateKey) => void
  addSupplement: (s: Omit<Supplement, 'id'>) => void
  deleteSupplement: (id: ID) => void
  saveCheckIn: (entry: Omit<CheckIn, 'completedAt'>) => void

  /* photos */
  addPhoto: (file: Blob, angle: ProgressPhoto['angle'], date: DateKey, weightKg?: number) => Promise<void>
  updatePhoto: (id: ID, patch: Partial<ProgressPhoto>) => void
  deletePhoto: (id: ID) => Promise<void>

  /* planning */
  addGoal: (g: Omit<Goal, 'id'>) => void
  updateGoal: (id: ID, patch: Partial<Goal>) => void
  deleteGoal: (id: ID) => void
  startChallenge: (c: Omit<Challenge, 'id' | 'active' | 'endDate'>) => void
  endChallenge: (id: ID, completed: boolean) => void
  addPhase: (p: Omit<Phase, 'id'>) => void
  updatePhase: (id: ID, patch: Partial<Phase>) => void
  deletePhase: (id: ID) => void

  /* coach */
  appendCoach: (m: Omit<CoachMessage, 'id' | 'at'>) => void
  clearCoach: () => void

  /* system */
  importData: (data: AppData) => void
  markBackedUp: () => void
  resetAll: () => void
}

interface StoreValue {
  data: AppData
  ready: boolean
  actions: Actions
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(reducer, null, emptyData)
  const [ready, setReady] = useState(false)
  const firstRun = useRef(true)

  // Hydrate once.
  useEffect(() => {
    let alive = true
    loadDoc<AppData>()
      .then((doc) => {
        if (!alive) return
        if (doc) dispatch({ t: 'hydrate', data: migrate(doc) })
        setReady(true)
      })
      .catch(() => setReady(true))
    return () => {
      alive = false
    }
  }, [])

  // Persist on a 400 ms debounce. Skips the first post-hydration render so we
  // never write back the same document we just read.
  useEffect(() => {
    if (!ready) return
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    const id = window.setTimeout(() => void saveDoc(data), 400)
    return () => window.clearTimeout(id)
  }, [data, ready])

  // Flush synchronously if the app is backgrounded mid-debounce.
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === 'hidden') void saveDoc(data)
    }
    document.addEventListener('visibilitychange', flush)
    return () => document.removeEventListener('visibilitychange', flush)
  }, [data])

  const actions = useMemo<Actions>(() => {
    const patch = (fn: (d: AppData) => AppData) => dispatch({ t: 'patch', fn })
    /** patch + reconcile, for anything that can move a record or badge */
    const patchR = (fn: (d: AppData) => AppData) => patch((d) => reconcile(fn(d)))

    /** Record a tombstone so the deletion survives a merge with another device. */
    const tomb = (d: AppData, ...ids: ID[]): AppData => ({
      ...d,
      deleted: { ...d.deleted, ...Object.fromEntries(ids.map((id) => [id, now()])) },
    })

    return {
      /* ---------------------------- profile ---------------------------- */
      completeOnboarding(profile, planId) {
        patchR((d) => ({
          ...d,
          profile: { ...profile, id: uid('u-'), createdAt: today() },
          profileAt: now(),
          activePlanId: planId,
          habits: d.habits.length ? d.habits : starterHabits(),
          weights: d.weights.length
            ? d.weights
            : [{ id: uid('w-'), updatedAt: now(), date: today(), kg: profile.startWeightKg }],
        }))
      },

      updateProfile(p) {
        patchR((d) => (d.profile ? { ...d, profile: { ...d.profile, ...p }, profileAt: now() } : d))
      },

      setTheme(theme) {
        patch((d) => (d.profile ? { ...d, profile: { ...d.profile, theme }, profileAt: now() } : d))
      },

      setDashboard(dashboard) {
        patch((d) => ({ ...d, dashboard, settingsAt: now() }))
      },

      setNotifications(p) {
        patch((d) => ({ ...d, notifications: { ...d.notifications, ...p }, settingsAt: now() }))
      },

      /* ----------------------------- weight ---------------------------- */
      logWeight(kg, date = today(), note) {
        patchR((d) => {
          const existing = d.weights.find((w) => w.date === date)
          const weights = existing
            ? d.weights.map((w) => (w.date === date ? { ...w, kg, note, updatedAt: now() } : w))
            : [...d.weights, { id: uid('w-'), updatedAt: now(), date, kg, note } satisfies WeightEntry]
          return { ...d, weights }
        })
      },

      deleteWeight(id) {
        patchR((d) => tomb({ ...d, weights: d.weights.filter((w) => w.id !== id) }, id))
      },

      /* ---------------------------- training --------------------------- */
      startSession(title, planId, dayIndex) {
        const session: WorkoutSession = {
          id: uid('s-'), updatedAt: now(),
          date: today(),
          planId,
          dayIndex,
          title,
          startedAt: Date.now(),
          sets: [],
          volumeKg: 0,
          completed: false,
        }
        patch((d) => ({ ...d, sessions: [...d.sessions, session] }))
        return session
      },

      updateSession(id, p) {
        patch((d) => ({
          ...d,
          sessions: d.sessions.map((s) => (s.id === id ? { ...s, ...p, updatedAt: now() } : s)),
        }))
      },

      addSet(sessionId, set) {
        patch((d) => ({
          ...d,
          sessions: d.sessions.map((s) =>
            s.id === sessionId ? { ...s, sets: [...s.sets, { ...set, id: uid('set-'), updatedAt: now() }] } : s,
          ),
        }))
      },

      updateSet(sessionId, setId, p) {
        patch((d) => ({
          ...d,
          sessions: d.sessions.map((s) =>
            s.id === sessionId
              ? { ...s, sets: s.sets.map((x) => (x.id === setId ? { ...x, ...p, updatedAt: now() } : x)) }
              : s,
          ),
        }))
      },

      removeSet(sessionId, setId) {
        patch((d) => ({
          ...d,
          sessions: d.sessions.map((s) =>
            s.id === sessionId ? { ...s, sets: s.sets.filter((x) => x.id !== setId) } : s,
          ),
        }))
      },

      /**
       * Closes a session and returns the PRs it broke, so the screen can show the
       * "new record" moment. PRs are detected against the state *before* this
       * session is marked complete, which is why detection happens here and not
       * in reconcile().
       */
      finishSession(id) {
        let hits: PrHit[] = []
        patchR((d) => {
          const session = d.sessions.find((s) => s.id === id)
          if (!session) return d

          const done = session.sets.filter((x) => x.done)
          const finished: WorkoutSession = {
            ...session,
            sets: done,
            completed: true,
            endedAt: Date.now(),
            durationSec: Math.round((Date.now() - session.startedAt) / 1000),
            volumeKg: sessionVolume(done),
          }
          const prior = d.sessions.filter((s) => s.id !== id && s.completed)
          hits = detectPrs(finished, prior)

          return { ...d, sessions: d.sessions.map((s) => (s.id === id ? finished : s)) }
        })
        return hits
      },

      discardSession(id) {
        patch((d) => tomb({ ...d, sessions: d.sessions.filter((s) => s.id !== id) }, id))
      },

      savePlan(plan) {
        patch((d) => {
          const exists = d.plans.some((p) => p.id === plan.id)
          return {
            ...d,
            plans: exists ? d.plans.map((p) => (p.id === plan.id ? plan : p)) : [...d.plans, plan],
          }
        })
      },

      deletePlan(id) {
        patch((d) =>
          tomb(
            {
              ...d,
              plans: d.plans.filter((p) => p.id !== id),
              activePlanId: d.activePlanId === id ? null : d.activePlanId,
              settingsAt: now(),
            },
            id,
          ),
        )
      },

      setActivePlan(id) {
        patch((d) => ({ ...d, activePlanId: id, settingsAt: now() }))
      },

      addCustomExercise(e) {
        const created: Exercise = { ...e, id: uid('ex-'), updatedAt: now(), custom: true }
        patch((d) => ({ ...d, customExercises: [...d.customExercises, created] }))
        return created
      },

      deleteCustomExercise(id) {
        patch((d) => tomb({ ...d, customExercises: d.customExercises.filter((e) => e.id !== id) }, id))
      },

      /* ---------------------------- nutrition -------------------------- */
      addMealItems(date, type, items) {
        patchR((d) => {
          const existing = d.meals.find((m) => m.date === date && m.type === type)
          if (existing) {
            return {
              ...d,
              meals: d.meals.map((m) =>
                m.id === existing.id ? { ...m, items: [...m.items, ...items] } : m,
              ),
            }
          }
          const meal: MealEntry = { id: uid('m-'), updatedAt: now(), date, type, items, loggedAt: Date.now() }
          return { ...d, meals: [...d.meals, meal] }
        })
      },

      removeMealItem(mealId, itemId) {
        patchR((d) => {
          const meals = d.meals
            .map((m) =>
              m.id === mealId
                ? { ...m, items: m.items.filter((i) => i.id !== itemId), updatedAt: now() }
                : m,
            )
            // an empty meal row is noise — drop it
            .filter((m) => m.items.length > 0)
          // If the row went away entirely it is a deletion, not an edit.
          const vanished = !meals.some((m) => m.id === mealId)
          return vanished ? tomb({ ...d, meals }, mealId) : { ...d, meals }
        })
      },

      updateMealItem(mealId, itemId, p) {
        patchR((d) => ({
          ...d,
          meals: d.meals.map((m) =>
            m.id === mealId
              ? { ...m, items: m.items.map((i) => (i.id === itemId ? { ...i, ...p, updatedAt: now() } : i)) }
              : m,
          ),
        }))
      },

      saveMeal(meal) {
        patch((d) => ({ ...d, savedMeals: [...d.savedMeals, { ...meal, id: uid('sm-'), updatedAt: now() }] }))
      },

      deleteSavedMeal(id) {
        patch((d) => tomb({ ...d, savedMeals: d.savedMeals.filter((m) => m.id !== id) }, id))
      },

      addCustomFood(food) {
        const created: Food = { ...food, id: uid('f-'), updatedAt: now(), custom: true }
        patch((d) => ({ ...d, customFoods: [...d.customFoods, created] }))
        return created
      },

      deleteCustomFood(id) {
        patch((d) => tomb({ ...d, customFoods: d.customFoods.filter((f) => f.id !== id) }, id))
      },

      /* ----------------------- movement & recovery --------------------- */
      logCardio(entry) {
        patchR((d) => ({ ...d, cardio: [...d.cardio, { ...entry, id: uid('c-'), updatedAt: now() }] }))
      },

      deleteCardio(id) {
        patchR((d) => tomb({ ...d, cardio: d.cardio.filter((c) => c.id !== id) }, id))
      },

      logSteps(date, steps) {
        patchR((d) => {
          const exists = d.steps.some((s) => s.date === date)
          return {
            ...d,
            steps: exists
              ? d.steps.map((s) => (s.date === date ? { date, steps } : s))
              : [...d.steps, { date, steps }],
            stepsAt: { ...d.stepsAt, [date]: now() },
          }
        })
      },

      logSleep(entry) {
        patchR((d) => {
          const existing = d.sleep.find((s) => s.date === entry.date)
          return {
            ...d,
            sleep: existing
              ? d.sleep.map((s) => (s.date === entry.date ? { ...s, ...entry, updatedAt: now() } : s))
              : [...d.sleep, { ...entry, id: uid('sl-'), updatedAt: now() }],
          }
        })
      },

      deleteSleep(id) {
        patchR((d) => tomb({ ...d, sleep: d.sleep.filter((s) => s.id !== id) }, id))
      },

      /* --------------------------- consistency ------------------------- */
      toggleHabit(habitId, date) {
        patchR((d) => {
          const list = d.habitLog[date] ?? []
          const next = list.includes(habitId)
            ? list.filter((x) => x !== habitId)
            : [...list, habitId]
          return {
            ...d,
            habitLog: { ...d.habitLog, [date]: next },
            habitLogAt: { ...d.habitLogAt, [date]: now() },
          }
        })
      },

      addHabit(habit) {
        patch((d) => ({
          ...d,
          habits: [...d.habits, { ...habit, id: uid('h-'), updatedAt: now(), createdAt: today() }],
        }))
      },

      updateHabit(id, p) {
        patchR((d) => ({ ...d, habits: d.habits.map((h) => (h.id === id ? { ...h, ...p, updatedAt: now() } : h)) }))
      },

      deleteHabit(id) {
        patchR((d) => tomb({ ...d, habits: d.habits.filter((h) => h.id !== id) }, id))
      },

      toggleSupplement(id, date) {
        patch((d) => {
          const list = d.supplementLog[date] ?? []
          const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
          return {
            ...d,
            supplementLog: { ...d.supplementLog, [date]: next },
            supplementLogAt: { ...d.supplementLogAt, [date]: now() },
          }
        })
      },

      addSupplement(s) {
        patch((d) => ({ ...d, supplements: [...d.supplements, { ...s, id: uid('sp-'), updatedAt: now() }] }))
      },

      deleteSupplement(id) {
        patch((d) => tomb({ ...d, supplements: d.supplements.filter((s) => s.id !== id) }, id))
      },

      saveCheckIn(entry) {
        patchR((d) => {
          const row: CheckIn = { ...entry, completedAt: Date.now() }
          const exists = d.checkIns.some((c) => c.date === entry.date)
          return {
            ...d,
            checkIns: exists
              ? d.checkIns.map((c) => (c.date === entry.date ? row : c))
              : [...d.checkIns, row],
          }
        })
      },

      /* ----------------------------- photos ---------------------------- */
      async addPhoto(file, angle, date, weightKg) {
        const blobKey = uid('ph-')
        await putBlob(blobKey, file)
        patchR((d) => ({
          ...d,
          photos: [
            ...d.photos,
            { id: uid('p-'), updatedAt: now(), date, angle, blobKey, weightKg, shared: false },
          ],
        }))
      },

      updatePhoto(id, p) {
        patch((d) => ({ ...d, photos: d.photos.map((x) => (x.id === id ? { ...x, ...p, updatedAt: now() } : x)) }))
      },

      async deletePhoto(id) {
        const photo = data.photos.find((p) => p.id === id)
        if (photo) await deleteBlob(photo.blobKey)
        patch((d) => tomb({ ...d, photos: d.photos.filter((p) => p.id !== id) }, id))
      },

      /* ---------------------------- planning --------------------------- */
      addGoal(g) {
        patch((d) => ({ ...d, goals: [...d.goals, { ...g, id: uid('g-'), updatedAt: now() }] }))
      },

      updateGoal(id, p) {
        patch((d) => ({ ...d, goals: d.goals.map((g) => (g.id === id ? { ...g, ...p, updatedAt: now() } : g)) }))
      },

      deleteGoal(id) {
        patch((d) => tomb({ ...d, goals: d.goals.filter((g) => g.id !== id) }, id))
      },

      startChallenge(c) {
        patchR((d) => ({
          ...d,
          // only one challenge runs at a time; older ones stay in history
          challenges: [
            ...d.challenges.map((x) => ({ ...x, active: false, updatedAt: now() })),
            {
              ...c,
              id: uid('ch-'), updatedAt: now(),
              active: true,
              endDate: addDays(c.startDate, c.days - 1),
            },
          ],
        }))
      },

      endChallenge(id, completed) {
        patchR((d) => ({
          ...d,
          challenges: d.challenges.map((c) =>
            c.id === id
              ? { ...c, active: false, completedAt: completed ? today() : c.completedAt }
              : c,
          ),
        }))
      },

      addPhase(p) {
        patch((d) => ({ ...d, phases: [...d.phases, { ...p, id: uid('ph-'), updatedAt: now() }] }))
      },

      updatePhase(id, p) {
        patch((d) => ({ ...d, phases: d.phases.map((x) => (x.id === id ? { ...x, ...p, updatedAt: now() } : x)) }))
      },

      deletePhase(id) {
        patch((d) => tomb({ ...d, phases: d.phases.filter((p) => p.id !== id) }, id))
      },

      /* ------------------------------ coach ---------------------------- */
      appendCoach(m) {
        patch((d) => ({
          ...d,
          coachLog: [...d.coachLog, { ...m, id: uid('cm-'), updatedAt: now(), at: Date.now() }].slice(-100),
        }))
      },

      clearCoach() {
        patch((d) => ({ ...d, coachLog: [] }))
      },

      /* ----------------------------- system ---------------------------- */
      importData(incoming) {
        dispatch({ t: 'hydrate', data: reconcile(migrate(incoming)) })
      },

      markBackedUp() {
        patch((d) => ({ ...d, lastBackupAt: Date.now() }))
      },

      resetAll() {
        dispatch({ t: 'hydrate', data: emptyData() })
      },
    }
    // `data` is read only inside deletePhoto, which needs the current blob key.
  }, [data.photos])

  const value = useMemo<StoreValue>(() => ({ data, ready, actions }), [data, ready, actions])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}

/** Convenience: the profile, asserted present. Only used below the onboarding gate. */
export function useProfile(): Profile {
  const { data } = useStore()
  if (!data.profile) throw new Error('useProfile used before onboarding completed')
  return data.profile
}

/* -------------------------------- migration ------------------------------ */

/**
 * Fills in anything a newer build expects but an older document lacks. Written
 * as additive defaults rather than versioned steps, which is enough while the
 * schema only grows.
 */
function migrate(doc: AppData): AppData {
  const base = emptyData()
  const merged: AppData = {
    ...base,
    ...doc,
    version: DATA_VERSION,
    notifications: { ...base.notifications, ...doc.notifications },
    dashboard: doc.dashboard?.length ? reconcileDashboard(doc.dashboard) : base.dashboard,
    // Built-in plans ship with the app, so refresh them while keeping user plans.
    plans: [...SEED_PLANS, ...(doc.plans ?? []).filter((p) => !p.builtIn)],
    deviceId: doc.deviceId || base.deviceId,

    // v1 → v2 sync fields. A pre-sync document has no write stamps at all,
    // which the merge reads as "older than anything" — correct, because the
    // first stamped write on any device should win over untracked history.
    rev: doc.rev ?? 0,
    syncedAt: doc.syncedAt ?? null,
    deleted: doc.deleted ?? {},
    habitLogAt: doc.habitLogAt ?? {},
    supplementLogAt: doc.supplementLogAt ?? {},
    profileAt: doc.profileAt ?? 0,
    settingsAt: doc.settingsAt ?? 0,
    stepsAt: doc.stepsAt ?? {},
  }
  return merged
}

/** Keeps saved dashboard order but adds cards introduced since the save. */
function reconcileDashboard(saved: DashCard[]): DashCard[] {
  const known = new Set(saved.map((c) => c.id))
  const added = DEFAULT_DASHBOARD.filter((c) => !known.has(c.id))
  const valid = saved.filter((c) => DEFAULT_DASHBOARD.some((d) => d.id === c.id))
  return [...valid, ...added]
}
