/* ============================================================================
   Home. Today's answer, in one scroll.

   Card order matters: the challenge banner (if running) and the Forge Ring come
   first because they answer "how am I doing" without a tap. Everything below is
   the day's ledger — each row a target, its progress, and a one-tap way to log
   against it. Cards are reorderable and hideable from Settings (spec §5).

   The whole screen is derived. The only things a user types here are a weight and
   a step count, both through a sheet that opens pre-filled.
   ========================================================================= */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bed,
  CheckCircle2,
  ChevronRight,
  Dumbbell,
  Flame,
  Footprints,
  ListChecks,
  Plus,
  Scale,
  Settings2,
  Trophy,
  UtensilsCrossed,
} from 'lucide-react'
import type { DashCardId } from '../lib/types'
import {
  currentStreak,
  dayScore,
  dayTotals,
  effectiveHabits,
  isRestDay,
  predictGoal,
  weightStats,
  type ScorePart,
} from '../lib/calc'
import { useStore } from '../lib/store'
import { useT } from '../lib/i18n'
import { fmtInt, makeFmt } from '../lib/units'
import { daysBetween, fmtDuration, fmtLongDate, today } from '../lib/date'
import { ForgeLegend, ForgeRing } from '../components/ForgeRing'
import { MacroBar } from '../components/charts'
import { Meter, Sheet, Stat, Stepper, useToast } from '../components/ui'

