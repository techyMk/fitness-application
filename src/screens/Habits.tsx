/* ============================================================================
   Habits. Each habit shows its last 14 days as a heat strip, so consistency is
   visible as a pattern rather than a percentage you have to interpret.

   Auto habits (ticked by the data) are marked and not tappable. That distinction
   is the whole point: "hit protein target" should never need a second action
   after you already logged the food.
   ========================================================================= */

import { useMemo, useState } from 'react'
import { Check, ListChecks, Plus, Trash2, Zap } from 'lucide-react'
import type { Habit } from '../lib/types'
import { effectiveHabits } from '../lib/calc'
import { useStore } from '../lib/store'
import { useT } from '../lib/i18n'
import { addDays, fmtWeekday, lastNDays, monthDays, today, weekStart } from '../lib/date'
import { HeatStrip } from '../components/charts'
import {
  ConfirmSheet,
  Empty,
  ScreenHeader,
  Sheet,
  Stat,
  useToast,
} from '../components/ui'

const AUTO_OPTIONS: Array<{ value: NonNullable<Habit['auto']> | 'manual'; label: string; hint: string }> = [
  { value: 'manual', label: 'I tick it myself', hint: 'For anything the app cannot see' },
  { value: 'workout', label: 'Trained today', hint: 'Ticks when a session is finished' },
  { value: 'protein', label: 'Hit protein target', hint: 'Ticks at 95% of target or above' },
  { value: 'calories', label: 'Stayed in calorie band', hint: 'Ticks when inside 105% of target' },
  { value: 'steps', label: 'Hit step target', hint: 'Ticks at target or above' },
  { value: 'sleep', label: 'Hit sleep target', hint: 'Ticks at 90% of target or above' },
]

