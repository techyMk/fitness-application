/* ============================================================================
   The coach's analysis layer.

   Spec §36 asks for coaching that uses the user's own logged data rather than
   generic advice. That requirement is independent of whether a model is wired up,
   so the analysis lives here as plain functions over AppData: they produce the
   facts and the recommendation. Those facts are what a model would need as
   context anyway, which is why this file is also what builds the prompt context
   when a key is connected.

   No network calls happen in this file.
   ========================================================================= */

import type { AppData, Profile } from './types'
import {
  averageOf,
  currentStreak,
  dayScore,
  dayTotals,
  lastPerformance,
  predictGoal,
  suggestProgression,
  weeklyReview,
  weightStats,
  type ScorePart,
} from './calc'
import { addDays, fmtDuration, lastNDays, today } from './date'
import { makeFmt } from './units'
import { SEED_EXERCISES } from '../data/exercises'
import { proteinDense, SEED_FOODS } from '../data/foods'

export interface CoachContext {
  /** a compact, human-readable digest of the log — also the model's context */
  digest: string
  weakest: ScorePart['key'] | null
}

export function buildContext(data: AppData): CoachContext {
  const p = data.profile
  if (!p) return { digest: 'No profile yet.', weakest: null }

  const fmt = makeFmt(p.units)
  const w = weightStats(data)
  const prediction = predictGoal(data)
  const review = weeklyReview(data, today())
  const last30 = lastNDays(30)
  const totals = last30.map((d) => dayTotals(data, d))
  const loggedFood = totals.filter((x) => x.calories > 0)

  const lines: string[] = [
    `Goal: ${p.goal}. Experience: ${p.experience}. Activity: ${p.activity}.`,
    `Targets: ${p.targets.calories} kcal, ${p.targets.protein} g protein, ${p.targets.steps} steps, ${p.targets.sleepHours} h sleep, ${p.targets.workoutsPerWeek} sessions/week.`,
    `Weight: start ${fmt.weightLabel(w.start)}, now ${fmt.weightLabel(w.current)}, trend ${fmt.weightLabel(w.trend)}, target ${fmt.weightLabel(w.target)} (${Math.round(w.progressPct)}% of the way).`,
    w.ratePerWeek != null
      ? `Rate: ${w.ratePerWeek > 0 ? '+' : ''}${w.ratePerWeek} ${fmt.weightUnit}/week over 28 days.`
      : 'Rate: not enough weigh-ins to compute.',
    prediction.date
      ? `Estimated target date ${prediction.date} (${prediction.confidence} confidence).`
      : `No target date estimate (${prediction.reason}).`,
    `Last 30 days: ${loggedFood.length} days of food logged, average ${Math.round(averageOf(loggedFood.map((x) => x.calories)) ?? 0)} kcal and ${Math.round(averageOf(loggedFood.map((x) => x.protein)) ?? 0)} g protein.`,
    `Training: ${data.sessions.filter((s) => s.completed && s.date >= addDays(today(), -30)).length} sessions in 30 days.`,
    `Steps: average ${Math.round(averageOf(totals.map((x) => x.steps)) ?? 0)}/day.`,
    `Sleep: average ${fmtDuration(averageOf(totals.filter((x) => x.sleepMinutes > 0).map((x) => x.sleepMinutes)) ?? 0)}.`,
    `This week score ${review.score}/100. Streak ${currentStreak(data)} days.`,
  ]

  if (review.focus) lines.push(`Weakest input this week: ${review.focus.label}.`)

  return { digest: lines.join('\n'), weakest: review.focus?.key ?? null }
}

/* ===========================================================================
   Local answers. These cover the questions people actually ask a fitness app,
   answered from the log with real numbers. Each returns null when it is not the
   right match, so `answerLocally` can try them in order.
   ======================================================================== */

type Answer = { text: string } | null

