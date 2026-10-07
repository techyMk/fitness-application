/* ============================================================================
   Programmes. Pick an active one, or build a week from scratch.

   The builder is a week of seven rows, each either Rest or a named day with an
   exercise list. That mirrors how people actually describe a split ("Monday
   legs, Tuesday push…") rather than forcing an abstract "day 1 of a 6-day
   rotation" model, which breaks the moment someone misses a Tuesday.
   ========================================================================= */

import { useMemo, useState } from 'react'
import { Check, Copy, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import type { PlanDay, WorkoutPlan } from '../lib/types'
import { useStore } from '../lib/store'
import { useT } from '../lib/i18n'
import { today } from '../lib/date'
import { EQUIPMENT_LABELS, MUSCLE_LABELS, SEED_EXERCISES, hasEquipment } from '../data/exercises'
import { ConfirmSheet, Empty, ScreenHeader, Sheet, useToast } from '../components/ui'

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function WorkoutPlans() {
  const { t } = useT()
  const { data, actions } = useStore()
  const toast = useToast()

  const [editing, setEditing] = useState<WorkoutPlan | null>(null)
  const [deleting, setDeleting] = useState<WorkoutPlan | null>(null)

  const exerciseName = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of [...SEED_EXERCISES, ...data.customExercises]) map.set(e.id, e.name)
    return (id: string) => map.get(id) ?? id
  }, [data.customExercises])

  function blankPlan(): WorkoutPlan {
    return {
      id: `plan-${Date.now()}`,
      name: '',
      days: Array.from({ length: 7 }, (_, weekday) => ({
        weekday,
        title: 'Rest',
        rest: true,
        exerciseIds: [],
      })),
      createdAt: today(),
    }
  }

  function duplicate(plan: WorkoutPlan) {
    const copy: WorkoutPlan = {
      ...plan,
      id: `plan-${Date.now()}`,
      name: `${plan.name} (copy)`,
      builtIn: false,
      createdAt: today(),
      days: plan.days.map((d) => ({ ...d, exerciseIds: [...d.exerciseIds] })),
    }
    actions.savePlan(copy)
    setEditing(copy)
  }

  return (
    <div className="shell">
      <ScreenHeader title={t('wk.plans')} back="/workout" />

      <button
        type="button"
        className="btn btn--primary btn--block btn--lg"
        style={{ marginTop: 'var(--s-4)' }}
        onClick={() => setEditing(blankPlan())}
      >
        <Plus size={17} aria-hidden="true" />
        {t('wk.plan.new')}
      </button>

      <div className="eyebrow">Your programmes</div>

      <ul className="wp-list">
        {data.plans.map((plan) => {
          const active = plan.id === data.activePlanId
          const trainingDays = plan.days.filter((d) => !d.rest)
          return (
            <li key={plan.id}>
              <article className={`card wp-card${active ? ' wp-card--active' : ''}`}>
                <div className="row row--between">
                  <div className="grow">
                    <h2 className="wp-name">{plan.name}</h2>
                    <p className="wp-meta">
                      {trainingDays.length} training {trainingDays.length === 1 ? 'day' : 'days'}
                      {plan.builtIn && ' · built in'}
                    </p>
                  </div>
                  {active && (
                    <span className="wp-badge">
                      <Check size={11} strokeWidth={3} aria-hidden="true" />
                      {t('wk.plan.active')}
                    </span>
                  )}
                </div>

                {plan.description && <p className="wp-desc">{plan.description}</p>}

                <ul className="wp-week">
                  {plan.days.map((d) => (
                    <li key={d.weekday} className="wp-day">
                      <span className="wp-dayName">{WEEKDAY_SHORT[d.weekday]}</span>
                      <span className={`wp-dayTitle${d.rest ? ' wp-dayTitle--rest' : ''} truncate`}>
                        {d.title}
                      </span>
                      {!d.rest && <span className="num wp-dayCount">{d.exerciseIds.length}</span>}
                    </li>
                  ))}
                </ul>

                <div className="wp-actions">
                  {!active && (
                    <button
                      type="button"
                      className="btn btn--primary grow"
                      onClick={() => {
                        actions.setActivePlan(plan.id)
                        toast.show(`${plan.name} is now your programme`, { tone: 'good' })
                      }}
                    >
                      {t('wk.plan.use')}
                    </button>
                  )}
                  {plan.builtIn ? (
                    <button type="button" className="btn btn--ghost" onClick={() => duplicate(plan)}>
                      <Copy size={15} aria-hidden="true" />
                      Copy and edit
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={() => setEditing(plan)}
                      >
                        <Pencil size={15} aria-hidden="true" />
                        {t('common.edit')}
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Delete ${plan.name}`}
                        onClick={() => setDeleting(plan)}
                      >
                        <Trash2 size={17} aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>
              </article>
            </li>
          )
        })}
      </ul>

      {editing && (
        <PlanEditor
          plan={editing}
          exerciseName={exerciseName}
          onClose={() => setEditing(null)}
          onSave={(p) => {
            actions.savePlan(p)
            if (!data.activePlanId) actions.setActivePlan(p.id)
            setEditing(null)
            toast.show(t('common.saved'), { tone: 'good' })
          }}
        />
      )}

      <ConfirmSheet
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) actions.deletePlan(deleting.id)
          toast.show('Programme deleted')
        }}
        title={`Delete ${deleting?.name ?? 'programme'}?`}
        body="Your logged sessions are kept — only the programme template is removed."
      />

      <style>{`
        .wp-list { display: flex; flex-direction: column; gap: var(--s-3); }
        .wp-card--active { border-color: var(--ember-line); }
        .wp-name {
          font-size: var(--fs-lg); font-weight: 700;
          letter-spacing: var(--tr-display);
        }
        .wp-meta {
          font-family: var(--font-display);
          font-size: var(--fs-micro); font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--text-3); margin-top: 2px;
        }
        .wp-badge {
          display: inline-flex; align-items: center; gap: 4px;
          flex: none; padding: 3px 8px;
          background: var(--ember-soft);
          border: 1px solid var(--ember);
          border-radius: var(--r-pill);
          font-family: var(--font-display);
          font-size: 9px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--ember);
        }
        .wp-desc {
          margin-top: var(--s-2);
          font-size: var(--fs-tiny); color: var(--text-2); line-height: 1.5;
        }
        .wp-week {
          display: flex; flex-direction: column; gap: 1px;
          margin: var(--s-4) 0;
        }
        .wp-day {
          display: flex; align-items: center; gap: var(--s-3);
          min-height: 30px;
          border-bottom: 1px solid var(--hairline);
        }
        .wp-dayName {
          width: 36px; flex: none;
          font-family: var(--font-display);
          font-size: var(--fs-micro); font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--text-3);
        }
        .wp-dayTitle { flex: 1; font-size: var(--fs-tiny); color: var(--text-1); }
        .wp-dayTitle--rest { color: var(--text-3); }
        .wp-dayCount { flex: none; font-size: var(--fs-micro); color: var(--text-3); }
        .wp-actions { display: flex; gap: var(--s-2); }
      `}</style>
    </div>
  )
}

/* ============================== plan editor ============================== */

function PlanEditor({
  plan,
  exerciseName,
  onClose,
  onSave,
}: {
  plan: WorkoutPlan
  exerciseName: (id: string) => string
  onClose: () => void
  onSave: (p: WorkoutPlan) => void
}) {
  const { t } = useT()
  const [draft, setDraft] = useState<WorkoutPlan>(() => ({
    ...plan,
    days: plan.days.map((d) => ({ ...d, exerciseIds: [...d.exerciseIds] })),
  }))
  const [pickFor, setPickFor] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const updateDay = (weekday: number, patch: Partial<PlanDay>) =>
    setDraft((d) => ({
      ...d,
      days: d.days.map((day) => (day.weekday === weekday ? { ...day, ...patch } : day)),
    }))

  function save() {
    if (!draft.name.trim()) {
      setError('Give the programme a name.')
      return
    }
    onSave({ ...draft, name: draft.name.trim(), builtIn: false })
  }

  if (pickFor != null) {
    const day = draft.days.find((d) => d.weekday === pickFor)!
    return (
      <ExercisePicker
        title={`${WEEKDAY_NAMES[pickFor]} · ${day.title}`}
        selected={day.exerciseIds}
        onClose={() => setPickFor(null)}
        onChange={(ids) => updateDay(pickFor, { exerciseIds: ids })}
      />
    )
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={plan.name ? t('common.edit') : t('wk.plan.new')}
      tall
      footer={
        <button type="button" className="btn btn--primary btn--block btn--lg" onClick={save}>
          {t('common.save')}
        </button>
      }
    >
      <label className="field" style={{ marginBottom: 'var(--s-5)' }}>
        <span className="field__label">
          Programme name<span className="field__req" aria-hidden="true">*</span>
        </span>
        <input
          className="input"
          value={draft.name}
          onChange={(e) => {
            setDraft((d) => ({ ...d, name: e.target.value }))
            setError(null)
          }}
          placeholder="My six-day split"
          aria-invalid={!!error}
          maxLength={40}
        />
        {error && (
          <span className="field__error" role="alert">
            {error}
          </span>
        )}
      </label>

      <ul className="pe-days">
        {draft.days.map((day) => (
          <li key={day.weekday} className="pe-day">
            <div className="row row--between">
              <span className="pe-dayName">{WEEKDAY_NAMES[day.weekday]}</span>
              <button
                type="button"
                className="chip"
                aria-pressed={day.rest}
                onClick={() =>
                  updateDay(day.weekday, {
                    rest: !day.rest,
                    title: !day.rest ? 'Rest' : 'Training',
                    exerciseIds: !day.rest ? [] : day.exerciseIds,
                  })
                }
                style={{ minHeight: 34, padding: '0 var(--s-3)', fontSize: 'var(--fs-tiny)' }}
              >
                {day.rest ? 'Rest day' : 'Training day'}
              </button>
            </div>

            {!day.rest && (
              <>
                <input
                  className="input pe-title"
                  value={day.title}
                  onChange={(e) => updateDay(day.weekday, { title: e.target.value })}
                  placeholder="Chest + Shoulders + Triceps"
                  aria-label={`${WEEKDAY_NAMES[day.weekday]} title`}
                  maxLength={48}
                />

                {day.exerciseIds.length > 0 && (
                  <ul className="pe-exList">
                    {day.exerciseIds.map((id, i) => (
                      <li key={`${id}-${i}`} className="pe-ex">
                        <span className="grow truncate">{exerciseName(id)}</span>
                        <button
                          type="button"
                          className="pe-exDel"
                          aria-label={`Remove ${exerciseName(id)}`}
                          onClick={() =>
                            updateDay(day.weekday, {
                              exerciseIds: day.exerciseIds.filter((_, idx) => idx !== i),
                            })
                          }
                        >
                          <X size={13} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <button
                  type="button"
                  className="btn btn--quiet"
                  onClick={() => setPickFor(day.weekday)}
                >
                  <Plus size={14} aria-hidden="true" />
                  {day.exerciseIds.length ? 'Edit exercises' : t('wk.addExercise')}
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      <style>{`
        .pe-days { display: flex; flex-direction: column; gap: var(--s-3); }
        .pe-day {
          padding: var(--s-3);
          background: var(--surface-2);
          border: 1px solid var(--hairline);
          border-radius: var(--r-md);
        }
        .pe-dayName {
          font-family: var(--font-display);
          font-size: var(--fs-sm); font-weight: 700;
          letter-spacing: var(--tr-display);
        }
        .pe-title { margin-top: var(--s-3); min-height: 44px; }
        .pe-exList {
          display: flex; flex-direction: column; gap: 1px;
          margin-top: var(--s-3);
        }
        .pe-ex {
          display: flex; align-items: center; gap: var(--s-2);
          min-height: 34px;
          font-size: var(--fs-tiny); color: var(--text-2);
          border-bottom: 1px solid var(--hairline);
        }
        .pe-exDel {
          display: grid; place-items: center;
          width: 30px; height: 30px; flex: none;
          border-radius: var(--r-sm); color: var(--text-3);
        }
        .pe-exDel:hover { background: var(--critical-soft); color: var(--critical); }
      `}</style>
    </Sheet>
  )
}

/* ============================ exercise picker ============================ */

function ExercisePicker({
  title,
  selected,
  onClose,
  onChange,
}: {
  title: string
  selected: string[]
  onClose: () => void
  onChange: (ids: string[]) => void
}) {
  const { t } = useT()
  const { data } = useStore()
  const [query, setQuery] = useState('')
  const [onlyMine, setOnlyMine] = useState(true)
  const equipment = data.profile!.equipment

  const all = useMemo(() => [...SEED_EXERCISES, ...data.customExercises], [data.customExercises])
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all
      .filter((e) => (onlyMine ? hasEquipment(equipment, e.equipment) : true))
      .filter(
        (e) =>
          !q ||
          e.name.toLowerCase().includes(q) ||
          MUSCLE_LABELS[e.muscle].toLowerCase().includes(q),
      )
  }, [all, onlyMine, equipment, query])

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={title}
      tall
      footer={
        <button type="button" className="btn btn--primary btn--block btn--lg" onClick={onClose}>
          {t('common.done')} · {selected.length} selected
        </button>
      }
    >
      <div className="ep-search">
        <Search size={16} aria-hidden="true" />
        <input
          className="ep-input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or muscle"
          aria-label={t('common.search')}
        />
      </div>

      <label className="ep-filter">
        <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
        <span>Only what I can train with</span>
      </label>

      {results.length === 0 ? (
        <Empty title="Nothing matches" body="Try a shorter word, or turn off the equipment filter." />
      ) : (
        <ul>
          {results.map((e) => {
            const on = selected.includes(e.id)
            return (
              <li key={e.id}>
                <button
                  type="button"
                  className="ep-row"
                  data-on={on}
                  aria-pressed={on}
                  onClick={() => toggle(e.id)}
                >
                  <span className="ep-check" aria-hidden="true">
                    {on && <Check size={13} strokeWidth={3} />}
                  </span>
                  <span className="grow">
                    <span className="ep-name">{e.name}</span>
                    <span className="ep-meta">
                      {MUSCLE_LABELS[e.muscle]} · {EQUIPMENT_LABELS[e.equipment]}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <style>{`
        .ep-search {
          display: flex; align-items: center; gap: var(--s-2);
          padding: 0 var(--s-3);
          background: var(--surface-2);
          border: 1px solid var(--hairline);
          border-radius: var(--r-md);
          color: var(--text-3);
        }
        .ep-input {
          flex: 1; height: 48px; background: transparent; border: 0;
          font-size: var(--fs-base);
        }
        .ep-input:focus { outline: none; }
        .ep-filter {
          display: flex; align-items: center; gap: var(--s-2);
          min-height: 44px; margin-top: var(--s-2);
          font-size: var(--fs-tiny); color: var(--text-2); cursor: pointer;
        }
        .ep-filter input { width: 17px; height: 17px; accent-color: var(--ember); }
        .ep-row {
          display: flex; align-items: center; gap: var(--s-3);
          width: 100%; min-height: 56px; padding: var(--s-2);
          border-bottom: 1px solid var(--hairline);
          text-align: left;
        }
        .ep-check {
          display: grid; place-items: center;
          width: 22px; height: 22px; flex: none;
          border-radius: 6px;
          border: 1.5px solid var(--hairline-strong);
          color: var(--text-on-ember);
        }
        .ep-row[data-on='true'] .ep-check {
          background: var(--ember); border-color: var(--ember);
        }
        .ep-name { display: block; font-size: var(--fs-sm); font-weight: 600; }
        .ep-meta {
          display: block;
          font-family: var(--font-display);
          font-size: var(--fs-micro); font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--text-3);
        }
      `}</style>
    </Sheet>
  )
}