export default function Habits() {
  const { t, locale } = useT()
  const { data, actions } = useStore()
  const toast = useToast()
  const date = today()

  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Habit | null>(null)

  const active = data.habits.filter((h) => !h.archived)
  const doneToday = effectiveHabits(data, date)

  const last14 = useMemo(() => lastNDays(14), [])
  const thisWeek = useMemo(() => {
    const start = weekStart(date)
    return Array.from({ length: 7 }, (_, i) => addDays(start, i)).filter((d) => d <= date)
  }, [date])
  const thisMonth = useMemo(() => monthDays(date).filter((d) => d <= date), [date])

  /** Per-habit completion ratio over a window, counting auto ticks. */
  const ratioOver = (habitId: string, dates: string[]) => {
    if (!dates.length) return 0
    const hits = dates.filter((d) => effectiveHabits(data, d).includes(habitId)).length
    return hits / dates.length
  }

  const streakOf = (habitId: string) => {
    let n = 0
    let cursor = date
    // Today is forgiven until it has been ticked, so the streak does not read 0
    // every morning.
    if (!effectiveHabits(data, cursor).includes(habitId)) cursor = addDays(cursor, -1)
    for (let i = 0; i < 400; i++) {
      if (!effectiveHabits(data, cursor).includes(habitId)) break
      n++
      cursor = addDays(cursor, -1)
    }
    return n
  }

  return (
    <div className="shell">
      <ScreenHeader
        title={t('habits.title')}
        subtitle={`${doneToday.filter((id) => active.some((h) => h.id === id)).length} of ${active.length} today`}
        back="/more"
        action={
          <button
            type="button"
            className="icon-btn"
            aria-label={t('habits.new')}
            onClick={() => setCreating(true)}
          >
            <Plus size={20} aria-hidden="true" />
          </button>
        }
      />

      {active.length === 0 ? (
        <Empty
          icon={<ListChecks size={26} aria-hidden="true" />}
          title={t('habits.empty')}
          body={t('habits.empty.body')}
          action={
            <button type="button" className="btn btn--primary" onClick={() => setCreating(true)}>
              <Plus size={15} aria-hidden="true" />
              {t('habits.new')}
            </button>
          }
        />
      ) : (
        <ul className="hb-list" style={{ marginTop: 'var(--s-4)' }}>
          {active.map((h) => {
            const done = doneToday.includes(h.id)
            const cells = last14.map((d) => ({
              label: fmtWeekday(d, locale).slice(0, 1),
              ratio: effectiveHabits(data, d).includes(h.id) ? 1 : 0,
              empty: !effectiveHabits(data, d).includes(h.id),
            }))

            return (
              <li key={h.id}>
                <article className="card">
                  <div className="row">
                    <button
                      type="button"
                      className="hb-tick"
                      data-on={done}
                      aria-pressed={done}
                      aria-label={`${h.name}: ${done ? 'done' : 'not done'} today`}
                      disabled={!!h.auto}
                      onClick={() => actions.toggleHabit(h.id, date)}
                    >
                      {done && <Check size={18} strokeWidth={3} aria-hidden="true" />}
                    </button>

                    <div className="grow">
                      <h2 className="hb-name">{h.name}</h2>
                      {h.auto ? (
                        <p className="hb-auto">
                          <Zap size={10} aria-hidden="true" />
                          {t('habits.auto')} · {t('habits.auto.hint')}
                        </p>
                      ) : (
                        <p className="hb-meta">Tap the circle to mark it done</p>
                      )}
                    </div>

                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Delete ${h.name}`}
                      onClick={() => setDeleting(h)}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>

                  <div style={{ marginTop: 'var(--s-4)' }}>
                    <HeatStrip cells={cells} label={`${h.name}, last 14 days`} />
                  </div>

                  <div className="hb-stats">
                    <Stat
                      label={t('habits.streak')}
                      value={streakOf(h.id)}
                      unit="days"
                      size="sm"
                      tone={streakOf(h.id) > 0 ? 'ember' : 'dim'}
                    />
                    <Stat
                      label={t('habits.weekly')}
                      value={Math.round(ratioOver(h.id, thisWeek) * 100)}
                      unit="%"
                      size="sm"
                    />
                    <Stat
                      label={t('habits.monthly')}
                      value={Math.round(ratioOver(h.id, thisMonth) * 100)}
                      unit="%"
                      size="sm"
                    />
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      )}

      {creating && <NewHabitSheet onClose={() => setCreating(false)} />}

      <ConfirmSheet
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) actions.deleteHabit(deleting.id)
          toast.show('Habit deleted')
        }}
        title={`Delete ${deleting?.name ?? 'habit'}?`}
        body="Its history goes with it, and your score will recalculate on the remaining habits."
      />

      <style>{`
        .hb-list { display: flex; flex-direction: column; gap: var(--s-3); }
        .hb-tick {
          display: grid; place-items: center;
          width: 44px; height: 44px; flex: none;
          border-radius: 50%;
          border: 2px solid var(--hairline-strong);
          background: var(--surface-2);
          color: var(--text-on-ember);
          transition:
            background-color var(--t-fast) var(--ease-out),
            border-color var(--t-fast) var(--ease-out);
        }
        .hb-tick:hover:not(:disabled) { border-color: var(--ember); }
        .hb-tick:disabled { cursor: default; }
        .hb-tick[data-on='true'] {
          background: var(--kiln-4); border-color: var(--kiln-4);
        }
        .hb-name {
          font-size: var(--fs-base); font-weight: 700;
          letter-spacing: var(--tr-display);
        }
        .hb-auto {
          display: flex; align-items: center; gap: 4px;
          font-family: var(--font-display);
          font-size: var(--fs-micro); font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--kiln-4); margin-top: 2px;
        }
        .hb-meta { font-size: var(--fs-tiny); color: var(--text-3); margin-top: 1px; }
        .hb-stats {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: var(--s-3);
          margin-top: var(--s-4); padding-top: var(--s-3);
          border-top: 1px solid var(--hairline);
        }
      `}</style>
    </div>
  )
}

/* ------------------------------- new habit ------------------------------- */

function NewHabitSheet({ onClose }: { onClose: () => void }) {
  const { t } = useT()
  const { actions } = useStore()
  const toast = useToast()

  const [name, setName] = useState('')
  const [auto, setAuto] = useState<NonNullable<Habit['auto']> | 'manual'>('manual')
  const [error, setError] = useState<string | null>(null)

  function create() {
    if (!name.trim()) {
      setError('Give the habit a name.')
      return
    }
    actions.addHabit({
      name: name.trim(),
      icon: 'check',
      auto: auto === 'manual' ? undefined : auto,
    })
    toast.show(`${name.trim()} added`, { tone: 'good' })
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={t('habits.new')}
      tall
      footer={
        <button type="button" className="btn btn--primary btn--block btn--lg" onClick={create}>
          {t('common.create')}
        </button>
      }
    >
      <div className="stack-4">
        <label className="field">
          <span className="field__label">
            What's the habit?<span className="field__req" aria-hidden="true">*</span>
          </span>
          <input
            className="input"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError(null)
            }}
            placeholder="Walk after dinner"
            aria-invalid={!!error}
            maxLength={40}
          />
          {error && (
            <span className="field__error" role="alert">
              {error}
            </span>
          )}
        </label>

        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field__label">How should it be marked done?</legend>
          <div className="nh-opts" role="radiogroup">
            {AUTO_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={auto === o.value}
                className="nh-opt"
                data-on={auto === o.value}
                onClick={() => setAuto(o.value)}
              >
                <span className="grow">
                  <span className="nh-optLabel">{o.label}</span>
                  <span className="nh-optHint">{o.hint}</span>
                </span>
                {auto === o.value && <Check size={15} strokeWidth={3} aria-hidden="true" />}
              </button>
            ))}
          </div>
          <p className="field__hint">
            An automatic habit never needs a tap — the log ticks it for you.
          </p>
        </fieldset>
      </div>

      <style>{`
        .nh-opts { display: flex; flex-direction: column; gap: var(--s-2); margin-top: var(--s-2); }
        .nh-opt {
          display: flex; align-items: center; gap: var(--s-3);
          min-height: 56px; padding: var(--s-2) var(--s-3);
          background: var(--surface-2);
          border: 1px solid var(--hairline);
          border-radius: var(--r-md);
          text-align: left;
          color: var(--text-2);
        }
        .nh-opt[data-on='true'] {
          background: var(--ember-soft); border-color: var(--ember); color: var(--ember);
        }
        .nh-optLabel { display: block; font-size: var(--fs-sm); font-weight: 600; }
        .nh-optHint { display: block; font-size: var(--fs-tiny); color: var(--text-3); }
      `}</style>
    </Sheet>
  )
}