export function answerLocally(data: AppData, question: string): Answer {
  const p = data.profile
  if (!p) return null
  const q = question.toLowerCase()

  const matchers: Array<(d: AppData, p: Profile, q: string) => Answer> = [
    answerProgress,
    answerWeightStall,
    answerProtein,
    answerCalories,
    answerTraining,
    answerSleep,
    answerSteps,
    answerNextWorkout,
    answerWhatToFix,
  ]

  for (const m of matchers) {
    const a = m(data, p, q)
    if (a) return a
  }
  return null
}

const has = (q: string, ...words: string[]) => words.some((w) => q.includes(w))

function answerProgress(data: AppData, p: Profile, q: string): Answer {
  if (!has(q, 'how am i doing', 'progress', 'on track', 'going well', 'summary')) return null
  const fmt = makeFmt(p.units)
  const w = weightStats(data)
  const pred = predictGoal(data)
  const review = weeklyReview(data, today())

  const parts: string[] = []
  if (w.change != null) {
    const dir = w.change <= 0 ? 'down' : 'up'
    parts.push(
      `You are ${fmt.weightLabel(Math.abs(w.change))} ${dir} from your start weight — ${Math.round(w.progressPct)}% of the way to ${fmt.weightLabel(w.target)}.`,
    )
  }
  if (w.ratePerWeek != null) {
    parts.push(
      `Your 28-day trend is ${w.ratePerWeek > 0 ? '+' : ''}${w.ratePerWeek} ${fmt.weightUnit} a week.`,
    )
  }
  if (pred.date) {
    parts.push(
      `At that pace you reach target around ${pred.date}${pred.confidence === 'low' ? ', though that estimate is still rough' : ''}.`,
    )
  }
  parts.push(`This week you are averaging ${review.score}/100 with ${review.workouts} sessions.`)
  if (review.focus) parts.push(review.focus.message)

  return { text: parts.join(' ') }
}

function answerWeightStall(data: AppData, p: Profile, q: string): Answer {
  if (!has(q, 'stall', 'plateau', 'stuck', 'not losing', 'no change', 'why is my weight')) return null
  const fmt = makeFmt(p.units)
  const w = weightStats(data)
  const last14 = lastNDays(14)
  const totals = last14.map((d) => dayTotals(data, d))
  const logged = totals.filter((x) => x.calories > 0)
  const avgKcal = Math.round(averageOf(logged.map((x) => x.calories)) ?? 0)

  const bits: string[] = []
  if (w.ratePerWeek != null && Math.abs(w.ratePerWeek) < 0.1) {
    bits.push(`Your trend has been flat — ${w.ratePerWeek} ${fmt.weightUnit} a week over 28 days.`)
  }
  if (logged.length < 7) {
    bits.push(
      `The most likely cause is measurement, not metabolism: you logged food on ${logged.length} of the last 14 days. Untracked days are where a deficit usually goes.`,
    )
  } else if (avgKcal > p.targets.calories * 1.03) {
    bits.push(
      `You averaged ${avgKcal} kcal against a ${p.targets.calories} target — about ${avgKcal - p.targets.calories} over per day, which is enough to cancel the deficit.`,
    )
  } else {
    bits.push(
      `Your intake is on target at ${avgKcal} kcal. Two weeks of a flat scale with on-target intake is usually water and glycogen, not fat. Hold the same inputs for another ten days before changing anything, and weigh daily so the trend line has data to smooth.`,
    )
  }
  return { text: bits.join(' ') }
}

function answerProtein(data: AppData, p: Profile, q: string): Answer {
  if (!has(q, 'protein')) return null
  const last14 = lastNDays(14)
  const logged = last14.map((d) => dayTotals(data, d)).filter((x) => x.calories > 0)
  const avg = Math.round(averageOf(logged.map((x) => x.protein)) ?? 0)
  const hitRate = logged.filter((x) => x.protein >= p.targets.protein * 0.95).length

  if (!logged.length) {
    return {
      text: `Your target is ${p.targets.protein} g a day. You have not logged food in the last two weeks, so there is nothing to measure against yet — log a few days and I can tell you where the gap is.`,
    }
  }

  const foods = proteinDense([...data.customFoods, ...SEED_FOODS], 4)
    .map((f) => `${f.name} (${f.protein} g per ${f.serving})`)
    .join(', ')

  if (avg >= p.targets.protein * 0.95) {
    return {
      text: `You are on it: ${avg} g a day on average against a ${p.targets.protein} g target, hit on ${hitRate} of ${logged.length} logged days. Keep doing what you are doing.`,
    }
  }

  const gap = p.targets.protein - avg
  return {
    text: `You are averaging ${avg} g against a ${p.targets.protein} g target — about ${gap} g short, and you hit it on only ${hitRate} of ${logged.length} logged days. The cheapest fix is one protein anchor per meal rather than a big shake at the end of the day. High-density options already in your database: ${foods}.`,
  }
}

