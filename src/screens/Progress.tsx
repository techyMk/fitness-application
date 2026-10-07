/* ============================================================================
   Progress hub. Three things, in the order a user wants them: the weight trend,
   the week's heat, and the ways in.
   ========================================================================= */

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart3,
  CalendarDays,
  Camera,
  Flag,
  Medal,
  ScrollText,
  Target,
  Trophy,
} from 'lucide-react'
import { dayScore, predictGoal, weeklyReview, weightStats } from '../lib/calc'
import { useStore } from '../lib/store'
import { useT } from '../lib/i18n'
import { fmtDelta, fmtInt, makeFmt } from '../lib/units'
import { fmtDate, fmtWeekday, lastNDays, today, weekStart } from '../lib/date'
import { HeatStrip, LineChart } from '../components/charts'
import { ScreenHeader, Stat } from '../components/ui'
import { NavRow } from './Workout'

export function Progress() {
  const { t, locale } = useT()
  const { data } = useStore()
  const profile = data.profile!
  const fmt = useMemo(() => makeFmt(profile.units), [profile.units])

  const wStats = useMemo(() => weightStats(data), [data])
  const prediction = useMemo(() => predictGoal(data), [data])
  const review = useMemo(() => weeklyReview(data, today()), [data])

  // Last 30 days of weigh-ins, gaps preserved.
  const chart = useMemo(() => {
    const days = lastNDays(30)
    const byDate = new Map(data.weights.map((w) => [w.date, w.kg]))
    const points = days.map((d) => ({
      label: fmtDate(d, locale).split(' ')[0],
      value: byDate.has(d) ? Number(fmt.weight(byDate.get(d)!)) : null,
    }))

    // A smoothed overlay carried across gaps, so the trend reads as continuous
    // even when weigh-ins aren't daily.
    let acc: number | null = null
    const trend = days.map((d) => {
      const v = byDate.get(d)
      if (v != null) {
        const display = Number(fmt.weight(v))
        acc = acc == null ? display : 0.25 * display + 0.75 * acc
      }
      return acc
    })

    return { points, trend }
  }, [data.weights, fmt, locale])

  const weekCells = useMemo(() => {
    const start = weekStart(today())
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(`${start}T00:00:00`)
      date.setDate(date.getDate() + i)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      const future = key > today()
      return {
        label: fmtWeekday(key, locale).slice(0, 2),
        ratio: future ? 0 : dayScore(data, key).total / 100,
        empty: future,
      }
    })
  }, [data, locale])

  return (
    <div className="shell">
      <ScreenHeader title={t('prog.title')} />

      {/* ------------------------- weight headline ------------------------- */}
      <section className="card" style={{ marginTop: 'var(--s-4)' }} aria-labelledby="pr-w">
        <h2 id="pr-w" className="eyebrow" style={{ marginTop: 0 }}>
          {t('weight.title')}
        </h2>

        <div className="pg-stats">
          <Stat
            label={t('weight.now')}
            value={fmt.weight(wStats.current)}
            unit={fmt.weightUnit}
            size="lg"
          />
          <Stat
            label={t('weight.trend')}
            value={fmt.weight(wStats.trend)}
            unit={fmt.weightUnit}
            size="lg"
            tone="ember"
          />
          <Stat
            label={t('weight.rate')}
            value={fmtDelta(wStats.ratePerWeek, 2)}
            unit={`${fmt.weightUnit}/wk`}
            size="lg"
            tone={
              wStats.ratePerWeek == null
                ? 'dim'
                : headingRight(wStats.ratePerWeek, profile.startWeightKg, profile.targetWeightKg)
                  ? 'good'
                  : 'warn'
            }
          />
        </div>

        <div style={{ marginTop: 'var(--s-5)' }}>
          <LineChart
            points={chart.points}
            trend={chart.trend}
            goal={Number(fmt.weight(profile.targetWeightKg))}
            goalLabel={`Target ${fmt.weight(profile.targetWeightKg)}`}
            seriesName={`Weight (${fmt.weightUnit})`}
            subtitle="Last 30 days. Days without a weigh-in leave a gap."
            height={168}
          />
        </div>

        <p className="pg-caveat">
          {prediction.date
            ? `Estimated to hit target around ${fmtDate(prediction.date, locale)}. ${t('weight.predict.caveat')}`
            : prediction.reason === 'flat'
              ? t('weight.predict.flat')
              : prediction.reason === 'wrong-way'
                ? t('weight.predict.wrongWay')
                : t('weight.predict.none')}
        </p>

        <Link to="/weight" className="btn btn--ghost btn--block" style={{ marginTop: 'var(--s-3)' }}>
          {t('weight.title')}
        </Link>
      </section>

      {/* -------------------------- this week heat ------------------------- */}
      <div className="eyebrow">
        {t('common.week')} {review.weekNumber}
        <Link to="/review" className="eyebrow__action">
          {t('rev.title')}
        </Link>
      </div>

      <section className="card">
        <HeatStrip cells={weekCells} label="Transformation score this week" />

        <div className="pg-weekStats">
          {/* "Score", not "Transformation score" — four columns on a phone is
              already tight, and the eyebrow above names the section. */}
          <Stat label="Score" value={review.score} unit="/100" size="md" />
          <Stat label={t('wk.title')} value={review.workouts} size="md" />
          <Stat
            label={t('weight.title')}
            value={fmtDelta(review.weightChange)}
            unit={fmt.weightUnit}
            size="md"
            tone={review.weightChange == null ? 'dim' : 'default'}
          />
          <Stat label={t('cardio.steps')} value={fmtInt(review.totalSteps, locale)} size="md" />
        </div>

        {review.focus && (
          <p className="pg-focus">
            <span className="t-micro" style={{ color: 'var(--ember)' }}>
              {t('rev.focus')}
            </span>
            {review.focus.message}
          </p>
        )}
      </section>

      {/* ------------------------------ ways in --------------------------- */}
      <div className="eyebrow">Explore</div>
      <div className="card card--flush">
        <NavRow
          to="/photos"
          icon={<Camera size={17} aria-hidden="true" />}
          title={t('photos.title')}
          meta={data.photos.length ? `${data.photos.length} photos · private` : t('photos.empty.body')}
        />
        <div className="divider" />
        <NavRow
          to="/analytics"
          icon={<BarChart3 size={17} aria-hidden="true" />}
          title={t('an.title')}
          meta="Weight, food, training, cardio, sleep, habits"
        />
        <div className="divider" />
        <NavRow
          to="/timeline"
          icon={<ScrollText size={17} aria-hidden="true" />}
          title={t('tl.title')}
          meta="Everything that happened, in order"
        />
        <div className="divider" />
        <NavRow
          to="/calendar"
          icon={<CalendarDays size={17} aria-hidden="true" />}
          title={t('cal.title')}
          meta="Tap a day to see its full record"
        />
        <div className="divider" />
        <NavRow
          to="/goals"
          icon={<Target size={17} aria-hidden="true" />}
          title={t('goals.title')}
          meta={data.goals.filter((g) => !g.archived).length ? `${data.goals.filter((g) => !g.archived).length} active` : t('goals.empty.body')}
        />
        <div className="divider" />
        <NavRow
          to="/challenges"
          icon={<Flag size={17} aria-hidden="true" />}
          title={t('ch.title')}
          meta={data.challenges.some((c) => c.active) ? 'Running' : t('ch.empty.body')}
        />
        <div className="divider" />
        <NavRow
          to="/records"
          icon={<Trophy size={17} aria-hidden="true" />}
          title={t('pr.title')}
          meta={`${data.records.length} gym · ${data.nonGymRecords.length} other`}
        />
        <div className="divider" />
        <NavRow
          to="/achievements"
          icon={<Medal size={17} aria-hidden="true" />}
          title={t('ach.title')}
          meta={`${Object.keys(data.achievements).length} unlocked`}
        />
      </div>

      <style>{`
        .pg-stats { display: flex; gap: var(--s-5); margin-top: var(--s-3); }
        .pg-caveat {
          margin-top: var(--s-4); padding-top: var(--s-3);
          border-top: 1px solid var(--hairline);
          font-size: var(--fs-tiny); color: var(--text-3); line-height: 1.5;
        }
        .pg-weekStats {
          display: grid; grid-template-columns: repeat(4, 1fr);
          gap: var(--s-3); margin-top: var(--s-5);
        }
        .pg-focus {
          display: flex; flex-direction: column; gap: 4px;
          margin-top: var(--s-4); padding: var(--s-3);
          background: var(--ember-soft);
          border-radius: var(--r-sm);
          font-size: var(--fs-tiny); color: var(--text-2); line-height: 1.5;
        }
      `}</style>
    </div>
  )
}

function headingRight(rate: number, start: number, target: number): boolean {
  return start > target ? rate < 0 : rate > 0
}
