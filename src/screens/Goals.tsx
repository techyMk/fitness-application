/* ============================================================================
   Goals. Every goal shows target, deadline, live progress and a percentage —
   all four, computed from the log rather than typed (spec §27).
   ========================================================================= */

import { useMemo, useState } from 'react'
import { Check, Plus, Target, Trash2 } from 'lucide-react'
import type { Goal, GoalMetric } from '../lib/types'
import { goalProgress, weightStats } from '../lib/calc'
import { useStore } from '../lib/store'
import { useT } from '../lib/i18n'
import { fmtInt, makeFmt } from '../lib/units'
import { addDays, fmtDate, today } from '../lib/date'
import {
  ConfirmSheet,
  Empty,
  Meter,
  ScreenHeader,
  Sheet,
  Stepper,
  useToast,
} from '../components/ui'

interface MetricDef {
  metric: GoalMetric
  label: string
  period: Goal['period']
  unit: string
  step: number
  defaultTarget: number
  hint: string
}

export default function Goals() {
  const { t, locale } = useT()
  const { data, actions } = useStore()
  const toast = useToast()
  const profile = data.profile!
  const fmt = useMemo(() => makeFmt(profile.units), [profile.units])

  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Goal | null>(null)

  const active = data.goals.filter((g) => !g.archived)
  const done = data.goals.filter((g) => g.archived)

  const METRICS: MetricDef[] = useMemo(
    () => [
      {
        metric: 'weight',
        label: t('home.weight'),
        period: 'total',
        unit: fmt.weightUnit,
        step: 0.5,
        defaultTarget: Number(fmt.weight(profile.targetWeightKg)),
        hint: 'Measured against your smoothed trend, not a single weigh-in',
      },
      {
        metric: 'workouts',
        label: t('wk.title'),
        period: 'weekly',
        unit: 'per week',
        step: 1,
        defaultTarget: profile.targets.workoutsPerWeek,
        hint: 'Completed sessions in the last seven days',
      },
      {
        metric: 'protein',
        label: t('nutri.protein'),
        period: 'weekly',
        unit: 'g/day average',
        step: 5,
        defaultTarget: profile.targets.protein,
        hint: 'Average over the last seven days',
      },
      {
        metric: 'calories',
        label: t('nutri.calories'),
        period: 'weekly',
        unit: 'kcal/day average',
        step: 50,
        defaultTarget: profile.targets.calories,
        hint: 'Average over the last seven days',
      },
      {
        metric: 'steps',
        label: t('cardio.steps'),
        period: 'weekly',
        unit: 'per day average',
        step: 500,
        defaultTarget: profile.targets.steps,
        hint: 'Average over the last seven days',
      },
      {
        metric: 'cardio-minutes',
        label: 'Cardio minutes',
        period: 'weekly',
        unit: 'min this week',
        step: 15,
        defaultTarget: 150,
        hint: 'Total cardio minutes in the last seven days',
      },
      {
        metric: 'sleep-hours',
        label: t('sleep.title'),
        period: 'weekly',
        unit: 'h/night average',
        step: 0.5,
        defaultTarget: profile.targets.sleepHours,
        hint: 'Average over the last seven nights',
      },
    ],
    [t, fmt, profile],
  )

  return (
    <div className="shell">
      <ScreenHeader
        title={t('goals.title')}
        back="/progress"
        action={
          <button
            type="button"
            className="icon-btn"
            aria-label={t('goals.new')}
            onClick={() => setCreating(true)}
          >
            <Plus size={20} aria-hidden="true" />
          </button>
        }
      />

      {active.length === 0 ? (
        <Empty
          icon={<Target size={26} aria-hidden="true" />}
          title={t('goals.empty')}
          body={t('goals.empty.body')}
          action={
            <button type="button" className="btn btn--primary" onClick={() => setCreating(true)}>
              <Plus size={15} aria-hidden="true" />
              {t('goals.new')}
            </button>
          }
        />
      ) : (
        <ul className="gl-list" style={{ marginTop: 'var(--s-4)' }}>
          {active.map((g) => {
            const p = goalProgress(data, g)
            const overdue = p.daysLeft != null && p.daysLeft < 0 && !p.done

            return (
              <li key={g.id}>
                <article className={`card${p.done ? ' gl-card--done' : ''}`}>
                  <div className="row row--between">
                    <div className="grow">
                      <h2 className="gl-name">{g.label}</h2>
                      <p className="gl-meta">
                        {g.deadline
                          ? overdue
                            ? `${t('goals.overdue')} · was ${fmtDate(g.deadline, locale)}`
                            : p.daysLeft === 0
                              ? 'Due today'
                              : t('goals.daysLeft', { n: p.daysLeft ?? 0 })
                          : 'No deadline'}
                      </p>
                    </div>
                    {p.done ? (
                      <span className="gl-done">
                        <Check size={11} strokeWidth={3} aria-hidden="true" />
                        {t('goals.complete')}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Delete goal ${g.label}`}
                        onClick={() => setDeleting(g)}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  <div className="gl-figures">
                    <span className="num gl-current">
                      {g.metric === 'weight' || g.metric === 'sleep-hours'
                        ? p.current
                        : fmtInt(p.current, locale)}
                    </span>
                    <span className="gl-of num">
                      / {g.metric === 'weight' || g.metric === 'sleep-hours' ? p.target : fmtInt(p.target, locale)}
                      <span className="t-unit"> {p.unit}</span>
                    </span>
                    <span className="num gl-pct">{Math.round(p.pct)}%</span>
                  </div>

                  <Meter
                    value={p.pct}
                    max={100}
                    label={`${g.label}: ${Math.round(p.pct)} percent`}
                    showOver={false}
                  />
                </article>
              </li>
            )
          })}
        </ul>
      )}

      {done.length > 0 && (
        <>
          <div className="eyebrow">Archived</div>
          <ul className="card card--flush">
            {done.map((g, i) => (
              <li key={g.id}>
                {i > 0 && <div className="divider" />}
                <div className="gl-arch">
                  <span className="grow truncate">{g.label}</span>
                  <button
                    type="button"
                    className="btn btn--quiet"
                    onClick={() => actions.updateGoal(g.id, { archived: false })}
                  >
                    Restore
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {creating && (
        <NewGoalSheet metrics={METRICS} fmt={fmt} onClose={() => setCreating(false)} />
      )}

      <ConfirmSheet
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) actions.deleteGoal(deleting.id)
          toast.show('Goal deleted')
        }}
        title={`Delete ${deleting?.label ?? 'goal'}?`}
        body="Your logged data is untouched — only the goal is removed."
      />

      <style>{`
        .gl-list { display: flex; flex-direction: column; gap: var(--s-3); }
        .gl-card--done { border-color: var(--good); }
        .gl-name {
          font-size: var(--fs-base); font-weight: 700;
          letter-spacing: var(--tr-display);
        }
        .gl-meta {
          font-family: var(--font-display);
          font-size: var(--fs-micro); font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--text-3); margin-top: 2px;
        }
        .gl-done {
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
        .gl-figures {
          display: flex; align-items: baseline; gap: var(--s-2);
          margin: var(--s-4) 0 var(--s-2);
        }
        .gl-current {
          font-size: var(--fs-2xl); font-weight: 600; line-height: 1;
        }
        .gl-of { flex: 1; font-size: var(--fs-tiny); color: var(--text-3); }
        .gl-pct {
          font-size: var(--fs-sm); font-weight: 600; color: var(--kiln-4);
        }
        .gl-arch {
          display: flex; align-items: center; gap: var(--s-2);
          min-height: 48px; padding: 0 var(--s-2) 0 var(--s-4);
          font-size: var(--fs-sm); color: var(--text-3);
        }
      `}</style>
    </div>
  )
}

/* ------------------------------- new goal -------------------------------- */

function NewGoalSheet({
  metrics,
  fmt,
  onClose,
}: {
  metrics: MetricDef[]
  fmt: ReturnType<typeof makeFmt>
  onClose: () => void
}) {
  const { t } = useT()
  const { data, actions } = useStore()
  const toast = useToast()

  const [def, setDef] = useState<MetricDef>(metrics[0])
  const [target, setTarget] = useState(metrics[0].defaultTarget)
  const [deadline, setDeadline] = useState(addDays(today(), 90))
  const [useDeadline, setUseDeadline] = useState(true)

  const stats = weightStats(data)

  function pick(m: MetricDef) {
    setDef(m)
    setTarget(m.defaultTarget)
  }

  function create() {
    const isWeight = def.metric === 'weight'
    actions.addGoal({
      metric: def.metric,
      label: `${def.label} ${isWeight ? 'target' : 'goal'}`,
      target: isWeight ? Number(fmt.toKg(target).toFixed(2)) : target,
      period: def.period,
      startDate: today(),
      deadline: useDeadline ? deadline : undefined,
      startValue: isWeight ? (stats.current ?? undefined) : undefined,
    })
    toast.show('Goal set', { tone: 'good' })
    onClose()
  }

  const decimals = def.step < 1 ? 1 : 0

  return (
    <Sheet
      open
      onClose={onClose}
      title={t('goals.new')}
      tall
      footer={
        <button type="button" className="btn btn--primary btn--block btn--lg" onClick={create}>
          {t('common.create')}
        </button>
      }
    >
      <div className="stack-4">
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field__label">What are you aiming at?</legend>
          <div className="chips" style={{ marginTop: 'var(--s-2)' }}>
            {metrics.map((m) => (
              <button
                key={m.metric}
                type="button"
                className="chip"
                aria-pressed={def.metric === m.metric}
                onClick={() => pick(m)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </fieldset>

        <Stepper
          label={t('common.target')}
          unit={def.unit}
          step={def.step}
          decimals={decimals}
          min={0}
          max={def.metric === 'steps' ? 50000 : def.metric === 'calories' ? 8000 : 1000}
          value={target}
          onChange={setTarget}
        />
        <p className="field__hint" style={{ marginTop: 0 }}>
          {def.hint}.
        </p>

        <label className="gl-dl">
          <input
            type="checkbox"
            checked={useDeadline}
            onChange={(e) => setUseDeadline(e.target.checked)}
          />
          <span>
            <span className="gl-dlLabel">Set a deadline</span>
            <span className="gl-dlHint">A date makes it real. Without one it is a wish.</span>
          </span>
        </label>

        {useDeadline && (
          <label className="field">
            <span className="field__label">{t('goals.deadline')}</span>
            <input
              className="input"
              type="date"
              value={deadline}
              min={today()}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </label>
        )}
      </div>

      <style>{`
        .gl-dl {
          display: flex; align-items: flex-start; gap: var(--s-3);
          min-height: 48px; cursor: pointer;
        }
        .gl-dl input { width: 19px; height: 19px; margin-top: 2px; accent-color: var(--ember); }
        .gl-dlLabel { display: block; font-size: var(--fs-sm); font-weight: 600; }
        .gl-dlHint { display: block; font-size: var(--fs-tiny); color: var(--text-3); }
      `}</style>
    </Sheet>
  )
}