function answerCalories(data: AppData, p: Profile, q: string): Answer {
  if (!has(q, 'calorie', 'kcal', 'eating too much', 'eat less', 'deficit', 'surplus')) return null
  const last14 = lastNDays(14)
  const logged = last14.map((d) => dayTotals(data, d)).filter((x) => x.calories > 0)
  const avg = Math.round(averageOf(logged.map((x) => x.calories)) ?? 0)

  if (!logged.length) {
    return {
      text: `Your target is ${p.targets.calories} kcal a day. Nothing logged in the last two weeks, so start there — even rough quick-add entries are enough for the average to mean something.`,
    }
  }
  const delta = avg - p.targets.calories
  if (Math.abs(delta) <= p.targets.calories * 0.05) {
    return {
      text: `You are averaging ${avg} kcal against a ${p.targets.calories} target across ${logged.length} logged days — inside the band. Leave it alone and let the weight trend tell you whether the target itself needs moving.`,
    }
  }
  return {
    text: `You are averaging ${avg} kcal against a ${p.targets.calories} target, so ${Math.abs(delta)} kcal ${delta > 0 ? 'over' : 'under'} per day across ${logged.length} logged days. ${
      delta > 0
        ? 'That is roughly where your missing progress is going. Before cutting the target, close the gap on the days you already know are loose.'
        : 'Eating well under target is not faster progress — it usually shows up as lost training quality and a worse trend. Bring it back toward target.'
    }`,
  }
}

function answerTraining(data: AppData, p: Profile, q: string): Answer {
  if (!has(q, 'training', 'workout', 'how often', 'frequency', 'gym', 'volume')) return null
  if (has(q, 'next', 'today', 'what should i do')) return null // handled by answerNextWorkout

  const last28 = data.sessions.filter((s) => s.completed && s.date >= addDays(today(), -27))
  const perWeek = (last28.length / 4).toFixed(1)
  const fmt = makeFmt(p.units)
  const volume = last28.reduce((a, s) => a + s.volumeKg, 0)

  if (!last28.length) {
    return {
      text: `No sessions logged in the last four weeks. Your target is ${p.targets.workoutsPerWeek} a week — start with one, logged properly, and the progression suggestions will have something to work from.`,
    }
  }

  return {
    text: `${last28.length} sessions in 28 days, about ${perWeek} a week against a target of ${p.targets.workoutsPerWeek}. Total volume ${Math.round(Number(fmt.weight(volume, 0)))} ${fmt.weightUnit}. ${
      Number(perWeek) >= p.targets.workoutsPerWeek
        ? 'Frequency is handled. The thing to watch now is whether load on your main lifts is actually climbing — check the strength chart in Analytics.'
        : `You are about ${(p.targets.workoutsPerWeek - Number(perWeek)).toFixed(1)} sessions a week short. Shorter sessions you actually attend beat longer ones you skip.`
    }`,
  }
}

