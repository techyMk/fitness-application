/* ============================================================================
   Challenge mode. A fixed window with a day counter — "Day 47 / 100".

   The day number is the hero here, set at display size in the data face, because
   it is the one thing the user opens this screen to see.
   ========================================================================= */

import { useMemo, useState } from 'react'
import { Flag, Flame, Trophy } from 'lucide-react'
import type { Challenge } from '../lib/types'
import { averageScore, currentStreak, weightStats } from '../lib/calc'
import { useStore } from '../lib/store'
import { useT } from '../lib/i18n'
import { fmtDelta, makeFmt } from '../lib/units'
import { addDays, daysBetween, fmtDate, fmtLongDate, range, today } from '../lib/date'
import { HeatStrip } from '../components/charts'
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

const PRESETS = [30, 60, 90, 100]

export default function Challenges() {
  const { t, locale } = useT()
  const { data, actions } = useStore()
  const toast = useToast()
  const profile = data.profile!
  const fmt = useMemo(() => makeFmt(profile.units), [profile.units])

  const [creating, setCreating] = useState(false)
  const [ending, setEnding] = useState<Challenge | null>(null)

  const active = data.challenges.find((c) => c.active)
  const past = data.challenges.filter((c) => !c.active)

  return (
    <div className="shell">
      <ScreenHeader
        title={t('ch.title')}
        back="/progress"
        action={
          !active ? (
            <button
              type="button"
              className="icon-btn"
              aria-label={t('ch.new')}
              onClick={() => setCreating(true)}
            >
              <Flag size={19} aria-hidden="true" />
            </button>
          ) : undefined
        }
      />

      {active ? (
        <ActiveChallenge challenge={active} onEnd={() => setEnding(active)} />
      ) : (
        <Empty
          icon={<Flag size={26} aria-hidden="true" />}
          title={t('ch.empty')}
          body={t('ch.empty.body')}
          action={
            <button type="button" className="btn btn--primary" onClick={() => setCreating(true)}>
              <Flag size={15} aria-hidden="true" />
              {t('ch.new')}
            </button>
          }
        />
      )}

      {past.length > 0 && (
        <>
          <div className="eyebrow">Previous challenges</div>
          <ul className="ch-past">
            {past.map((c) => {
              const completed = !!c.completedAt
              return (
                <li key={c.id}>
                  <article className="card ch-pastCard">
                    <div className="row row--between">
                      <div className="grow">
                        <h2 className="ch-pastName">{c.name}</h2>
                        <p className="ch-pastMeta num">
                          {fmtDate(c.startDate, locale)} → {fmtDate(c.endDate, locale)} · {c.days} days
                        </p>
                      </div>
                      {completed && (
                        <span className="ch-badge">
                          <Trophy size={11} aria-hidden="true" />
                          Done
                        </span>
                      )}
                    </div>
                    {c.startWeightKg != null && c.goalWeightKg != null && (
                      <p className="ch-pastWeight num">
                        {fmt.weight(c.startWeightKg)} → goal {fmt.weight(c.goalWeightKg)}{' '}
                        {fmt.weightUnit}
                      </p>
                    )}
                  </article>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {creating && <NewChallengeSheet onClose={() => setCreating(false)} />}

      <ConfirmSheet
        open={!!ending}
        onClose={() => setEnding(null)}
        onConfirm={() => {
          if (!ending) return
          const finished = daysBetween(ending.startDate, today()) + 1 >= ending.days
          actions.endChallenge(ending.id, finished)
          toast.show(finished ? t('ch.complete') : 'Challenge ended', {
            tone: finished ? 'good' : 'info',
          })
        }}
        title="End this challenge?"
        body={
          ending && daysBetween(ending.startDate, today()) + 1 >= ending.days
            ? 'You reached the final day — this marks it complete and unlocks the badge.'
            : 'Ending early keeps it in your history, marked incomplete. Your logged data is untouched.'
        }
        confirmLabel="End challenge"
        destructive={false}
      />

      <style>{`
        .ch-past { display: flex; flex-direction: column; gap: var(--s-2); }
        .ch-pastName {
          font-size: var(--fs-sm); font-weight: 700;
          letter-spacing: var(--tr-display);
        }
        .ch-pastMeta { font-size: var(--fs-tiny); color: var(--text-3); margin-top: 2px; }
        .ch-pastWeight {
          margin-top: var(--s-2);
          font-size: var(--fs-tiny); color: var(--text-2);
        }
        .ch-badge {
          display: inline-flex; align-items: center; gap: 4px;
          flex: none; padding: 3px 8px;
          background: var(--good-soft);
          border: 1px solid var(--good);
          border-radius: var(--r-pill);
          font-family: var(--font-display);
          font-size: 9px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--good);
        }
      `}</style>
    </div>
  )
}

/* ---------------------------- active challenge ---------------------------- */

function ActiveChallenge({
  challenge: c,
  onEnd,
}: {
  challenge: Challenge
  onEnd: () => void
}) {
  const { t, locale } = useT()
  const { data } = useStore()
  const profile = data.profile!
  const fmt = useMemo(() => makeFmt(profile.units), [profile.units])

  const dayNum = Math.min(c.days, Math.max(1, daysBetween(c.startDate, today()) + 1))
  const left = Math.max(0, c.days - dayNum)
  const pct = (dayNum / c.days) * 100

  const stats = weightStats(data)
  const elapsed = range(c.startDate, today() < c.endDate ? today() : c.endDate)
  const avgScore = averageScore(data, elapsed)
  const streak = currentStreak(data)

  const weightNow = stats.current
  const weightChange =
    c.startWeightKg != null && weightNow != null ? weightNow - c.startWeightKg : null

  // Last 14 days of heat, so consistency inside the challenge is visible.
  const cells = elapsed.slice(-14).map((d) => ({
    label: fmtDate(d, locale).split(' ')[0],
    ratio: averageScore(data, [d]) / 100,
    empty: false,
  }))

  return (
    <>
      <section className="card card--ember ac-hero" style={{ marginTop: 'var(--s-4)' }}>
        <span className="t-micro" style={{ color: 'var(--ember)' }}>
          {c.name}
        </span>

        <p className="ac-day num">
          <span className="ac-dayNum">{dayNum}</span>
          <span className="ac-dayOf">/ {c.days}</span>
        </p>

        <p className="ac-remaining">
          {left === 0 ? 'Final day' : t('ch.remaining', { n: left })} · ends{' '}
          {fmtLongDate(c.endDate, locale).replace(/^\w+,?\s*/, '')}
        </p>

        <Meter value={pct} max={100} label="Challenge progress" showOver={false} height={7} />
        <p className="ac-pct num">{Math.round(pct)}% complete</p>
      </section>

      <div className="eyebrow">Where you stand</div>
      <section className="card">
        <div className="grid-2">
          <Stat
            label={t('ch.startWeight')}
            value={fmt.weight(c.startWeightKg)}
            unit={fmt.weightUnit}
            size="md"
          />
          <Stat
            label={t('weight.now')}
            value={fmt.weight(weightNow)}
            unit={fmt.weightUnit}
            size="md"
            tone="ember"
          />
          <Stat
            label={t('ch.goalWeight')}
            value={fmt.weight(c.goalWeightKg)}
            unit={fmt.weightUnit}
            size="md"
            tone="dim"
          />
          <Stat
            label="Change so far"
            value={weightChange == null ? '—' : fmtDelta(Number(fmt.weight(weightChange, 1)))}
            unit={fmt.weightUnit}
            size="md"
            tone={
              weightChange == null
                ? 'dim'
                : c.startWeightKg != null && c.goalWeightKg != null
                  ? (c.startWeightKg > c.goalWeightKg ? weightChange <= 0 : weightChange >= 0)
                    ? 'good'
                    : 'warn'
                  : 'default'
            }
          />
        </div>

        <div className="ac-split">
          <Stat label={t('home.streak')} value={streak} unit="days" size="md" tone="ember" />
          <Stat label="Average score" value={avgScore} unit="/100" size="md" />
        </div>
      </section>

      {cells.length > 0 && (
        <>
          <div className="eyebrow">Recent consistency</div>
          <section className="card">
            <HeatStrip cells={cells} label="Daily score during the challenge" />
          </section>
        </>
      )}

      <button
        type="button"
        className="btn btn--ghost btn--block"
        style={{ marginTop: 'var(--s-5)' }}
        onClick={onEnd}
      >
        {left === 0 ? 'Finish challenge' : 'End challenge early'}
      </button>

      <style>{`
        .ac-hero { text-align: center; }
        .ac-day {
          display: flex; align-items: baseline; justify-content: center;
          gap: var(--s-2); margin: var(--s-3) 0 var(--s-2);
        }
        .ac-dayNum {
          font-size: var(--fs-5xl); font-weight: 600; line-height: 1;
          letter-spacing: -0.04em;
          color: var(--kiln-5);
        }
        .ac-dayOf { font-size: var(--fs-xl); color: var(--text-3); }
        .ac-remaining {
          font-size: var(--fs-tiny); color: var(--text-2);
          margin-bottom: var(--s-4);
        }
        .ac-pct {
          margin-top: var(--s-2);
          font-size: var(--fs-tiny); color: var(--text-3);
        }
        .ac-split {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: var(--s-3);
          margin-top: var(--s-4); padding-top: var(--s-4);
          border-top: 1px solid var(--hairline);
        }
      `}</style>
    </>
  )
}

/* ----------------------------- new challenge ----------------------------- */

function NewChallengeSheet({ onClose }: { onClose: () => void }) {
  const { t, locale } = useT()
  const { data, actions } = useStore()
  const toast = useToast()
  const profile = data.profile!
  const fmt = useMemo(() => makeFmt(profile.units), [profile.units])
  const stats = weightStats(data)

  const [days, setDays] = useState(90)
  const [custom, setCustom] = useState(false)
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState(today())
  const [goalWeight, setGoalWeight] = useState(() => Number(fmt.weight(profile.targetWeightKg)))

  const endDate = addDays(startDate, days - 1)
  const startWeight = stats.current ?? profile.startWeightKg

  function create() {
    actions.startChallenge({
      name: name.trim() || `${days}-day challenge`,
      days,
      startDate,
      startWeightKg: startWeight,
      goalWeightKg: Number(fmt.toKg(goalWeight).toFixed(2)),
    })
    toast.show(`${days}-day challenge started`, { tone: 'good' })
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={t('ch.new')}
      tall
      footer={
        <button type="button" className="btn btn--primary btn--block btn--lg" onClick={create}>
          <Flame size={17} aria-hidden="true" />
          {t('common.start')}
        </button>
      }
    >
      <div className="stack-4">
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field__label">{t('ch.length')}</legend>
          <div className="chips" style={{ marginTop: 'var(--s-2)' }}>
            {PRESETS.map((d) => (
              <button
                key={d}
                type="button"
                className="chip"
                aria-pressed={!custom && days === d}
                onClick={() => {
                  setDays(d)
                  setCustom(false)
                }}
              >
                <span className="num">{d}</span> days
              </button>
            ))}
            <button
              type="button"
              className="chip"
              aria-pressed={custom}
              onClick={() => setCustom(true)}
            >
              {t('ch.custom')}
            </button>
          </div>
        </fieldset>

        {custom && (
          <Stepper
            label={t('ch.length')}
            unit="days"
            step={5}
            min={7}
            max={365}
            value={days}
            onChange={setDays}
          />
        )}

        <label className="field">
          <span className="field__label">Name it</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`${days}-day cut`}
            maxLength={40}
          />
          <span className="field__hint">Optional — it defaults to the length.</span>
        </label>

        <label className="field">
          <span className="field__label">Start date</span>
          <input
            className="input"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>

        <Stepper
          label={t('ch.goalWeight')}
          unit={fmt.weightUnit}
          step={0.5}
          decimals={1}
          min={profile.units === 'imperial' ? 66 : 30}
          max={profile.units === 'imperial' ? 660 : 300}
          value={goalWeight}
          onChange={setGoalWeight}
        />

        <div className="card card--inset nc-summary">
          <div className="row row--between">
            <span className="muted">Runs</span>
            <span className="num">
              {fmtDate(startDate, locale)} → {fmtDate(endDate, locale)}
            </span>
          </div>
          <div className="row row--between" style={{ marginTop: 'var(--s-2)' }}>
            <span className="muted">{t('ch.startWeight')}</span>
            <span className="num">{fmt.weightLabel(startWeight)}</span>
          </div>
          <div className="row row--between" style={{ marginTop: 'var(--s-2)' }}>
            <span className="muted">Gap to close</span>
            <span className="num">
              {fmt.weightLabel(Math.abs(startWeight - fmt.toKg(goalWeight)))}
            </span>
          </div>
        </div>

        <p className="field__hint" style={{ marginTop: 0 }}>
          Starting a new challenge closes any running one. Only one runs at a time, and your history
          keeps them all.
        </p>
      </div>

      <style>{`
        .nc-summary { padding: var(--s-3) var(--s-4); font-size: var(--fs-sm); }
      `}</style>
    </Sheet>
  )
}
