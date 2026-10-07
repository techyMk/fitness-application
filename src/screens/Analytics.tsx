/* ============================================================================
   Analytics. Six sections, one range control, one chart per measure.

   Deliberately NOT a dashboard of combined axes: weight and calories are separate
   charts because they are different scales, and a dual-axis chart is the single
   most misleading thing you can put in front of someone tracking two measures.
   Every chart here carries a "Show values" table.
   ========================================================================= */

import { useMemo, useState } from 'react'
import { averageOf, dayScore, dayTotals, estimate1rm, sum, weightStats } from '../lib/calc'
import { useStore } from '../lib/store'
import { useT } from '../lib/i18n'
import { fmtDelta, fmtInt, makeFmt } from '../lib/units'
import { fmtDate, fmtDuration, lastNDays } from '../lib/date'
import { BarChart, HeatStrip, LineChart, MacroBar } from '../components/charts'
import { Empty, ScreenHeader, Stat } from '../components/ui'
import { MUSCLE_LABELS, SEED_EXERCISES } from '../data/exercises'

type Range = 7 | 30 | 90

export default function Analytics() {
  const { t, locale } = useT()
  const { data } = useStore()
  const profile = data.profile!
  const fmt = useMemo(() => makeFmt(profile.units), [profile.units])

  const [range, setRange] = useState<Range>(30)
  const days = useMemo(() => lastNDays(range), [range])
  const totals = useMemo(() => days.map((d) => dayTotals(data, d)), [data, days])

  const label = (d: string) => fmtDate(d, locale).split(' ')[0]

  const hasAnything =
    data.weights.length > 0 ||
    data.meals.length > 0 ||
    data.sessions.some((s) => s.completed) ||
    data.steps.length > 0 ||
    data.sleep.length > 0

  if (!hasAnything) {
    return (
      <div className="shell">
        <ScreenHeader title={t('an.title')} back="/progress" />
        <Empty title={t('an.noData')} body={t('an.noData.body')} />
      </div>
    )
  }

  /* ------------------------------ derivations ----------------------------- */

  const wStats = weightStats(data)
  const loggedFood = totals.filter((x) => x.calories > 0)
  const sleptNights = totals.filter((x) => x.sleepMinutes > 0)

  const sessions = useMemo(
    () => data.sessions.filter((s) => s.completed && s.date >= days[0]),
    [data.sessions, days],
  )

  // Volume per muscle group across the range — a categorical breakdown, so it
  // gets direct labels rather than relying on a colour key alone.
  const volumeByMuscle = useMemo(() => {
    const byId = new Map(
      [...SEED_EXERCISES, ...data.customExercises].map((e) => [e.id, e.muscle]),
    )
    const map = new Map<string, number>()
    for (const s of sessions) {
      for (const x of s.sets) {
        const muscle = byId.get(x.exerciseId)
        if (!muscle) continue
        map.set(muscle, (map.get(muscle) ?? 0) + x.weightKg * x.reps)
      }
    }
    return [...map.entries()]
      .map(([muscle, kg]) => ({ muscle, kg }))
      .filter((m) => m.kg > 0)
      .sort((a, b) => b.kg - a.kg)
  }, [sessions, data.customExercises])

  // Days the user actually used the app. Averaging the score across untouched
  // days reports "4/100" for someone who logged one perfect day, which reads as
  // a verdict on them rather than on the gaps in the log.
  const activeDays = useMemo(
    () =>
      days.filter((d) => {
        const x = dayTotals(data, d)
        return (
          x.calories > 0 ||
          x.workouts > 0 ||
          x.steps > 0 ||
          x.sleepMinutes > 0 ||
          !!x.checkIn
        )
      }),
    [data, days],
  )

  // Strength progression: best estimated 1RM per week for the most-logged lift.
  const strength = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of data.sessions) {
      if (!s.completed) continue
      for (const x of s.sets) counts.set(x.exerciseId, (counts.get(x.exerciseId) ?? 0) + 1)
    }
    if (!counts.size) return null
    const [topId] = [...counts.entries()].reduce((a, b) => (b[1] > a[1] ? b : a))
    const name =
      [...SEED_EXERCISES, ...data.customExercises].find((e) => e.id === topId)?.name ?? topId

    const byDate = new Map<string, number>()
    for (const s of data.sessions) {
      if (!s.completed || s.date < days[0]) continue
      for (const x of s.sets) {
        if (x.exerciseId !== topId) continue
        const e1 = estimate1rm(x.weightKg, x.reps)
        byDate.set(s.date, Math.max(byDate.get(s.date) ?? 0, e1))
      }
    }
    if (byDate.size < 2) return null

    return {
      name,
      points: days.map((d) => ({
        label: label(d),
        value: byDate.has(d) ? Number(fmt.weight(byDate.get(d)!)) : null,
      })),
    }
  }, [data.sessions, data.customExercises, days, fmt])

  const scoreCells = days.slice(-14).map((d) => ({
    label: label(d),
    ratio: dayScore(data, d).total / 100,
    empty: dayTotals(data, d).calories === 0 && dayTotals(data, d).workouts === 0,
  }))

  const habitPct = useMemo(() => {
    const active = data.habits.filter((h) => !h.archived)
    if (!active.length) return null
    return active.map((h) => {
      const hits = days.filter((d) => (data.habitLog[d] ?? []).includes(h.id)).length
      return { name: h.name, pct: Math.round((hits / days.length) * 100) }
    })
  }, [data.habits, data.habitLog, days])

  /* -------------------------------- render -------------------------------- */

  return (
    <div className="shell">
      <ScreenHeader title={t('an.title')} back="/progress" />

      <div className="segmented" style={{ marginTop: 'var(--s-4)' }}>
        {([7, 30, 90] as Range[]).map((r) => (
          <button key={r} type="button" aria-selected={range === r} onClick={() => setRange(r)}>
            {t(`an.range.${r}`)}
          </button>
        ))}
      </div>

      {/* ------------------------------- score ----------------------------- */}
      <div className="eyebrow">{t('home.score')}</div>
      <section className="card">
        <div className="grid-2">
          <Stat
            label="Average"
            value={Math.round(averageOf(activeDays.map((d) => dayScore(data, d).total)) ?? 0)}
            unit="/100"
            size="lg"
            tone="ember"
          />
          <Stat
            label="Best day"
            value={Math.max(0, ...days.map((d) => dayScore(data, d).total))}
            unit="/100"
            size="lg"
          />
        </div>
        <p className="an-note">
          Averaged over the {activeDays.length} {activeDays.length === 1 ? 'day' : 'days'} you used
          the app, not all {days.length}.
        </p>
        <div style={{ marginTop: 'var(--s-5)' }}>
          <p className="an-sub">Last 14 days</p>
          <HeatStrip cells={scoreCells} label="Transformation score, last 14 days" />
        </div>
      </section>

      {/* ------------------------------- weight ---------------------------- */}
      <div className="eyebrow">{t('an.weight')}</div>
      <section className="card">
        <div className="grid-3">
          <Stat
            label={t('weight.now')}
            value={fmt.weight(wStats.current)}
            unit={fmt.weightUnit}
            size="md"
          />
          <Stat
            label={t('weight.weeklyAvg')}
            value={fmt.weight(wStats.weeklyAverage)}
            unit={fmt.weightUnit}
            size="md"
          />
          <Stat
            label={t('weight.rate')}
            value={fmtDelta(wStats.ratePerWeek, 2)}
            unit={`${fmt.weightUnit}/wk`}
            size="md"
          />
        </div>
        <div style={{ marginTop: 'var(--s-5)' }}>
          <LineChart
            points={days.map((d) => {
              const kg = data.weights.find((w) => w.date === d)?.kg
              return { label: label(d), value: kg != null ? Number(fmt.weight(kg)) : null }
            })}
            goal={Number(fmt.weight(profile.targetWeightKg))}
            goalLabel="Target"
            seriesName={`Weight (${fmt.weightUnit})`}
            height={160}
          />
        </div>
      </section>

      {/* ------------------------------ nutrition -------------------------- */}
      <div className="eyebrow">{t('an.nutrition')}</div>
      <section className="card">
        {loggedFood.length === 0 ? (
          <p className="an-none">{t('an.noData.body')}</p>
        ) : (
          <>
            <div className="grid-2">
              <Stat
                label={`Average ${t('nutri.calories').toLowerCase()}`}
                value={fmtInt(averageOf(loggedFood.map((x) => x.calories)) ?? 0, locale)}
                unit="kcal"
                size="md"
                hint={`Target ${fmtInt(profile.targets.calories, locale)}`}
              />
              <Stat
                label={`Average ${t('nutri.protein').toLowerCase()}`}
                value={Math.round(averageOf(loggedFood.map((x) => x.protein)) ?? 0)}
                unit="g"
                size="md"
                hint={`Target ${profile.targets.protein} g`}
              />
            </div>

            <p className="an-note">
              Averaged over the {loggedFood.length} {loggedFood.length === 1 ? 'day' : 'days'} you
              logged food, not all {days.length} — unlogged days would drag it into a lie.
            </p>

            <div style={{ marginTop: 'var(--s-5)' }}>
              <BarChart
                points={days.map((d, i) => ({ label: label(d), value: totals[i].calories }))}
                target={profile.targets.calories}
                seriesName="Calories"
                title={t('nutri.calories')}
                unit="kcal"
                height={140}
              />
            </div>

            <div style={{ marginTop: 'var(--s-5)' }}>
              <BarChart
                points={days.map((d, i) => ({ label: label(d), value: totals[i].protein }))}
                target={profile.targets.protein}
                seriesName="Protein"
                title={t('nutri.protein')}
                unit="g"
                height={140}
              />
            </div>

            <div style={{ marginTop: 'var(--s-5)' }}>
              <p className="an-sub">Average macro split</p>
              <MacroBar
                protein={Math.round(averageOf(loggedFood.map((x) => x.protein)) ?? 0)}
                carbs={Math.round(averageOf(loggedFood.map((x) => x.carbs)) ?? 0)}
                fat={Math.round(averageOf(loggedFood.map((x) => x.fat)) ?? 0)}
              />
            </div>
          </>
        )}
      </section>

      {/* ------------------------------ training --------------------------- */}
      <div className="eyebrow">{t('an.training')}</div>
      <section className="card">
        {sessions.length === 0 ? (
          <p className="an-none">No sessions logged in this range.</p>
        ) : (
          <>
            <div className="grid-3">
              <Stat label={t('an.frequency')} value={sessions.length} unit="sessions" size="md" />
              <Stat
                label={t('an.volume')}
                value={fmtInt(sum(sessions.map((s) => s.volumeKg)), locale)}
                unit={fmt.weightUnit}
                size="md"
              />
              <Stat
                label="Average length"
                value={fmtDuration(
                  (averageOf(sessions.filter((s) => s.durationSec).map((s) => s.durationSec! / 60)) ?? 0),
                )}
                size="md"
              />
            </div>

            <div style={{ marginTop: 'var(--s-5)' }}>
              <BarChart
                points={days.map((d, i) => ({ label: label(d), value: totals[i].volumeKg }))}
                seriesName={`Volume (${fmt.weightUnit})`}
                title={t('an.volume')}
                colour="var(--series-1)"
                unit={fmt.weightUnit}
                height={140}
              />
            </div>

            {volumeByMuscle.length > 0 && (
              <div style={{ marginTop: 'var(--s-5)' }}>
                <p className="an-sub">Volume by muscle group</p>
                <ul className="an-muscles">
                  {volumeByMuscle.map((m) => {
                    const max = volumeByMuscle[0].kg || 1
                    return (
                      <li key={m.muscle} className="an-muscle">
                        <span className="an-muscleName">
                          {MUSCLE_LABELS[m.muscle as keyof typeof MUSCLE_LABELS] ?? m.muscle}
                        </span>
                        <span className="an-muscleTrack" aria-hidden="true">
                          <span
                            className="an-muscleFill"
                            style={{ width: `${(m.kg / max) * 100}%` }}
                          />
                        </span>
                        <span className="num an-muscleVal">
                          {fmtInt(Number(fmt.weight(m.kg, 0)), locale)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {strength && (
              <div style={{ marginTop: 'var(--s-5)' }}>
                <LineChart
                  points={strength.points}
                  seriesName={`Estimated 1RM (${fmt.weightUnit})`}
                  title={`${t('an.strength')} · ${strength.name}`}
                  subtitle="Your most-logged lift. Estimated from each session's best set."
                  colour="var(--series-2)"
                  height={150}
                />
              </div>
            )}
          </>
        )}
      </section>

      {/* ------------------------------- cardio ---------------------------- */}
      <div className="eyebrow">{t('an.cardio')}</div>
      <section className="card">
        <div className="grid-3">
          <Stat
            label={t('cardio.steps')}
            value={fmtInt(sum(totals.map((x) => x.steps)), locale)}
            size="md"
          />
          <Stat
            label={t('cardio.distance')}
            value={fmt.distance(sum(totals.map((x) => x.cardioKm)))}
            unit={fmt.distanceUnit}
            size="md"
          />
          <Stat
            label="Time"
            value={fmtDuration(sum(totals.map((x) => x.cardioMinutes)))}
            size="md"
          />
        </div>
        <div style={{ marginTop: 'var(--s-5)' }}>
          <BarChart
            points={days.map((d, i) => ({ label: label(d), value: totals[i].steps }))}
            target={profile.targets.steps}
            seriesName="Steps"
            title={t('cardio.steps')}
            unit="steps"
            height={140}
          />
        </div>
      </section>

      {/* -------------------------------- sleep ---------------------------- */}
      <div className="eyebrow">{t('an.sleep')}</div>
      <section className="card">
        {sleptNights.length === 0 ? (
          <p className="an-none">No sleep logged in this range.</p>
        ) : (
          <>
            <div className="grid-2">
              <Stat
                label="Average"
                value={fmtDuration(averageOf(sleptNights.map((x) => x.sleepMinutes)) ?? 0)}
                size="md"
                tone={
                  (averageOf(sleptNights.map((x) => x.sleepMinutes)) ?? 0) >=
                  profile.targets.sleepHours * 60 * 0.9
                    ? 'good'
                    : 'warn'
                }
              />
              <Stat
                label="Nights logged"
                value={`${sleptNights.length} / ${days.length}`}
                size="md"
              />
            </div>
            <div style={{ marginTop: 'var(--s-5)' }}>
              <BarChart
                points={days.map((d, i) => ({ label: label(d), value: totals[i].sleepMinutes / 60 }))}
                target={profile.targets.sleepHours}
                seriesName="Hours slept"
                title={t('an.sleep')}
                unit="h"
                height={140}
              />
            </div>
          </>
        )}
      </section>

      {/* ------------------------------- habits ---------------------------- */}
      {habitPct && (
        <>
          <div className="eyebrow">{t('an.habits')}</div>
          <section className="card">
            <ul className="an-habits">
              {habitPct.map((h) => (
                <li key={h.name} className="an-habit">
                  <span className="an-habitName truncate">{h.name}</span>
                  <span className="an-muscleTrack" aria-hidden="true">
                    <span className="an-muscleFill" style={{ width: `${h.pct}%` }} />
                  </span>
                  <span className="num an-habitPct">{h.pct}%</span>
                </li>
              ))}
            </ul>
            <p className="an-note">
              Manual ticks only. Automatic habits follow their underlying measure, which you can see
              in the sections above.
            </p>
          </section>
        </>
      )}

      <style>{`
        .an-sub {
          font-family: var(--font-display);
          font-size: var(--fs-micro); font-weight: 700;
          letter-spacing: var(--tr-eyebrow); text-transform: uppercase;
          color: var(--text-3); margin-bottom: var(--s-2);
        }
        .an-none { font-size: var(--fs-sm); color: var(--text-3); }
        .an-note {
          margin-top: var(--s-3);
          font-size: var(--fs-tiny); color: var(--text-3); line-height: 1.5;
        }
        .an-muscles, .an-habits { display: flex; flex-direction: column; gap: var(--s-2); }
        .an-muscle, .an-habit {
          display: flex; align-items: center; gap: var(--s-3);
          min-height: 28px;
        }
        .an-muscleName, .an-habitName {
          width: 5.5rem; flex: none;
          font-size: var(--fs-tiny); color: var(--text-2);
        }
        .an-habitName { width: 7rem; }
        .an-muscleTrack {
          flex: 1; height: 8px; border-radius: var(--r-pill);
          background: var(--surface-inset); overflow: hidden;
        }
        .an-muscleFill {
          display: block; height: 100%;
          background: var(--kiln-3);
          border-radius: var(--r-pill);
        }
        .an-muscleVal, .an-habitPct {
          width: 3.4rem; flex: none; text-align: right;
          font-size: var(--fs-tiny); color: var(--text-1);
        }
      `}</style>
    </div>
  )
}
