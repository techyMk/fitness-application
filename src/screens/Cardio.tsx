/* ============================================================================
   Cardio and steps. Steps get their own edit-in-place row because they are a
   daily number copied from a phone health app; cardio sessions are a list.
   ========================================================================= */

import { useMemo, useState } from 'react'
import { Bike, Footprints, Plus, Trash2, Waves } from 'lucide-react'
import type { CardioType } from '../lib/types'
import { sum } from '../lib/calc'
import { useStore } from '../lib/store'
import { useT } from '../lib/i18n'
import { fmtInt, makeFmt } from '../lib/units'
import { addDays, fmtDate, fmtDuration, fmtWeekday, lastNDays, today } from '../lib/date'
import { BarChart } from '../components/charts'
import {
  ConfirmSheet,
  Empty,
  Meter,
  ScreenHeader,
  Sheet,
  Stat,
  Stepper,
  useToast,
} from '../components/ui'

const TYPES: CardioType[] = ['walk', 'run', 'cycle', 'treadmill', 'other']

export default function Cardio() {
  const { t, locale } = useT()
  const { data, actions } = useStore()
  const toast = useToast()
  const profile = data.profile!
  const fmt = useMemo(() => makeFmt(profile.units), [profile.units])
  const date = today()

  const [stepSheet, setStepSheet] = useState(false)
  const [cardioSheet, setCardioSheet] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const todaySteps = data.steps.find((s) => s.date === date)?.steps ?? 0

  // The step sheet's draft lives at this level so the sheet footer button can
  // read it — the footer renders outside the body in the Sheet layout.
  const [stepDraft, setStepDraft] = useState(todaySteps)
  const [stepDate, setStepDate] = useState(date)
  const entries = useMemo(
    () => [...data.cardio].sort((a, b) => (a.date < b.date ? 1 : -1)),
    [data.cardio],
  )

  const week = useMemo(() => lastNDays(7), [])
  const stepPoints = week.map((d) => ({
    label: fmtWeekday(d, locale).slice(0, 2),
    value: data.steps.find((s) => s.date === d)?.steps ?? 0,
  }))

  const weekSteps = sum(stepPoints.map((p) => p.value))
  const weekCardio = data.cardio.filter((c) => c.date >= addDays(date, -6))
  const weekMinutes = sum(weekCardio.map((c) => c.minutes))
  const weekKm = sum(weekCardio.map((c) => c.distanceKm ?? 0))

  return (
    <div className="shell">
      <ScreenHeader title={t('cardio.title')} back="/more" />

      {/* ------------------------------- steps ----------------------------- */}
      <section className="card" style={{ marginTop: 'var(--s-4)' }} aria-labelledby="cd-steps">
        <div className="row row--between">
          <h2 id="cd-steps" className="eyebrow" style={{ margin: 0 }}>
            <Footprints size={11} aria-hidden="true" /> {t('cardio.steps')}
          </h2>
          <button type="button" className="btn btn--quiet" onClick={() => setStepSheet(true)}>
            {t('common.edit')}
          </button>
        </div>

        <div className="cd-steps">
          <span className="num cd-stepsVal">{fmtInt(todaySteps, locale)}</span>
          <span className="cd-stepsOf">
            / {fmtInt(profile.targets.steps, locale)}
          </span>
        </div>
        <Meter
          value={todaySteps}
          max={profile.targets.steps}
          label={`Steps: ${todaySteps} of ${profile.targets.steps}`}
        />

        <div style={{ marginTop: 'var(--s-5)' }}>
          <BarChart
            points={stepPoints}
            target={profile.targets.steps}
            seriesName="Steps"
            title="Last seven days"
            subtitle="Bar colour shows how close each day came to target."
            unit="steps"
            height={130}
          />
        </div>
      </section>

      {/* ------------------------------ week ------------------------------- */}
      <div className="eyebrow">This week</div>
      <section className="card">
        <div className="grid-3">
          <Stat label={t('cardio.steps')} value={fmtInt(weekSteps, locale)} size="md" />
          <Stat label="Cardio" value={fmtDuration(weekMinutes)} size="md" />
          <Stat
            label={t('cardio.distance')}
            value={fmt.distance(weekKm)}
            unit={fmt.distanceUnit}
            size="md"
          />
        </div>
      </section>

      {/* ----------------------------- sessions ---------------------------- */}
      <div className="eyebrow">
        Cardio sessions
        <button type="button" className="eyebrow__action" onClick={() => setCardioSheet(true)}>
          {t('common.add')}
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="card">
          <Empty
            icon={<Waves size={26} aria-hidden="true" />}
            title={t('cardio.empty')}
            body={t('cardio.empty.body')}
            action={
              <button type="button" className="btn btn--primary" onClick={() => setCardioSheet(true)}>
                <Plus size={15} aria-hidden="true" />
                {t('cardio.log')}
              </button>
            }
          />
        </div>
      ) : (
        <ul className="card card--flush">
          {entries.slice(0, 40).map((c, i) => (
            <li key={c.id}>
              {i > 0 && <div className="divider" />}
              <div className="cd-row">
                <span className="cd-rowIcon">
                  {c.type === 'cycle' ? (
                    <Bike size={16} aria-hidden="true" />
                  ) : (
                    <Footprints size={16} aria-hidden="true" />
                  )}
                </span>
                <div className="grow">
                  <p className="cd-rowTitle">{t(`cardio.${c.type}`)}</p>
                  <p className="cd-rowMeta num">
                    {fmtDate(c.date, locale)} · {fmtDuration(c.minutes)}
                    {c.distanceKm ? ` · ${fmt.distanceLabel(c.distanceKm)}` : ''}
                    {c.calories ? ` · ${c.calories} kcal` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  className="cd-del"
                  aria-label={`Delete ${t(`cardio.${c.type}`)} from ${fmtDate(c.date, locale)}`}
                  onClick={() => setDeleting(c.id)}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* ------------------------------ sheets ----------------------------- */}
      <Sheet
        open={stepSheet}
        onClose={() => setStepSheet(false)}
        title={t('cardio.logSteps')}
        footer={
          <button
            type="button"
            className="btn btn--primary btn--block btn--lg"
            onClick={() => {
              actions.logSteps(stepDate, stepDraft)
              toast.show(`${fmtInt(stepDraft, locale)} steps logged`, { tone: 'good' })
              setStepSheet(false)
            }}
          >
            {t('common.save')}
          </button>
        }
      >
        <div className="stack-4">
          <Stepper
            label={t('cardio.steps')}
            step={500}
            min={0}
            max={100000}
            value={stepDraft}
            onChange={setStepDraft}
          />
          <label className="field">
            <span className="field__label">Date</span>
            <input
              className="input"
              type="date"
              value={stepDate}
              max={today()}
              onChange={(e) => setStepDate(e.target.value)}
            />
          </label>
          <p className="field__hint" style={{ marginTop: 0 }}>
            Copy the total from your phone's health app at the end of the day. Target is{' '}
            {fmtInt(profile.targets.steps, locale)}.
          </p>
        </div>
      </Sheet>

      {cardioSheet && <CardioSheet onClose={() => setCardioSheet(false)} />}

      <ConfirmSheet
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) actions.deleteCardio(deleting)
          toast.show('Session deleted')
        }}
        title="Delete this session?"
        body="Your records and totals will recalculate without it."
      />

      <style>{`
        .cd-steps { display: flex; align-items: baseline; gap: var(--s-2); margin: var(--s-3) 0; }
        .cd-stepsVal {
          font-size: var(--fs-3xl); font-weight: 600; line-height: 1;
          letter-spacing: -0.03em;
        }
        .cd-stepsOf { font-size: var(--fs-base); color: var(--text-3); }

        .cd-row {
          display: flex; align-items: center; gap: var(--s-3);
          min-height: 58px; padding: var(--s-2) var(--s-2) var(--s-2) var(--s-4);
        }
        .cd-rowIcon {
          display: grid; place-items: center;
          width: 34px; height: 34px; flex: none;
          border-radius: var(--r-sm);
          background: var(--surface-2); color: var(--text-2);
        }
        .cd-rowTitle { font-size: var(--fs-sm); font-weight: 600; }
        .cd-rowMeta { font-size: var(--fs-tiny); color: var(--text-3); margin-top: 1px; }
        .cd-del {
          display: grid; place-items: center;
          width: 36px; height: 36px; flex: none;
          border-radius: var(--r-sm); color: var(--text-3);
        }
        .cd-del:hover { background: var(--critical-soft); color: var(--critical); }
      `}</style>
    </div>
  )
}

