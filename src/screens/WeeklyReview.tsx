/* ============================================================================
   Weekly review. Generated, not written — every figure comes from the log, and
   the focus line comes from whichever scoring input averaged lowest that week.

   One recommendation, not five. A review that lists everything you could improve
   is a review you ignore.
   ========================================================================= */

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { dayScore, weeklyReview } from '../lib/calc'
import { useStore } from '../lib/store'
import { useT } from '../lib/i18n'
import { fmtDelta, fmtInt, makeFmt } from '../lib/units'
import { addDays, fmtDate, fmtDuration, fmtWeekday, today, weekStart } from '../lib/date'
import { HeatStrip } from '../components/charts'
import { Empty, ScreenHeader, Stat } from '../components/ui'

export default function WeeklyReviewScreen() {
  const { t, locale } = useT()
  const { data } = useStore()
  const profile = data.profile!
  const fmt = useMemo(() => makeFmt(profile.units), [profile.units])

  const [anchor, setAnchor] = useState(weekStart(today()))
  const review = useMemo(() => weeklyReview(data, anchor), [data, anchor])

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(anchor, i)),
    [anchor],
  )
  const cells = days.map((d) => {
    const future = d > today()
    return {
      label: fmtWeekday(d, locale).slice(0, 2),
      ratio: future ? 0 : dayScore(data, d).total / 100,
      empty: future,
    }
  })

  const loggedDays = days.filter((d) => d <= today())
  const thin = review.avgCalories === 0 && review.workouts === 0

  const atCurrentWeek = anchor >= weekStart(today())
  const beforeStart = addDays(anchor, -7) < weekStart(profile.createdAt)

  return (
    <div className="shell">
      <ScreenHeader title={t('rev.title')} back={true} />

      <div className="wr-nav">
        <button
          type="button"
          className="icon-btn"
          aria-label="Previous week"
          disabled={beforeStart}
          style={{ opacity: beforeStart ? 0.3 : 1 }}
          onClick={() => setAnchor(addDays(anchor, -7))}
        >
          <ChevronLeft size={19} aria-hidden="true" />
        </button>
        <div className="wr-navLabel">
          <span className="wr-week">{t('rev.week', { n: review.weekNumber })}</span>
          <span className="wr-range num">
            {fmtDate(anchor, locale)} – {fmtDate(addDays(anchor, 6), locale)}
          </span>
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label="Next week"
          disabled={atCurrentWeek}
          style={{ opacity: atCurrentWeek ? 0.3 : 1 }}
          onClick={() => setAnchor(addDays(anchor, 7))}
        >
          <ChevronRight size={19} aria-hidden="true" />
        </button>
      </div>

      {thin ? (
        <Empty title={t('rev.noData')} body={t('rev.noData.body')} />
      ) : (
        <>
          {/* --------------------------- the score --------------------------- */}
          <section className="card">
            <div className="wr-score">
              <span className="num wr-scoreVal">{review.score}</span>
              <span className="wr-scoreOf">/ 100 average</span>
            </div>
            <HeatStrip cells={cells} label="Daily score this week" />
          </section>

          {/* --------------------------- the numbers ------------------------- */}
          <div className="eyebrow">The week in numbers</div>
          <section className="card">
            <div className="wr-grid">
              <Stat
                label={t('weight.title')}
                value={review.weightChange == null ? '—' : fmtDelta(Number(fmt.weight(review.weightChange, 1)))}
                unit={fmt.weightUnit}
                size="md"
                tone={
                  review.weightChange == null
                    ? 'dim'
                    : goingRight(review.weightChange, profile.startWeightKg, profile.targetWeightKg)
                      ? 'good'
                      : 'warn'
                }
              />
              <Stat
                label={`Avg ${t('nutri.calories').toLowerCase()}`}
                value={review.avgCalories ? fmtInt(review.avgCalories, locale) : '—'}
                unit="kcal"
                size="md"
                hint={`target ${fmtInt(profile.targets.calories, locale)}`}
              />
              <Stat
                label={`Avg ${t('nutri.protein').toLowerCase()}`}
                value={review.avgProtein || '—'}
                unit="g"
                size="md"
                hint={`target ${profile.targets.protein}`}
                tone={
                  review.avgProtein >= profile.targets.protein * 0.95
                    ? 'good'
                    : review.avgProtein > 0
                      ? 'warn'
                      : 'dim'
                }
              />
              <Stat
                label={t('wk.title')}
                value={review.workouts}
                size="md"
                hint={`target ${profile.targets.workoutsPerWeek}`}
                tone={review.workouts >= profile.targets.workoutsPerWeek ? 'good' : 'warn'}
              />
              <Stat
                label={t('cardio.steps')}
                value={fmtInt(review.totalSteps, locale)}
                size="md"
                hint={`target ${fmtInt(profile.targets.steps * 7, locale)}`}
              />
              <Stat
                label={`Avg ${t('sleep.title').toLowerCase()}`}
                value={review.avgSleepHours ? fmtDuration(review.avgSleepHours * 60) : '—'}
                size="md"
                hint={`target ${profile.targets.sleepHours}h`}
                tone={
                  review.avgSleepHours >= profile.targets.sleepHours * 0.9
                    ? 'good'
                    : review.avgSleepHours > 0
                      ? 'warn'
                      : 'dim'
                }
              />
              <Stat
                label={t('wk.volume')}
                value={review.volumeKg ? fmtInt(review.volumeKg, locale) : '—'}
                unit={fmt.weightUnit}
                size="md"
              />
              <Stat
                label={t('pr.new')}
                value={review.prs}
                size="md"
                tone={review.prs > 0 ? 'ember' : 'dim'}
              />
            </div>

            <p className="wr-note">
              Calorie and protein averages cover the days you logged food, not all{' '}
              {loggedDays.length}.
            </p>
          </section>

          {/* ---------------------------- the focus -------------------------- */}
          <div className="eyebrow">{t('rev.focus')}</div>
          <section className="card card--ember">
            {review.focus ? (
              <>
                <p className="wr-focusWhat">
                  <Sparkles size={14} aria-hidden="true" />
                  {review.focus.label}
                </p>
                <p className="wr-focusMsg">{review.focus.message}</p>
              </>
            ) : (
              <>
                <p className="wr-focusWhat">
                  <Sparkles size={14} aria-hidden="true" />
                  Nothing to fix
                </p>
                <p className="wr-focusMsg">
                  Every input cleared 85% this week. Hold the same pattern and let the trend do its
                  work.
                </p>
              </>
            )}
          </section>
        </>
      )}

      <style>{`
        .wr-nav {
          display: flex; align-items: center; gap: var(--s-2);
          padding: var(--s-4) 0 var(--s-3);
        }
        .wr-navLabel {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; gap: 1px;
        }
        .wr-week {
          font-family: var(--font-display);
          font-size: var(--fs-lg); font-weight: 800;
          letter-spacing: var(--tr-display);
        }
        .wr-range { font-size: var(--fs-tiny); color: var(--text-3); }

        .wr-score {
          display: flex; align-items: baseline; gap: var(--s-2);
          margin-bottom: var(--s-4);
        }
        .wr-scoreVal {
          font-size: var(--fs-4xl); font-weight: 600; line-height: 1;
          letter-spacing: -0.035em; color: var(--kiln-4);
        }
        .wr-scoreOf { font-size: var(--fs-sm); color: var(--text-3); }

        .wr-grid {
          display: grid; grid-template-columns: repeat(2, 1fr);
          gap: var(--s-4) var(--s-3);
        }
        .wr-note {
          margin-top: var(--s-4); padding-top: var(--s-3);
          border-top: 1px solid var(--hairline);
          font-size: var(--fs-tiny); color: var(--text-3); line-height: 1.5;
        }

        .wr-focusWhat {
          display: flex; align-items: center; gap: 6px;
          font-family: var(--font-display);
          font-size: var(--fs-micro); font-weight: 700;
          letter-spacing: var(--tr-eyebrow); text-transform: uppercase;
          color: var(--ember);
        }
        .wr-focusMsg {
          margin-top: var(--s-2);
          font-size: var(--fs-base); color: var(--text-1);
          line-height: 1.5; max-width: 42ch;
        }
      `}</style>
    </div>
  )
}

function goingRight(change: number, start: number, target: number): boolean {
  return start > target ? change <= 0 : change >= 0
}