export function Home() {
  const { t, locale } = useT()
  const { data, actions } = useStore()
  const toast = useToast()
  const profile = data.profile!
  const fmt = useMemo(() => makeFmt(profile.units), [profile.units])
  const date = today()

  const totals = useMemo(() => dayTotals(data, date), [data, date])
  const score = useMemo(() => dayScore(data, date), [data, date])
  const wStats = useMemo(() => weightStats(data), [data])
  const prediction = useMemo(() => predictGoal(data), [data])
  const streak = useMemo(() => currentStreak(data), [data])
  const restDay = isRestDay(data, date)

  const [activeSeg, setActiveSeg] = useState<ScorePart['key'] | null>(null)
  const [weightSheet, setWeightSheet] = useState(false)
  const [stepSheet, setStepSheet] = useState(false)

  const plan = data.plans.find((p) => p.id === data.activePlanId)
  const weekday = new Date(`${date}T00:00:00`).getDay()
  const planDay = plan?.days.find((d) => d.weekday === weekday)
  const liveSession = data.sessions.find((s) => !s.completed)
  const challenge = data.challenges.find((c) => c.active)
  const checkedIn = !!totals.checkIn

  // Order and visibility both come from the saved dashboard layout (spec §5).
  const order: DashCardId[] = data.dashboard.filter((c) => c.visible).map((c) => c.id)

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return t('home.greeting.morning')
    if (h < 17) return t('home.greeting.afternoon')
    return t('home.greeting.evening')
  })()

  /* --------------------------------- cards -------------------------------- */

  const cards: Record<DashCardId, React.ReactNode> = {
    challenge: challenge ? <ChallengeCard /> : null,

    score: (
      <section className="card hm-score" aria-labelledby="hm-score-h">
        <div className="row row--between">
          <div>
            <h2 id="hm-score-h" className="hm-cardTitle">
              {t('home.score')}
            </h2>
            <p className="hm-cardHint">{t('home.score.hint')}</p>
          </div>
          <Link to="/analytics" className="icon-btn" aria-label={t('an.title')}>
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
        </div>

        <div className="hm-score__ring">
          <ForgeRing score={score} activeKey={activeSeg} onSelect={setActiveSeg} size={196} />
        </div>

        {activeSeg && <SegmentDetail seg={activeSeg} />}

        <ForgeLegend score={score} activeKey={activeSeg} onSelect={setActiveSeg} />

        <div className="hm-score__foot">
          <span className="t-micro dim">{t('home.streak')}</span>
          <span className="num hm-streak">
            <Flame size={14} aria-hidden="true" />
            {streak}
            <span className="t-unit">{streak === 1 ? 'day' : 'days'}</span>
          </span>
        </div>
      </section>
    ),

    weight: (
      <section className="card" aria-labelledby="hm-weight-h">
        <div className="row row--between">
          <h2 id="hm-weight-h" className="hm-cardTitle">
            <Scale size={14} aria-hidden="true" /> {t('home.weight')}
          </h2>
          <Link to="/weight" className="hm-more">
            {t('weight.trend')}
            <ChevronRight size={14} aria-hidden="true" />
          </Link>
        </div>

        <div className="hm-weight">
          <Stat
            label={t('weight.now')}
            value={fmt.weight(wStats.current)}
            unit={fmt.weightUnit}
            size="xl"
          />
          <div className="hm-weight__side">
            <Stat
              label={wStats.change != null && wStats.change <= 0 ? t('weight.lost') : t('weight.gained')}
              value={fmt.weight(wStats.change == null ? null : Math.abs(wStats.change))}
              unit={fmt.weightUnit}
              tone={
                wStats.change == null
                  ? 'dim'
                  : isMovingRight(wStats.change, profile.startWeightKg, profile.targetWeightKg)
                    ? 'good'
                    : 'warn'
              }
              size="md"
            />
            <Stat
              label={t('weight.remaining')}
              value={fmt.weight(wStats.remaining == null ? null : Math.abs(wStats.remaining))}
              unit={fmt.weightUnit}
              size="md"
              tone="dim"
            />
          </div>
        </div>

        <div className="hm-weight__bar">
          <div className="row row--between hm-weight__ends">
            <span className="num">{fmt.weight(wStats.start)}</span>
            <span className="num hm-weight__pct">{Math.round(wStats.progressPct)}% there</span>
            <span className="num">{fmt.weight(wStats.target)}</span>
          </div>
          <Meter value={wStats.progressPct} max={100} label="Progress toward target weight" showOver={false} />
        </div>

        {prediction.date && prediction.reason !== 'reached' && (
          <p className="hm-predict">
            <span className="t-micro dim">{t('weight.predict')}</span>
            <span className="num hm-predictDate">
              {fmtLongDate(prediction.date, locale).replace(/^\w+,?\s*/, '')}
            </span>
            <span className="hm-predictNote">
              {prediction.confidence === 'low' ? t('weight.predict.low') : t('weight.predict.caveat')}
            </span>
          </p>
        )}
        {!prediction.date && prediction.reason && (
          <p className="hm-predict">
            <span className="hm-predictNote">
              {prediction.reason === 'flat'
                ? t('weight.predict.flat')
                : prediction.reason === 'wrong-way'
                  ? t('weight.predict.wrongWay')
                  : t('weight.predict.none')}
            </span>
          </p>
        )}

        <button
          type="button"
          className="btn btn--ghost btn--block"
          style={{ marginTop: 'var(--s-3)' }}
          onClick={() => setWeightSheet(true)}
        >
          <Plus size={16} aria-hidden="true" />
          {t('home.logWeight')}
        </button>
      </section>
    ),

    nutrition: (
      <section className="card" aria-labelledby="hm-food-h">
        <div className="row row--between">
          <h2 id="hm-food-h" className="hm-cardTitle">
            <UtensilsCrossed size={14} aria-hidden="true" /> {t('home.nutrition')}
          </h2>
          <Link to="/nutrition" className="hm-more">
            {t('nutri.addFood')}
            <ChevronRight size={14} aria-hidden="true" />
          </Link>
        </div>

        <TargetRow
          label={t('nutri.calories')}
          value={totals.calories}
          target={profile.targets.calories}
          unit="kcal"
        />
        <TargetRow
          label={t('nutri.protein')}
          value={totals.protein}
          target={profile.targets.protein}
          unit="g"
        />

        <div style={{ marginTop: 'var(--s-4)' }}>
          <MacroBar protein={totals.protein} carbs={totals.carbs} fat={totals.fat} />
        </div>
      </section>
    ),

    workout: (
      <section className="card" aria-labelledby="hm-train-h">
        <div className="row row--between">
          <h2 id="hm-train-h" className="hm-cardTitle">
            <Dumbbell size={14} aria-hidden="true" /> {t('home.training')}
          </h2>
          <Link to="/workout" className="hm-more">
            {t('wk.plans')}
            <ChevronRight size={14} aria-hidden="true" />
          </Link>
        </div>

        {totals.workouts > 0 ? (
          <div className="hm-done">
            <CheckCircle2 size={18} aria-hidden="true" />
            <div className="grow">
              <p className="hm-doneTitle">{t('wk.complete')}</p>
              <p className="hm-doneMeta num">
                {fmtInt(totals.volumeKg, locale)} {fmt.weightUnit} {t('wk.volume').toLowerCase()}
                {totals.workouts > 1 && ` · ${totals.workouts} sessions`}
              </p>
            </div>
          </div>
        ) : restDay ? (
          <div className="hm-rest">
            <p className="hm-restTitle">{t('home.restDay')}</p>
            <p className="hm-restBody">{t('home.restDay.body')}</p>
          </div>
        ) : (
          <>
            <p className="hm-planTitle">{planDay?.title ?? t('wk.freeSession')}</p>
            {planDay && planDay.exerciseIds.length > 0 && (
              <p className="hm-planMeta">
                {planDay.exerciseIds.length} exercises · {plan?.name}
              </p>
            )}
            <Link
              to={liveSession ? `/workout/session/${liveSession.id}` : '/workout'}
              className="btn btn--primary btn--block"
              style={{ marginTop: 'var(--s-3)' }}
            >
              <Dumbbell size={16} aria-hidden="true" />
              {liveSession ? t('wk.resume') : t('home.startWorkout')}
            </Link>
          </>
        )}
      </section>
    ),

    movement: (
      <section className="card" aria-labelledby="hm-move-h">
        <div className="row row--between">
          <h2 id="hm-move-h" className="hm-cardTitle">
            <Footprints size={14} aria-hidden="true" /> {t('home.movement')}
          </h2>
          <Link to="/cardio" className="hm-more">
            {t('cardio.log')}
            <ChevronRight size={14} aria-hidden="true" />
          </Link>
        </div>

        <TargetRow
          label={t('cardio.steps')}
          value={totals.steps}
          target={profile.targets.steps}
          onTap={() => setStepSheet(true)}
        />

        {totals.cardioMinutes > 0 && (
          <div className="row row--between hm-cardioRow">
            <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
              {t('cardio.title')}
            </span>
            <span className="num" style={{ fontSize: 'var(--fs-sm)' }}>
              {fmtDuration(totals.cardioMinutes)}
              {totals.cardioKm > 0 && ` · ${fmt.distanceLabel(totals.cardioKm)}`}
            </span>
          </div>
        )}
      </section>
    ),

    sleep: (
      <Link to="/sleep" className="card hm-link" aria-label={`${t('home.sleep')}: ${totals.sleepMinutes ? fmtDuration(totals.sleepMinutes) : 'not logged'}`}>
        <div className="row">
          <span className="hm-icon">
            <Bed size={16} aria-hidden="true" />
          </span>
          <div className="grow">
            <span className="t-micro dim">{t('home.sleep')}</span>
            <p className="num hm-linkValue">
              {totals.sleepMinutes ? fmtDuration(totals.sleepMinutes) : '—'}
              <span className="t-unit"> / {profile.targets.sleepHours}h</span>
            </p>
          </div>
          <ChevronRight size={18} className="dim" aria-hidden="true" />
        </div>
        {totals.sleepMinutes > 0 && (
          <div style={{ marginTop: 'var(--s-3)' }}>
            <Meter
              value={totals.sleepMinutes}
              max={profile.targets.sleepHours * 60}
              label="Sleep against target"
              showOver={false}
            />
          </div>
        )}
      </Link>
    ),

    habits: (
      <section className="card" aria-labelledby="hm-habit-h">
        <div className="row row--between">
          <h2 id="hm-habit-h" className="hm-cardTitle">
            <ListChecks size={14} aria-hidden="true" /> {t('home.habits')}
          </h2>
          <Link to="/habits" className="hm-more">
            {t('common.edit')}
            <ChevronRight size={14} aria-hidden="true" />
          </Link>
        </div>

        {data.habits.filter((h) => !h.archived).length === 0 ? (
          <p className="hm-cardHint">{t('habits.empty.body')}</p>
        ) : (
          <ul className="hm-habits">
            {data.habits
              .filter((h) => !h.archived)
              .map((h) => {
                const done = effectiveHabits(data, date).includes(h.id)
                return (
                  <li key={h.id}>
                    <button
                      type="button"
                      className="hm-habit"
                      data-on={done}
                      aria-pressed={done}
                      disabled={!!h.auto}
                      onClick={() => actions.toggleHabit(h.id, date)}
                      title={h.auto ? t('habits.auto.hint') : undefined}
                    >
                      <span className="hm-habitBox" aria-hidden="true">
                        {done && <CheckCircle2 size={13} strokeWidth={3} />}
                      </span>
                      <span className="grow truncate">{h.name}</span>
                      {h.auto && <span className="hm-habitAuto">{t('habits.auto')}</span>}
                    </button>
                  </li>
                )
              })}
          </ul>
        )}
      </section>
    ),

    records: data.records.length > 0 || data.nonGymRecords.length > 0 ? <RecordsTeaser /> : null,
  }

  /* --------------------------------- render -------------------------------- */

  return (
    <div className="shell">
      <header className="hm-head">
        <div className="grow">
          <p className="hm-greet">
            {greeting}
            {profile.name ? `, ${profile.name}` : ''}
          </p>
          <h1 className="hm-date">{fmtLongDate(date, locale)}</h1>
        </div>
        <Link to="/settings" className="icon-btn" aria-label={t('home.customise')}>
          <Settings2 size={20} aria-hidden="true" />
        </Link>
      </header>

      {!checkedIn && (
        <Link to="/check-in" className="hm-checkin">
          <span className="hm-checkinDot" aria-hidden="true" />
          <span className="grow">{t('home.checkIn')}</span>
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
      )}

      <div className="hm-cards">
        {order.map((id) => (cards[id] ? <div key={id}>{cards[id]}</div> : null))}
      </div>

      {/* ------------------------------ sheets ------------------------------ */}
      <WeightSheet
        open={weightSheet}
        onClose={() => setWeightSheet(false)}
        current={wStats.current ?? profile.startWeightKg}
      />
      <StepSheet open={stepSheet} onClose={() => setStepSheet(false)} current={totals.steps} />

      <style>{`
        .hm-head {
          display: flex; align-items: flex-start; gap: var(--s-2);
          padding: calc(var(--safe-t) + var(--s-5)) 0 var(--s-4);
        }
        .hm-greet {
          font-family: var(--font-display);
          font-size: var(--fs-micro); font-weight: 700;
          letter-spacing: var(--tr-eyebrow); text-transform: uppercase;
          color: var(--ember);
        }
        .hm-date {
          margin-top: 2px;
          font-size: var(--fs-xl); font-weight: 800;
          letter-spacing: var(--tr-display);
        }

        .hm-checkin {
          display: flex; align-items: center; gap: var(--s-3);
          min-height: 48px; padding: 0 var(--s-4);
          margin-bottom: var(--s-4);
          background: var(--ember-soft);
          border: 1px solid var(--ember-line);
          border-radius: var(--r-md);
          font-size: var(--fs-sm); font-weight: 600;
          color: var(--ember);
        }
        .hm-checkinDot {
          width: 7px; height: 7px; border-radius: 50%;
          background: var(--ember); flex: none;
        }

        .hm-cards { display: flex; flex-direction: column; gap: var(--s-3); }

        .hm-cardTitle {
          display: flex; align-items: center; gap: 6px;
          font-family: var(--font-display);
          font-size: var(--fs-micro); font-weight: 700;
          letter-spacing: var(--tr-eyebrow); text-transform: uppercase;
          color: var(--text-3);
        }
        .hm-cardHint {
          margin-top: 3px;
          font-size: var(--fs-tiny); color: var(--text-3);
          max-width: 34ch; line-height: 1.4;
        }
        /* The visual footprint stays small, but the tap area is padded out to
           44px and pulled back with negative margin so the header row keeps its
           rhythm. Hit area and ink size are different problems. */
        .hm-more {
          display: inline-flex; align-items: center; gap: 2px;
          flex: none; min-height: 44px;
          padding-left: var(--s-3); padding-right: var(--s-2);
          margin-right: calc(var(--s-2) * -1);
          font-family: var(--font-display);
          font-size: var(--fs-micro); font-weight: 700;
          letter-spacing: 0.06em; text-transform: uppercase;
          color: var(--text-3);
        }
        .hm-more:hover { color: var(--ember); }

        .hm-score__ring {
          display: grid; place-items: center;
          padding: var(--s-5) 0 var(--s-4);
        }
        .hm-score__foot {
          display: flex; align-items: center; justify-content: space-between;
          margin-top: var(--s-4); padding-top: var(--s-3);
          border-top: 1px solid var(--hairline);
        }
        .hm-streak {
          display: flex; align-items: center; gap: 5px;
          font-size: var(--fs-lg); font-weight: 600;
          color: var(--kiln-4);
        }

        .hm-weight {
          display: flex; align-items: flex-end; gap: var(--s-5);
          margin-top: var(--s-4);
        }
        .hm-weight__side { display: flex; gap: var(--s-5); }
        .hm-weight__bar { margin-top: var(--s-4); }
        .hm-weight__ends {
          font-size: var(--fs-tiny); color: var(--text-3);
          margin-bottom: 5px;
        }
        .hm-weight__pct { color: var(--text-2); }

        .hm-predict {
          display: flex; flex-direction: column; gap: 2px;
          margin-top: var(--s-4); padding-top: var(--s-3);
          border-top: 1px solid var(--hairline);
        }
        .hm-predictDate {
          font-size: var(--fs-base); font-weight: 600; color: var(--text-1);
        }
        .hm-predictNote { font-size: var(--fs-tiny); color: var(--text-3); }

        .hm-done {
          display: flex; align-items: center; gap: var(--s-3);
          margin-top: var(--s-3); padding: var(--s-3);
          background: var(--good-soft);
          border: 1px solid var(--good);
          border-radius: var(--r-md);
          color: var(--good);
        }
        .hm-doneTitle { font-size: var(--fs-sm); font-weight: 700; }
        .hm-doneMeta { font-size: var(--fs-tiny); opacity: 0.85; }

        .hm-rest { margin-top: var(--s-3); }
        .hm-restTitle {
          font-family: var(--font-display);
          font-size: var(--fs-lg); font-weight: 700;
        }
        .hm-restBody { font-size: var(--fs-tiny); color: var(--text-3); margin-top: 2px; }

        .hm-planTitle {
          margin-top: var(--s-3);
          font-family: var(--font-display);
          font-size: var(--fs-lg); font-weight: 700;
          letter-spacing: var(--tr-display);
        }
        .hm-planMeta { font-size: var(--fs-tiny); color: var(--text-3); margin-top: 2px; }

        .hm-cardioRow { margin-top: var(--s-3); padding-top: var(--s-3); border-top: 1px solid var(--hairline); }

        .hm-link { display: block; }
        .hm-icon {
          display: grid; place-items: center;
          width: 34px; height: 34px; flex: none;
          border-radius: var(--r-sm);
          background: var(--surface-2); color: var(--text-2);
        }
        .hm-linkValue { font-size: var(--fs-lg); font-weight: 600; }

        .hm-habits { display: flex; flex-direction: column; gap: 2px; margin-top: var(--s-2); }
        .hm-habit {
          display: flex; align-items: center; gap: var(--s-3);
          width: 100%; min-height: 44px; padding: 0 var(--s-1);
          border-radius: var(--r-sm);
          font-size: var(--fs-sm); color: var(--text-2);
          text-align: left;
          transition: color var(--t-fast) var(--ease-out);
        }
        .hm-habit:hover:not(:disabled) { color: var(--text-1); }
        .hm-habit:disabled { cursor: default; }
        .hm-habit[data-on='true'] { color: var(--text-1); }
        .hm-habitBox {
          display: grid; place-items: center;
          width: 20px; height: 20px; flex: none;
          border-radius: 5px;
          border: 1.5px solid var(--hairline-strong);
          color: var(--text-on-ember);
        }
        .hm-habit[data-on='true'] .hm-habitBox {
          background: var(--kiln-4); border-color: var(--kiln-4);
        }
        .hm-habitAuto {
          flex: none;
          font-family: var(--font-display);
          font-size: 9px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--text-3);
        }
      `}</style>
    </div>
  )

  /* ------------------------------ sub-renders ----------------------------- */

  function SegmentDetail({ seg }: { seg: ScorePart['key'] }) {
    const part = score.parts.find((p) => p.key === seg)!
    const copy: Record<ScorePart['key'], string> = {
      workout: restDay
        ? 'Rest day — resting is the plan, so this scores full.'
        : totals.workouts > 0
          ? 'Session logged.'
          : 'No session yet today.',
      nutrition: totals.calories
        ? `${fmtInt(totals.calories, locale)} of ${fmtInt(profile.targets.calories, locale)} kcal. The band peaks between 90% and 105%.`
        : 'Nothing logged yet.',
      protein: `${totals.protein} of ${profile.targets.protein} g. More than target is fine.`,
      movement: `${fmtInt(totals.steps, locale)} steps. 45 minutes of cardio also covers this.`,
      sleep: totals.sleepMinutes
        ? `${fmtDuration(totals.sleepMinutes)} against a ${profile.targets.sleepHours}h target.`
        : 'No sleep logged.',
      habits: `${totals.habitsDone} of ${totals.habitsTotal} habits done.`,
      checkin: totals.checkIn ? 'Checked in.' : 'Twenty seconds, and it sharpens the rest.',
    }
    return (
      <p className="hm-segDetail" role="status">
        <strong>{part.label}</strong> {copy[seg]}
        <style>{`
          .hm-segDetail {
            margin-bottom: var(--s-3); padding: var(--s-3);
            background: var(--surface-2);
            border-radius: var(--r-sm);
            font-size: var(--fs-tiny); color: var(--text-2);
            line-height: 1.45;
          }
          .hm-segDetail strong { color: var(--text-1); }
        `}</style>
      </p>
    )
  }

  function ChallengeCard() {
    const c = challenge!
    const dayNum = Math.min(c.days, daysBetween(c.startDate, date) + 1)
    const left = Math.max(0, c.days - dayNum)
    const pct = (dayNum / c.days) * 100

    return (
      <Link to="/challenges" className="card card--ember hm-ch">
        <div className="row row--between">
          <span className="t-micro" style={{ color: 'var(--ember)' }}>
            {c.name}
          </span>
          <span className="t-micro dim">{t('ch.remaining', { n: left })}</span>
        </div>
        <p className="hm-chDay num">
          <span className="hm-chDayNum">{dayNum}</span>
          <span className="hm-chDayTotal">/ {c.days}</span>
        </p>
        <Meter value={pct} max={100} label="Challenge progress" showOver={false} height={6} />

        <style>{`
          .hm-ch { display: block; }
          .hm-chDay {
            display: flex; align-items: baseline; gap: 6px;
            margin: var(--s-2) 0 var(--s-3);
          }
          .hm-chDayNum {
            font-size: var(--fs-3xl); font-weight: 600; line-height: 1;
            color: var(--text-1);
          }
          .hm-chDayTotal { font-size: var(--fs-lg); color: var(--text-3); }
        `}</style>
      </Link>
    )
  }

  function RecordsTeaser() {
    const recent = [...data.records]
      .sort((a, b) => (a.best1rmDate < b.best1rmDate ? 1 : -1))
      .slice(0, 2)

    return (
      <Link to="/records" className="card hm-link" aria-label={t('pr.title')}>
        <div className="row row--between">
          <h2 className="hm-cardTitle">
            <Trophy size={14} aria-hidden="true" /> {t('home.records')}
          </h2>
          <ChevronRight size={18} className="dim" aria-hidden="true" />
        </div>
        <ul className="hm-prs">
          {recent.map((r) => {
            const name = exerciseName(r.exerciseId)
            return (
              <li key={r.id} className="row row--between">
                <span className="truncate muted" style={{ fontSize: 'var(--fs-sm)' }}>
                  {name}
                </span>
                <span className="num" style={{ fontSize: 'var(--fs-sm)' }}>
                  {fmt.weight(r.bestWeightKg)} {fmt.weightUnit} × {r.bestWeightReps}
                </span>
              </li>
            )
          })}
        </ul>

        <style>{`
          .hm-prs {
            display: flex; flex-direction: column; gap: var(--s-2);
            margin-top: var(--s-3);
          }
        `}</style>
      </Link>
    )
  }

  function exerciseName(id: string) {
    const custom = data.customExercises.find((e) => e.id === id)
    if (custom) return custom.name
    // Seed list is imported lazily by the library screen; a local lookup keeps
    // Home from pulling it in.
    return id
      .split('-')
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(' ')
  }

  function TargetRow({
    label,
    value,
    target,
    unit,
    onTap,
  }: {
    label: string
    value: number
    target: number
    unit?: string
    onTap?: () => void
  }) {
    const remaining = target - value
    const Tag = onTap ? 'button' : 'div'
    return (
      <Tag
        {...(onTap ? { type: 'button' as const, onClick: onTap } : {})}
        className={`hm-tr${onTap ? ' hm-tr--tap' : ''}`}
      >
        <div className="row row--between hm-trHead">
          <span className="hm-trLabel">{label}</span>
          <span className="num hm-trValue">
            {fmtInt(value, locale)}
            <span className="hm-trTarget"> / {fmtInt(target, locale)}</span>
            {unit && <span className="t-unit"> {unit}</span>}
          </span>
        </div>
        <Meter value={value} max={target} label={`${label}: ${value} of ${target}`} />
        <span className="hm-trRem">
          {remaining > 0
            ? `${fmtInt(remaining, locale)} ${t('nutri.remaining')}`
            : `${fmtInt(-remaining, locale)} ${t('nutri.over')}`}
        </span>

        <style>{`
          .hm-tr {
            display: block; width: 100%; text-align: left;
            margin-top: var(--s-4);
          }
          .hm-tr--tap { cursor: pointer; }
          .hm-trHead { margin-bottom: 6px; }
          .hm-trLabel { font-size: var(--fs-sm); font-weight: 600; color: var(--text-2); }
          .hm-trValue { font-size: var(--fs-sm); font-weight: 600; color: var(--text-1); }
          .hm-trTarget { color: var(--text-3); font-weight: 400; }
          .hm-trRem {
            display: block; margin-top: 5px;
            font-size: var(--fs-tiny); color: var(--text-3);
          }
        `}</style>
      </Tag>
    )
  }

  function WeightSheet({
    open,
    onClose,
    current,
  }: {
    open: boolean
    onClose: () => void
    current: number
  }) {
    const [kg, setKg] = useState(() => Number(fmt.weight(current)))
    return (
      <Sheet
        open={open}
        onClose={onClose}
        title={t('weight.log')}
        footer={
          <button
            type="button"
            className="btn btn--primary btn--block btn--lg"
            onClick={() => {
              actions.logWeight(Number(fmt.toKg(kg).toFixed(2)))
              toast.show(`Weight logged: ${fmt.weightLabel(fmt.toKg(kg))}`, { tone: 'good' })
              onClose()
            }}
          >
            {t('common.save')}
          </button>
        }
      >
        <Stepper
          label={t('weight.title')}
          unit={fmt.weightUnit}
          decimals={1}
          step={0.1}
          value={kg}
          onChange={setKg}
          min={profile.units === 'imperial' ? 66 : 30}
          max={profile.units === 'imperial' ? 660 : 300}
        />
        <p className="field__hint">
          Weigh yourself at the same time each day — first thing, before food. The trend line cares
          about consistency, not precision.
        </p>
      </Sheet>
    )
  }

  function StepSheet({
    open,
    onClose,
    current,
  }: {
    open: boolean
    onClose: () => void
    current: number
  }) {
    const [steps, setSteps] = useState(current)
    return (
      <Sheet
        open={open}
        onClose={onClose}
        title={t('cardio.logSteps')}
        footer={
          <button
            type="button"
            className="btn btn--primary btn--block btn--lg"
            onClick={() => {
              actions.logSteps(date, steps)
              toast.show(`${fmtInt(steps, locale)} steps logged`, { tone: 'good' })
              onClose()
            }}
          >
            {t('common.save')}
          </button>
        }
      >
        <Stepper
          label={t('cardio.steps')}
          step={500}
          min={0}
          max={100000}
          value={steps}
          onChange={setSteps}
        />
        <p className="field__hint">
          Copy the number from your phone's health app. Target is{' '}
          {fmtInt(profile.targets.steps, locale)}.
        </p>
      </Sheet>
    )
  }
}

/** True when the change is heading toward the target, whichever direction that is. */
function isMovingRight(change: number, start: number, target: number): boolean {
  return start > target ? change <= 0 : change >= 0
}