function answerSleep(data: AppData, p: Profile, q: string): Answer {
  if (!has(q, 'sleep', 'tired', 'recovery', 'rest')) return null
  const last14 = lastNDays(14)
  const nights = last14
    .map((d) => data.sleep.find((s) => s.date === d))
    .filter((x): x is NonNullable<typeof x> => !!x)

  if (!nights.length) {
    return {
      text: `No sleep logged in the last two weeks. It is 12% of your score and the input that quietly drags the others down — two taps each morning is enough.`,
    }
  }
  const avg = averageOf(nights.map((n) => n.minutes))!
  const target = p.targets.sleepHours * 60
  return {
    text: `You are averaging ${fmtDuration(avg)} across ${nights.length} logged nights, against a ${p.targets.sleepHours} h target. ${
      avg >= target * 0.9
        ? 'That is where it should be. Keep it.'
        : `About ${fmtDuration(target - avg)} short a night. Moving lights-out earlier is worth more than any supplement on the list.`
    }`,
  }
}

function answerSteps(data: AppData, p: Profile, q: string): Answer {
  if (!has(q, 'step', 'cardio', 'walk', 'nead', 'activity')) return null
  const last14 = lastNDays(14)
  const totals = last14.map((d) => dayTotals(data, d))
  const avg = Math.round(averageOf(totals.map((x) => x.steps)) ?? 0)
  const cardioMin = totals.reduce((a, x) => a + x.cardioMinutes, 0)

  return {
    text: `Average ${avg} steps a day over two weeks against a ${p.targets.steps} target, plus ${cardioMin} minutes of logged cardio. ${
      avg >= p.targets.steps
        ? 'Movement is covered — this is the input most people neglect, so hold it.'
        : `About ${p.targets.steps - avg} short a day. A 20-minute walk after dinner is roughly 2,000 steps and the easiest one to make non-negotiable.`
    }`,
  }
}

function answerNextWorkout(data: AppData, p: Profile, q: string): Answer {
  if (!has(q, 'next workout', 'what should i do today', 'today', 'next session', 'what weight')) {
    return null
  }
  const fmt = makeFmt(p.units)
  const plan = data.plans.find((x) => x.id === data.activePlanId)
  const weekday = new Date(`${today()}T00:00:00`).getDay()
  const day = plan?.days.find((d) => d.weekday === weekday)

  if (!day || day.rest) {
    return {
      text: `Today is a rest day on ${plan?.name ?? 'your programme'}. Rest days score full on the training input — a walk and an early night does more for the next session than an unplanned one.`,
    }
  }

  const byId = new Map([...SEED_EXERCISES, ...data.customExercises].map((e) => [e.id, e]))
  const suggestions = day.exerciseIds
    .slice(0, 4)
    .map((id) => {
      const ex = byId.get(id)
      if (!ex) return null
      const last = lastPerformance(data.sessions, id)
      const prog = suggestProgression(last, ex.defaultRepRange, ex.isBodyweight, ex.equipment)
      const target = ex.isBodyweight
        ? `${prog.repLow}–${prog.repHigh} reps`
        : `${fmt.weight(prog.weightKg)} ${fmt.weightUnit} × ${prog.repLow}–${prog.repHigh}`
      return `${ex.name}: ${target}`
    })
    .filter(Boolean)

  return {
    text: `Today is ${day.title}. Starting points based on your last sessions — ${suggestions.join('; ')}. Those come from your own logged top sets, so treat them as a floor, not a ceiling.`,
  }
}

function answerWhatToFix(data: AppData, _p: Profile, q: string): Answer {
  if (!has(q, 'what should i', 'improve', 'focus', 'fix', 'priority', 'weakest')) return null
  const review = weeklyReview(data, today())
  const score = dayScore(data, today())
  const coldest = [...score.parts].sort((a, b) => a.value - b.value)[0]

  if (review.focus) {
    return {
      text: `${review.focus.label} is your weakest input this week. ${review.focus.message} Everything else is holding — do not try to fix three things at once.`,
    }
  }
  return {
    text: `Nothing is clearly lagging this week; every input cleared 85%. Today the coldest segment is ${coldest.label} at ${Math.round(coldest.value * 100)}%. Hold the pattern and let the trend do the work.`,
  }
}

/* --------------------------- fallback suggestions ------------------------- */

export const SUGGESTED_QUESTIONS = [
  'How am I doing?',
  'What should I focus on?',
  'Why is my weight stuck?',
  'Am I getting enough protein?',
  'What should I do today?',
  'Is my training frequency enough?',
]