/* --------------------------- cardio entry sheet --------------------------- */

function CardioSheet({ onClose }: { onClose: () => void }) {
  const { t } = useT()
  const { data, actions } = useStore()
  const toast = useToast()
  const profile = data.profile!
  const fmt = useMemo(() => makeFmt(profile.units), [profile.units])

  const [type, setType] = useState<CardioType>('walk')
  const [minutes, setMinutes] = useState(30)
  const [distance, setDistance] = useState(3)
  const [calories, setCalories] = useState(0)
  const [incline, setIncline] = useState(0)
  const [date, setDate] = useState(today())

  const km = fmt.toKm(distance)
  const speed = minutes > 0 ? (km / minutes) * 60 : 0

  return (
    <Sheet
      open
      onClose={onClose}
      title={t('cardio.log')}
      tall
      footer={
        <button
          type="button"
          className="btn btn--primary btn--block btn--lg"
          onClick={() => {
            actions.logCardio({
              date,
              type,
              minutes,
              distanceKm: distance > 0 ? Number(km.toFixed(2)) : undefined,
              calories: calories > 0 ? calories : undefined,
              speedKmh: speed > 0 ? Number(speed.toFixed(1)) : undefined,
              incline: type === 'treadmill' && incline > 0 ? incline : undefined,
            })
            toast.show(`${t(`cardio.${type}`)} logged`, { tone: 'good' })
            onClose()
          }}
        >
          {t('common.save')}
        </button>
      }
    >
      <div className="stack-4">
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field__label">Activity</legend>
          <div className="chips" style={{ marginTop: 'var(--s-2)' }}>
            {TYPES.map((x) => (
              <button
                key={x}
                type="button"
                className="chip"
                aria-pressed={type === x}
                onClick={() => setType(x)}
              >
                {t(`cardio.${x}`)}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid-2">
          <Stepper
            label={t('cardio.minutes')}
            unit="min"
            step={5}
            min={1}
            max={600}
            value={minutes}
            onChange={setMinutes}
          />
          <Stepper
            label={t('cardio.distance')}
            unit={fmt.distanceUnit}
            step={0.5}
            decimals={1}
            min={0}
            max={200}
            value={distance}
            onChange={setDistance}
          />
          <Stepper
            label={t('nutri.calories')}
            unit="kcal"
            step={10}
            min={0}
            max={3000}
            value={calories}
            onChange={setCalories}
          />
          {type === 'treadmill' && (
            <Stepper
              label={t('cardio.incline')}
              unit="%"
              step={0.5}
              decimals={1}
              min={0}
              max={30}
              value={incline}
              onChange={setIncline}
            />
          )}
        </div>

        {speed > 0 && (
          <div className="card card--inset" style={{ padding: 'var(--s-3)' }}>
            <span className="t-micro dim">{t('cardio.speed')} · calculated</span>
            <p className="num" style={{ fontSize: 'var(--fs-lg)', fontWeight: 600, marginTop: 2 }}>
              {fmt.speed(speed)}
              <span className="t-unit"> {fmt.speedUnit}</span>
            </p>
          </div>
        )}

        <label className="field">
          <span className="field__label">Date</span>
          <input
            className="input"
            type="date"
            value={date}
            max={today()}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>

        <p className="field__hint" style={{ marginTop: 0 }}>
          Calories is optional — leave it at zero if you don't have a reading.
        </p>
      </div>
    </Sheet>
  )
}
