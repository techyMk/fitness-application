/* ============================================================================
   Domain types.

   Shape notes that matter later:
   - Every dated record keys on a local `YYYY-MM-DD` string (`DateKey`), never a
     timestamp, so "what did I do on the 4th" never drifts across timezones.
   - Nothing here references voice. Voice (spec §37) reads `WorkoutSession`,
     `SetEntry` and `PersonalRecord` and speaks them; it needs no schema change,
     which is the §38 requirement.
   ========================================================================= */

export type DateKey = string // YYYY-MM-DD, local
export type ID = string

export type Units = 'metric' | 'imperial'
export type Lang = 'en' | 'ta'
export type Theme = 'dark' | 'light' | 'system'

export type GoalType =
  | 'fat-loss'
  | 'muscle-gain'
  | 'recomp'
  | 'maintenance'
  | 'general'
  | 'custom'

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'very'
  | 'extreme'

export type Experience = 'beginner' | 'intermediate' | 'advanced'

export type Equipment =
  | 'full-gym'
  | 'dumbbells'
  | 'barbells'
  | 'machines'
  | 'cables'
  | 'bands'
  | 'bodyweight'

export type Sex = 'male' | 'female' | 'unspecified'

export interface Targets {
  calories: number
  protein: number
  carbs: number
  fat: number
  steps: number
  sleepHours: number
  workoutsPerWeek: number
}

export interface Profile {
  id: ID
  name: string
  age: number
  sex: Sex
  heightCm: number
  startWeightKg: number
  targetWeightKg: number
  goal: GoalType
  activity: ActivityLevel
  experience: Experience
  equipment: Equipment[]
  workoutDays: number[] // 0=Sun … 6=Sat
  units: Units
  lang: Lang
  theme: Theme
  targets: Targets
  /** true once the user edits a target by hand — stops auto-recalc clobbering it */
  targetsCustomised: boolean
  createdAt: DateKey
  coaching: 'gentle' | 'balanced' | 'direct'
}

/* --------------------------------- body ---------------------------------- */

export interface WeightEntry {
  id: ID
  date: DateKey
  kg: number
  note?: string
}

/* ------------------------------- training -------------------------------- */

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core'
  | 'forearms'
  | 'full-body'

export interface Exercise {
  id: ID
  name: string
  muscle: MuscleGroup
  secondary?: MuscleGroup[]
  equipment: Equipment
  instructions?: string
  /** 'barbell squat' style cue list, one per line */
  cues?: string[]
  defaultSets?: number
  defaultRepRange?: [number, number]
  /** bodyweight moves are logged in reps only */
  isBodyweight?: boolean
  custom?: boolean
  mediaUrl?: string
}

export interface SetEntry {
  id: ID
  exerciseId: ID
  setNumber: number
  weightKg: number
  reps: number
  rpe?: number
  restSec?: number
  done: boolean
  note?: string
}

export interface WorkoutSession {
  id: ID
  date: DateKey
  /** program day this session came from, if any */
  planId?: ID
  dayIndex?: number
  title: string
  startedAt: number
  endedAt?: number
  durationSec?: number
  sets: SetEntry[]
  note?: string
  /** computed at save: sum(weight x reps) in kg */
  volumeKg: number
  completed: boolean
}

export interface PlanDay {
  /** 0=Sun … 6=Sat */
  weekday: number
  title: string
  rest: boolean
  exerciseIds: ID[]
}

export interface WorkoutPlan {
  id: ID
  name: string
  description?: string
  days: PlanDay[]
  builtIn?: boolean
  createdAt: DateKey
}

export interface PersonalRecord {
  id: ID
  exerciseId: ID
  /** heaviest single set */
  bestWeightKg: number
  bestWeightReps: number
  bestWeightDate: DateKey
  /** most reps at any weight */
  bestReps: number
  bestRepsWeightKg: number
  bestRepsDate: DateKey
  /** best estimated 1RM — the "best performance" reading */
  best1rmKg: number
  best1rmDate: DateKey
}

export type NonGymRecordKey =
  | 'fastest-5k'
  | 'longest-cardio'
  | 'highest-steps'
  | 'longest-workout'
  | 'best-week-consistency'
  | 'most-workouts-month'

export interface NonGymRecord {
  key: NonGymRecordKey
  value: number
  date: DateKey
  label: string
}

/* ------------------------------ nutrition -------------------------------- */

export type MealType = 'breakfast' | 'lunch' | 'snacks' | 'dinner' | 'other'

export interface Food {
  id: ID
  name: string
  /** display label for one serving, e.g. "1 roti (45 g)" */
  serving: string
  servingGrams?: number
  calories: number
  protein: number
  carbs: number
  fat: number
  tags?: string[]
  custom?: boolean
}

export interface FoodPortion {
  id: ID
  foodId?: ID
  /** snapshot so edits/deletes to the food library never rewrite history */
  name: string
  serving: string
  qty: number
  calories: number
  protein: number
  carbs: number
  fat: number
}

export interface MealEntry {
  id: ID
  date: DateKey
  type: MealType
  items: FoodPortion[]
  loggedAt: number
}

export interface SavedMeal {
  id: ID
  name: string
  type: MealType
  items: FoodPortion[]
}

/* -------------------------- cardio, steps, sleep -------------------------- */

export type CardioType = 'walk' | 'run' | 'cycle' | 'treadmill' | 'other'

export interface CardioEntry {
  id: ID
  date: DateKey
  type: CardioType
  minutes: number
  distanceKm?: number
  calories?: number
  speedKmh?: number
  incline?: number
  note?: string
}

