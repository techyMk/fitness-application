/* ============================================================================
   Fitness phases (spec §28). A lifetime history of what you were doing and why —
   90-day cut, then a build, then maintenance.

   Phases do not change app behaviour on their own; they record intent and the
   targets that went with it, so a year later you can see what the numbers were
   during the phase that worked.
   ========================================================================= */

import { useMemo, useState } from 'react'
import { Layers, Pencil, Plus, Trash2 } from 'lucide-react'
import type { GoalType, Phase } from '../lib/types'
import { useStore } from '../lib/store'
import { useT } from '../lib/i18n'
import { fmtInt, makeFmt } from '../lib/units'
import { addDays, daysBetween, fmtDate, today } from '../lib/date'
import {
  ConfirmSheet,
  Empty,
  ScreenHeader,
  Sheet,
  Stepper,
  useToast,
} from '../components/ui'

const GOALS: GoalType[] = ['fat-loss', 'muscle-gain', 'recomp', 'maintenance', 'general', 'custom']

export default function Phases() {
  const { t, locale } = useT()
  const { data, actions } = useStore()
  const toast = useToast()
  const profile = data.profile!
  const fmt = useMemo(() => makeFmt(profile.units), [profile.units])

  const [editing, setEditing] = useState<Phase | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Phase | null>(null)

  const phases = useMemo(
    () => [...data.phases].sort((a, b) => (a.startDate < b.startDate ? 1 : -1)),
    [data.phases],
  )

  const isCurrent = (p: Phase) =>
    p.startDate <= today() && (!p.endDate || p.endDate >= today())

  return (
    <div className="shell">
      <ScreenHeader
        title={t('set.phases')}
        back="/more"
        action={
          <button
            type="button"
            className="icon-btn"
            aria-label="Add phase"
            onClick={() => setCreating(true)}
          >
            <Plus size={20} aria-hidden="true" />
          </button>
        }
      />

      <p className="ph-intro">
        A phase records what you were working on and the targets that went with it. Keeping the
        history means you can look back and see which setup actually moved the needle.
      </p>

      {phases.length === 0 ? (
        <Empty
          icon={<Layers size={26} aria-hidden="true" />}
          title="No phases yet"
          body="Add the phase you are in now — fat loss, a build, or maintenance — and the history starts here."
          action={
            <button type="button" className="btn btn--primary" onClick={() => setCreating(true)}>
              <Plus size={15} aria-hidden="true" />
              Add a phase
            </button>
          }
        />
      ) : (
        <ul className="ph-list">
          {phases.map((p) => {
            const current = isCurrent(p)
            const length = p.endDate ? daysBetween(p.startDate, p.endDate) + 1 : null
            const elapsed = daysBetween(p.startDate, today()) + 1
            const plan = data.plans.find((x) => x.id === p.planId)

            return (
              <li key={p.id}>
                <article className={`card${current ? ' ph-card--current' : ''}`}>
                  <div className="row row--between">
                    <div className="grow">
                      <h2 className="ph-name">{p.name}</h2>
                      <p className="ph-goal">{t(`goal.${p.goal}`)}</p>
                    </div>
                    {current && <span className="ph-badge">Current</span>}
                  </div>

                  <p className="ph-dates num">
                    {fmtDate(p.startDate, locale)} →{' '}
                    {p.endDate ? fmtDate(p.endDate, locale) : 'open-ended'}
                    {length ? ` · ${length} days` : current ? ` · day ${elapsed}` : ''}
                  </p>

                  <dl className="ph-targets">
                    {p.calories != null && (
                      <div>
                        <dt>{t('nutri.calories')}</dt>
                        <dd className="num">{fmtInt(p.calories, locale)} kcal</dd>
                      </div>
                    )}
                    {p.protein != null && (
                      <div>
                        <dt>{t('nutri.protein')}</dt>
                        <dd className="num">{p.protein} g</dd>
                      </div>
                    )}
                    {p.targetWeightKg != null && (
                      <div>
                        <dt>{t('common.target')}</dt>
                        <dd className="num">{fmt.weightLabel(p.targetWeightKg)}</dd>
                      </div>
                    )}
                    {plan && (
                      <div>
                        <dt>Programme</dt>
                        <dd>{plan.name}</dd>
                      </div>
                    )}
                  </dl>

                  {p.note && <p className="ph-note">{p.note}</p>}

                  <div className="ph-actions">
                    <button
                      type="button"
                      className="btn btn--ghost grow"
                      onClick={() => setEditing(p)}
                    >
                      <Pencil size={15} aria-hidden="true" />
                      {t('common.edit')}
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Delete ${p.name}`}
                      onClick={() => setDeleting(p)}
                    >
                      <Trash2 size={17} aria-hidden="true" />
                    </button>
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      )}

      {(creating || editing) && (
        <PhaseSheet
          phase={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
        />
      )}

      <ConfirmSheet
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) actions.deletePhase(deleting.id)
          toast.show('Phase deleted')
        }}
        title={`Delete ${deleting?.name ?? 'phase'}?`}
        body="Your logged data is untouched — only the phase record is removed."
      />

      <style>{`
        .ph-intro {
          margin-top: var(--s-4);
          font-size: var(--fs-sm); color: var(--text-2);
          line-height: 1.5; max-width: 44ch;
        }
        .ph-list {
          display: flex; flex-direction: column; gap: var(--s-3);
          margin-top: var(--s-5);
        }
        .ph-card--current { border-color: var(--ember-line); }
        .ph-name {
          font-size: var(--fs-lg); font-weight: 700;
          letter-spacing: var(--tr-display);
        }
        .ph-goal {
          font-family: var(--font-display);
          font-size: var(--fs-micro); font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--ember); margin-top: 2px;
        }
        .ph-badge {
          flex: none; padding: 3px 8px;
          background: var(--ember-soft);
          border: 1px solid var(--ember);
          border-radius: var(--r-pill);
          font-family: var(--font-display);
          font-size: 9px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--ember);
        }
        .ph-dates {
          margin-top: var(--s-3);
          font-size: var(--fs-tiny); color: var(--text-3);
        }
        .ph-targets {
          display: grid; grid-template-columns: repeat(2, 1fr);
          gap: var(--s-3);
          margin: var(--s-4) 0;
        }
        .ph-targets dt {
          font-family: var(--font-display);
          font-size: var(--fs-micro); font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--text-3);
        }
        .ph-targets dd {
          font-size: var(--fs-sm); font-weight: 600; margin-top: 2px;
        }
        .ph-note {
          padding: var(--s-3);
          background: var(--surface-2);
          border-radius: var(--r-sm);
          font-size: var(--fs-tiny); color: var(--text-2);
          line-height: 1.5; margin-bottom: var(--s-4);
        }
        .ph-actions { display: flex; gap: var(--s-2); }
      `}</style>
    </div>
  )
}

/* ------------------------------- phase sheet ------------------------------ */

function PhaseSheet({ phase, onClose }: { phase: Phase | null; onClose: () => void }) {
  const { t } = useT()
  const { data, actions } = useStore()
  const toast = useToast()
  const profile = data.profile!
  const fmt = useMemo(() => makeFmt(profile.units), [profile.units])

  const [name, setName] = useState(phase?.name ?? '')
  const [goal, setGoal] = useState<GoalType>(phase?.goal ?? profile.goal)
  const [startDate, setStartDate] = useState(phase?.startDate ?? today())
  const [endDate, setEndDate] = useState(phase?.endDate ?? addDays(today(), 89))
  const [openEnded, setOpenEnded] = useState(phase ? !phase.endDate : false)
  const [calories, setCalories] = useState(phase?.calories ?? profile.targets.calories)
  const [protein, setProtein] = useState(phase?.protein ?? profile.targets.protein)
  const [targetWeight, setTargetWeight] = useState(() =>
    Number(fmt.weight(phase?.targetWeightKg ?? profile.targetWeightKg)),
  )
  const [planId, setPlanId] = useState(phase?.planId ?? data.activePlanId ?? '')
  const [note, setNote] = useState(phase?.note ?? '')
  const [error, setError] = useState<string | null>(null)

  function save() {
    if (!name.trim()) {
      setError('Name the phase so it reads well in your history.')
      return
    }
    const payload = {
      name: name.trim(),
      goal,
      startDate,
      endDate: openEnded ? undefined : endDate,
      calories,
      protein,
      targetWeightKg: Number(fmt.toKg(targetWeight).toFixed(2)),
      planId: planId || undefined,
      note: note.trim() || undefined,
    }
    if (phase) actions.updatePhase(phase.id, payload)
    else actions.addPhase(payload)
    toast.show(t('common.saved'), { tone: 'good' })
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={phase ? 'Edit phase' : 'Add a phase'}
      tall
      footer={
        <button type="button" className="btn btn--primary btn--block btn--lg" onClick={save}>
          {t('common.save')}
        </button>
      }
    >
      <div className="stack-4">
        <label className="field">
          <span className="field__label">
            Name<span className="field__req" aria-hidden="true">*</span>
          </span>
          <input
            className="input"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError(null)
            }}
            placeholder="Phase 1 — 90-day cut"
            aria-invalid={!!error}
            maxLength={40}
          />
          {error && (
            <span className="field__error" role="alert">
              {error}
            </span>
          )}
        </label>

        <div className="field">
          <span className="field__label">Goal</span>
          <select
            className="select"
            value={goal}
            onChange={(e) => setGoal(e.target.value as GoalType)}
          >
            {GOALS.map((g) => (
              <option key={g} value={g}>
                {t(`goal.${g}`)}
              </option>
            ))}
          </select>
        </div>

        <label className="field">
          <span className="field__label">Start</span>
          <input
            className="input"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>

        <label className="ps-open">
          <input
            type="checkbox"
            checked={openEnded}
            onChange={(e) => setOpenEnded(e.target.checked)}
          />
          <span>
            <span className="ps-openLabel">Open-ended</span>
            <span className="ps-openHint">For the phase you are in right now</span>
          </span>
        </label>

        {!openEnded && (
          <label className="field">
            <span className="field__label">End</span>
            <input
              className="input"
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
        )}

        <div className="grid-2">
          <Stepper
            label={t('nutri.calories')}
            unit="kcal"
            step={50}
            min={1000}
            max={6000}
            value={calories}
            onChange={setCalories}
          />
          <Stepper
            label={t('nutri.protein')}
            unit="g"
            step={5}
            min={40}
            max={400}
            value={protein}
            onChange={setProtein}
          />
        </div>

        <Stepper
          label={`${t('common.target')} ${t('home.weight').toLowerCase()}`}
          unit={fmt.weightUnit}
          step={0.5}
          decimals={1}
          min={profile.units === 'imperial' ? 66 : 30}
          max={profile.units === 'imperial' ? 660 : 300}
          value={targetWeight}
          onChange={setTargetWeight}
        />

        <div className="field">
          <span className="field__label">Programme</span>
          <select className="select" value={planId} onChange={(e) => setPlanId(e.target.value)}>
            <option value="">None</option>
            {data.plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <label className="field">
          <span className="field__label">Notes</span>
          <textarea
            className="textarea"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What am I trying to prove in this phase?"
            maxLength={280}
          />
        </label>
      </div>

      <style>{`
        .ps-open {
          display: flex; align-items: flex-start; gap: var(--s-3);
          min-height: 48px; cursor: pointer;
        }
        .ps-open input { width: 19px; height: 19px; margin-top: 2px; accent-color: var(--ember); }
        .ps-openLabel { display: block; font-size: var(--fs-sm); font-weight: 600; }
        .ps-openHint { display: block; font-size: var(--fs-tiny); color: var(--text-3); }
      `}</style>
    </Sheet>
  )
}
