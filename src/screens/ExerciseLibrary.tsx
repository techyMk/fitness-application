/* ============================================================================
   Exercise library. Browse, filter by muscle and equipment, read the cues, see
   your own history and records for each lift, and add custom exercises.
   ========================================================================= */

import { useMemo, useState } from 'react'
import { Plus, Search, Trash2, Trophy } from 'lucide-react'
import type { Equipment, Exercise, MuscleGroup } from '../lib/types'
import { computeRecord, estimate1rm, lastPerformance } from '../lib/calc'
import { useStore } from '../lib/store'
import { useT } from '../lib/i18n'
import { makeFmt } from '../lib/units'
import { fmtDate } from '../lib/date'
import {
  EQUIPMENT_LABELS,
  MUSCLE_LABELS,
  SEED_EXERCISES,
  hasEquipment,
} from '../data/exercises'
import { ConfirmSheet, Empty, ScreenHeader, Sheet, Stat, useToast } from '../components/ui'

const MUSCLES = Object.keys(MUSCLE_LABELS) as MuscleGroup[]
const EQUIPMENT = Object.keys(EQUIPMENT_LABELS) as Equipment[]

export default function ExerciseLibrary() {
  const { t, locale } = useT()
  const { data, actions } = useStore()
  const toast = useToast()
  const profile = data.profile!
  const fmt = useMemo(() => makeFmt(profile.units), [profile.units])

  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null)
  const [onlyMine, setOnlyMine] = useState(false)
  const [detail, setDetail] = useState<Exercise | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Exercise | null>(null)

  const all = useMemo(
    () => [...data.customExercises, ...SEED_EXERCISES],
    [data.customExercises],
  )

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all
      .filter((e) => (muscle ? e.muscle === muscle || e.secondary?.includes(muscle) : true))
      .filter((e) => (onlyMine ? hasEquipment(profile.equipment, e.equipment) : true))
      .filter(
        (e) =>
          !q ||
          e.name.toLowerCase().includes(q) ||
          MUSCLE_LABELS[e.muscle].toLowerCase().includes(q) ||
          EQUIPMENT_LABELS[e.equipment].toLowerCase().includes(q),
      )
  }, [all, muscle, onlyMine, profile.equipment, query])

  // Group by muscle so a long list has structure. The grouping encodes a real
  // property of the content, which is why it earns its headers.
  const grouped = useMemo(() => {
    const map = new Map<MuscleGroup, Exercise[]>()
    for (const e of results) {
      const list = map.get(e.muscle) ?? []
      list.push(e)
      map.set(e.muscle, list)
    }
    return [...map.entries()].sort((a, b) => MUSCLES.indexOf(a[0]) - MUSCLES.indexOf(b[0]))
  }, [results])

  return (
    <div className="shell">
      <ScreenHeader
        title={t('wk.library')}
        subtitle={`${all.length} exercises`}
        back="/workout"
        action={
          <button
            type="button"
            className="icon-btn"
            aria-label="Add custom exercise"
            onClick={() => setCreating(true)}
          >
            <Plus size={20} aria-hidden="true" />
          </button>
        }
      />

      <div className="el-search" style={{ marginTop: 'var(--s-4)' }}>
        <Search size={16} aria-hidden="true" />
        <input
          className="el-input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exercises"
          aria-label={t('common.search')}
        />
      </div>

      <div className="hscroll" style={{ marginTop: 'var(--s-3)' }}>
        <button
          type="button"
          className="chip"
          aria-pressed={muscle === null}
          onClick={() => setMuscle(null)}
        >
          All
        </button>
        {MUSCLES.map((m) => (
          <button
            key={m}
            type="button"
            className="chip"
            aria-pressed={muscle === m}
            onClick={() => setMuscle(muscle === m ? null : m)}
          >
            {MUSCLE_LABELS[m]}
          </button>
        ))}
      </div>

      <label className="el-filter">
        <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
        <span>Only what I can train with</span>
      </label>

      {results.length === 0 ? (
        <Empty
          title="Nothing matches"
          body="Try a shorter word, clear the muscle filter, or add it as a custom exercise."
          action={
            <button type="button" className="btn btn--ghost" onClick={() => setCreating(true)}>
              <Plus size={15} aria-hidden="true" />
              Add exercise
            </button>
          }
        />
      ) : (
        grouped.map(([group, items]) => (
          <section key={group}>
            <div className="eyebrow">
              {MUSCLE_LABELS[group]}
              <span className="eyebrow__action num">{items.length}</span>
            </div>
            <ul className="card card--flush">
              {items.map((e, i) => {
                const record = data.records.find((r) => r.exerciseId === e.id)
                return (
                  <li key={e.id}>
                    {i > 0 && <div className="divider" />}
                    <button type="button" className="el-row pressable" onClick={() => setDetail(e)}>
                      <span className="grow">
                        <span className="el-name">
                          {e.name}
                          {e.custom && <span className="el-mine">yours</span>}
                        </span>
                        <span className="el-meta">{EQUIPMENT_LABELS[e.equipment]}</span>
                      </span>
                      {record && (
                        <span className="num el-pr">
                          {e.isBodyweight
                            ? `${record.bestReps} reps`
                            : `${fmt.weight(record.bestWeightKg)} ${fmt.weightUnit}`}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}

      {/* ----------------------------- detail ----------------------------- */}
      {detail && (
        <Sheet open onClose={() => setDetail(null)} title={detail.name} tall>
          <p className="el-dMeta">
            {MUSCLE_LABELS[detail.muscle]}
            {detail.secondary?.length ? ` · also ${detail.secondary.map((m) => MUSCLE_LABELS[m]).join(', ')}` : ''}
            {' · '}
            {EQUIPMENT_LABELS[detail.equipment]}
          </p>

          {detail.cues && detail.cues.length > 0 && (
            <>
              <div className="eyebrow" style={{ marginTop: 'var(--s-5)' }}>
                How to do it
              </div>
              <ul className="el-cues">
                {detail.cues.map((c, i) => (
                  <li key={i} className="el-cue">
                    <span className="el-cueDot" aria-hidden="true" />
                    {c}
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="eyebrow">Recommended</div>
          <div className="grid-2">
            <Stat label={t('wk.sets')} value={detail.defaultSets ?? 3} size="md" />
            <Stat
              label={t('wk.reps')}
              value={
                detail.defaultRepRange
                  ? `${detail.defaultRepRange[0]}–${detail.defaultRepRange[1]}`
                  : '8–12'
              }
              size="md"
            />
          </div>

          <ExerciseHistory exercise={detail} />

          {detail.custom && (
            <button
              type="button"
              className="btn btn--danger btn--block"
              style={{ marginTop: 'var(--s-6)' }}
              onClick={() => {
                setDeleting(detail)
                setDetail(null)
              }}
            >
              <Trash2 size={15} aria-hidden="true" />
              Delete this exercise
            </button>
          )}

          <style>{`
            .el-dMeta {
              font-family: var(--font-display);
              font-size: var(--fs-micro); font-weight: 700;
              letter-spacing: 0.08em; text-transform: uppercase;
              color: var(--ember);
            }
            .el-cues { display: flex; flex-direction: column; gap: var(--s-3); }
            .el-cue {
              display: flex; gap: var(--s-3);
              font-size: var(--fs-sm); color: var(--text-2); line-height: 1.5;
            }
            .el-cueDot {
              width: 5px; height: 5px; border-radius: 50%; flex: none;
              background: var(--kiln-3); margin-top: 9px;
            }
          `}</style>
        </Sheet>
      )}

      {creating && <CreateExerciseSheet onClose={() => setCreating(false)} />}

      <ConfirmSheet
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) actions.deleteCustomExercise(deleting.id)
          toast.show('Exercise deleted')
        }}
        title={`Delete ${deleting?.name ?? 'exercise'}?`}
        body="Sets you already logged against it are kept in your history."
      />

      <style>{`
        .el-search {
          display: flex; align-items: center; gap: var(--s-2);
          padding: 0 var(--s-3);
          background: var(--surface-2);
          border: 1px solid var(--hairline);
          border-radius: var(--r-md);
          color: var(--text-3);
        }
        .el-input {
          flex: 1; height: 48px; background: transparent; border: 0;
          font-size: var(--fs-base);
        }
        .el-input:focus { outline: none; }
        .el-filter {
          display: flex; align-items: center; gap: var(--s-2);
          min-height: 44px; margin-top: var(--s-2);
          font-size: var(--fs-tiny); color: var(--text-2); cursor: pointer;
        }
        .el-filter input { width: 17px; height: 17px; accent-color: var(--ember); }
        .el-row {
          display: flex; align-items: center; gap: var(--s-3);
          width: 100%; min-height: 56px; padding: var(--s-2) var(--s-4);
          text-align: left;
        }
        .el-name {
          display: flex; align-items: center; gap: 6px;
          font-size: var(--fs-sm); font-weight: 600;
        }
        .el-mine {
          font-family: var(--font-display);
          font-size: 9px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--ember);
          padding: 1px 5px; background: var(--ember-soft); border-radius: 3px;
        }
        .el-meta {
          display: block;
          font-family: var(--font-display);
          font-size: var(--fs-micro); font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--text-3);
        }
        .el-pr { flex: none; font-size: var(--fs-tiny); color: var(--kiln-4); }
      `}</style>
    </div>
  )

  function ExerciseHistory({ exercise }: { exercise: Exercise }) {
    const sessions = data.sessions.filter(
      (s) => s.completed && s.sets.some((x) => x.exerciseId === exercise.id),
    )
    const record = computeRecord(data.sessions, exercise.id)
    const last = lastPerformance(data.sessions, exercise.id)

    if (!sessions.length) {
      return (
        <>
          <div className="eyebrow">{t('wk.history')}</div>
          <p className="dim" style={{ fontSize: 'var(--fs-sm)' }}>
            You haven't logged this one yet. Add it to a session and the numbers start filling in.
          </p>
        </>
      )
    }

    return (
      <>
        <div className="eyebrow">
          <Trophy size={11} aria-hidden="true" /> {t('pr.title')}
        </div>
        <div className="grid-3">
          <Stat
            label={t('pr.heaviest')}
            value={exercise.isBodyweight ? '—' : fmt.weight(record!.bestWeightKg)}
            unit={exercise.isBodyweight ? undefined : fmt.weightUnit}
            size="sm"
            hint={exercise.isBodyweight ? undefined : `× ${record!.bestWeightReps}`}
          />
          <Stat label={t('pr.bestReps')} value={record!.bestReps} size="sm" />
          <Stat
            label="Best e1RM"
            value={exercise.isBodyweight ? '—' : fmt.weight(record!.best1rmKg)}
            unit={exercise.isBodyweight ? undefined : fmt.weightUnit}
            size="sm"
          />
        </div>

        <div className="eyebrow">{t('wk.history')}</div>
        <ul className="eh-list">
          {sessions
            .slice()
            .sort((a, b) => (a.date < b.date ? 1 : -1))
            .slice(0, 12)
            .map((s) => {
              const sets = s.sets.filter((x) => x.exerciseId === exercise.id)
              const top = sets.reduce((a, b) =>
                estimate1rm(b.weightKg, b.reps) > estimate1rm(a.weightKg, a.reps) ? b : a,
              )
              return (
                <li key={s.id} className="eh-row">
                  <span className="eh-date">{fmtDate(s.date, locale)}</span>
                  <span className="num eh-sets">
                    {sets.map((x) =>
                      exercise.isBodyweight ? `${x.reps}` : `${fmt.weight(x.weightKg)}×${x.reps}`,
                    ).join('  ')}
                  </span>
                  <span className="num eh-top">
                    {exercise.isBodyweight
                      ? `${top.reps} best`
                      : `${fmt.weight(estimate1rm(top.weightKg, top.reps))} e1RM`}
                  </span>
                </li>
              )
            })}
        </ul>

        <p className="dim" style={{ fontSize: 'var(--fs-tiny)', marginTop: 'var(--s-3)' }}>
          {last && `Most recent: ${fmtDate(last.date, locale)}, ${last.sets.length} sets.`}
        </p>

        <style>{`
          .eh-list { display: flex; flex-direction: column; }
          .eh-row {
            display: flex; align-items: center; gap: var(--s-3);
            min-height: 38px;
            border-bottom: 1px solid var(--hairline);
          }
          .eh-date {
            width: 52px; flex: none;
            font-size: var(--fs-tiny); color: var(--text-3);
          }
          .eh-sets {
            flex: 1; min-width: 0;
            font-size: var(--fs-tiny); color: var(--text-1);
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          }
          .eh-top { flex: none; font-size: var(--fs-micro); color: var(--kiln-4); }
        `}</style>
      </>
    )
  }
}

/* ========================= create custom exercise ======================== */

function CreateExerciseSheet({ onClose }: { onClose: () => void }) {
  const { t } = useT()
  const { actions } = useStore()
  const toast = useToast()

  const [name, setName] = useState('')
  const [muscle, setMuscle] = useState<MuscleGroup>('chest')
  const [equipment, setEquipment] = useState<Equipment>('dumbbells')
  const [isBodyweight, setIsBodyweight] = useState(false)
  const [instructions, setInstructions] = useState('')
  const [error, setError] = useState<string | null>(null)

  function create() {
    if (!name.trim()) {
      setError('Give the exercise a name.')
      return
    }
    actions.addCustomExercise({
      name: name.trim(),
      muscle,
      equipment,
      isBodyweight,
      cues: instructions
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
      defaultSets: 3,
      defaultRepRange: [8, 12],
    })
    toast.show(`${name.trim()} added to your library`, { tone: 'good' })
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Add an exercise"
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
            Name<span className="field__req" aria-hidden="true">*</span>
          </span>
          <input
            className="input"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError(null)
            }}
            placeholder="Landmine press"
            aria-invalid={!!error}
            maxLength={48}
          />
          {error && (
            <span className="field__error" role="alert">
              {error}
            </span>
          )}
        </label>

        <div className="field">
          <span className="field__label">Main muscle</span>
          <select
            className="select"
            value={muscle}
            onChange={(e) => setMuscle(e.target.value as MuscleGroup)}
          >
            {MUSCLES.map((m) => (
              <option key={m} value={m}>
                {MUSCLE_LABELS[m]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <span className="field__label">Equipment</span>
          <select
            className="select"
            value={equipment}
            onChange={(e) => setEquipment(e.target.value as Equipment)}
          >
            {EQUIPMENT.map((eq) => (
              <option key={eq} value={eq}>
                {EQUIPMENT_LABELS[eq]}
              </option>
            ))}
          </select>
        </div>

        <label className="el-bw">
          <input
            type="checkbox"
            checked={isBodyweight}
            onChange={(e) => setIsBodyweight(e.target.checked)}
          />
          <span>
            <span className="el-bwLabel">Bodyweight only</span>
            <span className="el-bwHint">Logs reps without a weight field</span>
          </span>
        </label>

        <label className="field">
          <span className="field__label">Cues</span>
          <textarea
            className="textarea"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder={'One cue per line\nElbows tucked\nSlow on the way down'}
          />
          <span className="field__hint">Optional. One short idea per line.</span>
        </label>
      </div>

      <style>{`
        .el-bw {
          display: flex; align-items: flex-start; gap: var(--s-3);
          min-height: 48px; cursor: pointer;
        }
        .el-bw input { width: 19px; height: 19px; margin-top: 2px; accent-color: var(--ember); }
        .el-bwLabel { display: block; font-size: var(--fs-sm); font-weight: 600; }
        .el-bwHint { display: block; font-size: var(--fs-tiny); color: var(--text-3); }
      `}</style>
    </Sheet>
  )
}
