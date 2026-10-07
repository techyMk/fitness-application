/* ============================================================================
   Achievements. Each definition carries a pure predicate over AppData, so the
   unlock check is one pass with no bookkeeping — add a row here and it works
   retroactively on existing history.
   ========================================================================= */

import type { AchievementDef, AppData } from '../lib/types'
import { currentStreak, dayScore, dayTotals, sum } from '../lib/calc'
import { monthDays, today, weekStart, addDays } from '../lib/date'

export interface Achievement extends AchievementDef {
  earned: (d: AppData) => boolean
}

const completedSessions = (d: AppData) => d.sessions.filter((s) => s.completed)

const totalCardioKm = (d: AppData) => sum(d.cardio.map((c) => c.distanceKm ?? 0))

const weightLost = (d: AppData) => {
  const start = d.profile?.startWeightKg
  const current = [...d.weights].sort((a, b) => (a.date < b.date ? -1 : 1)).at(-1)?.kg
  if (start == null || current == null) return 0
  return start - current
}

const daysHittingProtein = (d: AppData) => {
  const target = d.profile?.targets.protein
  if (!target) return 0
  const dates = new Set(d.meals.map((m) => m.date))
  let n = 0
  for (const date of dates) if (dayTotals(d, date).protein >= target * 0.95) n++
  return n
}

const workoutsThisMonth = (d: AppData) => {
  const month = new Set(monthDays(today()))
  return completedSessions(d).filter((s) => month.has(s.date)).length
}