export interface StepEntry {
  date: DateKey
  steps: number
}

export interface SleepEntry {
  id: ID
  date: DateKey
  /** "22:45" local clock strings — stored as typed, derived duration cached */
  start: string
  wake: string
  minutes: number
  quality?: 1 | 2 | 3 | 4 | 5
}

/* ------------------------- habits & supplements --------------------------- */

export interface Habit {
  id: ID
  name: string
  icon: string
  /** an auto habit is ticked by the data (e.g. hit protein target) not by hand */
  auto?: 'workout' | 'protein' | 'calories' | 'steps' | 'sleep'
  archived?: boolean
  createdAt: DateKey
}

/** date -> habitId[] completed */
export type HabitLog = Record<DateKey, ID[]>

export interface Supplement {
  id: ID
  name: string
  dosage: string
  timeOfDay?: string
  remind?: boolean
  archived?: boolean
}

/** date -> supplementId[] taken */
export type SupplementLog = Record<DateKey, ID[]>

/* ------------------------------ check-in --------------------------------- */

export interface CheckIn {
  date: DateKey
  energy?: 1 | 2 | 3 | 4 | 5
  hunger?: 1 | 2 | 3 | 4 | 5
  cravings?: 1 | 2 | 3 | 4 | 5
  mood?: 1 | 2 | 3 | 4 | 5
  note?: string
  completedAt: number
}

/* ------------------------------- photos ---------------------------------- */

export type PhotoAngle = 'front' | 'side' | 'back'

export interface ProgressPhoto {
  id: ID
  date: DateKey
  angle: PhotoAngle
  /** object store key for the blob; the blob itself never enters app state */
  blobKey: string
  weightKg?: number
  /** private by default, per spec §21 */
  shared: boolean
  note?: string
}

/* ------------------- goals, challenges, phases --------------------------- */

export type GoalMetric =
  | 'weight'
  | 'calories'
  | 'protein'
  | 'steps'
  | 'workouts'
  | 'cardio-minutes'
  | 'sleep-hours'
  | 'challenge'

export interface Goal {
  id: ID
  metric: GoalMetric
  label: string
  target: number
  /** for rate goals: the window the target applies to */
  period: 'total' | 'daily' | 'weekly'
  startDate: DateKey
  deadline?: DateKey
  startValue?: number
  archived?: boolean
  completedAt?: DateKey
}

export interface Challenge {
  id: ID
  name: string
  days: number
  startDate: DateKey
  endDate: DateKey
  startWeightKg?: number
  goalWeightKg?: number
  active: boolean
  completedAt?: DateKey
}

export interface Phase {
  id: ID
  name: string
  goal: GoalType
  startDate: DateKey
  endDate?: DateKey
  calories?: number
  protein?: number
  targetWeightKg?: number
  planId?: ID
  note?: string
}

/* ---------------------------- achievements ------------------------------- */

export interface AchievementDef {
  id: string
  name: string
  hint: string
  tier: 'bronze' | 'silver' | 'gold'
}

/** achievementId -> unlock date */
export type AchievementLog = Record<string, DateKey>

/* --------------------------- notifications ------------------------------- */

export interface NotificationPrefs {
  enabled: boolean
  workout: boolean
  checkIn: boolean
  nutrition: boolean
  protein: boolean
  sleep: boolean
  supplements: boolean
  challenge: boolean
  goals: boolean
  /** "20:30" */
  checkInTime: string
  workoutTime: string
}

/* ------------------------- dashboard layout ------------------------------ */

export type DashCardId =
  | 'challenge'
  | 'score'
  | 'weight'
  | 'nutrition'
  | 'workout'
  | 'movement'
  | 'sleep'
  | 'habits'
  | 'records'

export interface DashCard {
  id: DashCardId
  visible: boolean
}

/* --------------------------- friends / board ----------------------------- */

export interface Friend {
  id: ID
  name: string
  /** manual entry — V1 has no backend, so a friend board is a local scorecard */
  streak: number
  workouts: number
  steps: number
  achievements: number
}

/* ------------------------------ AI coach --------------------------------- */

export interface CoachMessage {
  id: ID
  role: 'user' | 'coach'
  text: string
  at: number
  /** true when produced offline from the user's own data, no model call */
  local?: boolean
}

/* ------------------------------ root state ------------------------------- */

export interface AppData {
  version: number
  profile: Profile | null
  weights: WeightEntry[]
  sessions: WorkoutSession[]
  plans: WorkoutPlan[]
  activePlanId: ID | null
  customExercises: Exercise[]
  records: PersonalRecord[]
  nonGymRecords: NonGymRecord[]
  meals: MealEntry[]
  savedMeals: SavedMeal[]
  customFoods: Food[]
  cardio: CardioEntry[]
  steps: StepEntry[]
  sleep: SleepEntry[]
  habits: Habit[]
  habitLog: HabitLog
  supplements: Supplement[]
  supplementLog: SupplementLog
  checkIns: CheckIn[]
  photos: ProgressPhoto[]
  goals: Goal[]
  challenges: Challenge[]
  phases: Phase[]
  achievements: AchievementLog
  notifications: NotificationPrefs
  dashboard: DashCard[]
  friends: Friend[]
  coachLog: CoachMessage[]
  /** epoch ms of last successful local snapshot */
  lastBackupAt: number | null
  /** stable anonymous id — the backup identity, see lib/backup.ts */
  deviceId: string
}