const fullWeekLogged = (d: AppData) => {
  const start = weekStart(addDays(today(), -7))
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  return days.every((date) => {
    const t = dayTotals(d, date)
    return t.calories > 0 || t.workouts > 0 || !!t.checkIn
  })
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-workout',
    name: 'First workout',
    hint: 'Finish one session',
    tier: 'bronze',
    earned: (d) => completedSessions(d).length >= 1,
  },
  {
    id: 'first-weigh-in',
    name: 'On the scale',
    hint: 'Log your first weigh-in',
    tier: 'bronze',
    earned: (d) => d.weights.length >= 1,
  },
  {
    id: 'first-photo',
    name: 'Day one photo',
    hint: 'Take your first progress photo',
    tier: 'bronze',
    earned: (d) => d.photos.length >= 1,
  },
  {
    id: 'first-pr',
    name: 'First record',
    hint: 'Set a personal record',
    tier: 'bronze',
    earned: (d) => d.records.length >= 1,
  },
  {
    id: 'streak-7',
    name: 'Seven-day streak',
    hint: 'Seven days in a row above 50',
    tier: 'bronze',
    earned: (d) => currentStreak(d) >= 7,
  },
  {
    id: 'streak-30',
    name: 'Thirty-day streak',
    hint: 'Thirty days in a row above 50',
    tier: 'silver',
    earned: (d) => currentStreak(d) >= 30,
  },
  {
    id: 'streak-100',
    name: 'Hundred-day streak',
    hint: 'A hundred days in a row',
    tier: 'gold',
    earned: (d) => currentStreak(d) >= 100,
  },
  {
    id: 'workouts-10',
    name: 'Ten sessions',
    hint: 'Finish ten workouts',
    tier: 'bronze',
    earned: (d) => completedSessions(d).length >= 10,
  },
  {
    id: 'workouts-50',
    name: 'Fifty sessions',
    hint: 'Finish fifty workouts',
    tier: 'silver',
    earned: (d) => completedSessions(d).length >= 50,
  },
  {
    id: 'workouts-100',
    name: 'Hundred sessions',
    hint: 'Finish a hundred workouts',
    tier: 'gold',
    earned: (d) => completedSessions(d).length >= 100,
  },
  {
    id: 'month-16',
    name: 'Sixteen in a month',
    hint: 'Sixteen workouts inside one calendar month',
    tier: 'silver',
    earned: (d) => workoutsThisMonth(d) >= 16,
  },
  {
    id: 'cardio-100',
    name: '100 km covered',
    hint: 'A hundred cardio kilometres logged',
    tier: 'silver',
    earned: (d) => totalCardioKm(d) >= 100,
  },
  {
    id: 'cardio-500',
    name: '500 km covered',
    hint: 'Five hundred cardio kilometres',
    tier: 'gold',
    earned: (d) => totalCardioKm(d) >= 500,
  },
  {
    id: 'steps-15k',
    name: 'Fifteen thousand steps',
    hint: 'Fifteen thousand steps in one day',
    tier: 'bronze',
    earned: (d) => d.steps.some((s) => s.steps >= 15000),
  },
  {
    id: 'protein-30',
    name: 'Thirty protein days',
    hint: 'Hit the protein target on thirty days',
    tier: 'silver',
    earned: (d) => daysHittingProtein(d) >= 30,
  },
  {
    id: 'lost-2',
    name: 'First 2 kg down',
    hint: 'Two kilograms below your start weight',
    tier: 'bronze',
    earned: (d) => weightLost(d) >= 2,
  },
  {
    id: 'lost-5',
    name: 'Five kilos down',
    hint: 'Five kilograms below your start weight',
    tier: 'silver',
    earned: (d) => weightLost(d) >= 5,
  },
  {
    id: 'lost-10',
    name: 'Ten kilos down',
    hint: 'Ten kilograms below your start weight',
    tier: 'gold',
    earned: (d) => weightLost(d) >= 10,
  },
  {
    id: 'goal-weight',
    name: 'Target reached',
    hint: 'Reach your target weight',
    tier: 'gold',
    earned: (d) => {
      const target = d.profile?.targetWeightKg
      const cur = [...d.weights].sort((a, b) => (a.date < b.date ? -1 : 1)).at(-1)?.kg
      if (target == null || cur == null) return false
      const start = d.profile!.startWeightKg
      return start > target ? cur <= target : cur >= target
    },
  },
  {
    id: 'perfect-week',
    name: 'Complete week',
    hint: 'Log something every day for a full week',
    tier: 'silver',
    earned: fullWeekLogged,
  },
  {
    id: 'score-100',
    name: 'Perfect day',
    hint: 'Score 100 on a single day',
    tier: 'gold',
    earned: (d) => {
      const dates = new Set([
        ...d.meals.map((m) => m.date),
        ...d.sessions.map((s) => s.date),
      ])
      for (const date of dates) {
        // dayScore walks the whole log, so only test days with real activity
        if (dayTotals(d, date).calories > 0 && dayScore(d, date).total >= 100) return true
      }
      return false
    },
  },
  {
    id: 'challenge-done',
    name: 'Challenge complete',
    hint: 'Finish a challenge end to end',
    tier: 'gold',
    earned: (d) => d.challenges.some((c) => !!c.completedAt),
  },
  {
    id: 'challenge-100',
    name: 'Hundred-day challenge',
    hint: 'Complete a hundred-day challenge',
    tier: 'gold',
    earned: (d) => d.challenges.some((c) => c.days >= 100 && !!c.completedAt),
  },
  {
    id: 'sleep-week',
    name: 'Rested week',
    hint: 'Hit your sleep target seven nights running',
    tier: 'silver',
    earned: (d) => {
      const target = (d.profile?.targets.sleepHours ?? 7.5) * 60 * 0.9
      const days = Array.from({ length: 7 }, (_, i) => addDays(today(), -i))
      return days.every((date) => (d.sleep.find((s) => s.date === date)?.minutes ?? 0) >= target)
    },
  },
]

/** Returns ids newly earned that aren't already in the log. */
export function newlyEarned(data: AppData): string[] {
  return ACHIEVEMENTS.filter((a) => !data.achievements[a.id] && safeEarned(a, data)).map((a) => a.id)
}

function safeEarned(a: Achievement, d: AppData): boolean {
  try {
    return a.earned(d)
  } catch {
    return false
  }
}
