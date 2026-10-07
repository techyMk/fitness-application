/* ============================================================================
   The session logger. The one screen where speed is the whole design.

   The brief's hard rule: logging a set takes a few seconds. So:
   - The weight and reps for the next set are PRE-FILLED from the progression
     suggestion, which itself comes from last session's top set. The common case
     is one tap on "Log set" with no typing at all.
   - Last session's performance sits directly above the inputs, so you never have
     to remember or go look.
   - The rest timer starts itself when a set is logged. No second decision.
   - RPE and notes are there but collapsed. Optional input must not cost space.

   Everything derived from the session (volume, PRs, score) is computed on save,
   not typed.
   ========================================================================= */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Check,
  ChevronDown,
  Flag,
  Plus,
  Search,
  Timer,
  Trash2,
  TrendingUp,
  Trophy,
  X,
} from 'lucide-react'
import type { Exercise, SetEntry } from '../lib/types'
import { estimate1rm, lastPerformance, suggestProgression, type PrHit } from '../lib/calc'
import { useStore } from '../lib/store'
import { useT } from '../lib/i18n'
import { fmtInt, makeFmt, snapToPlate } from '../lib/units'
import { fmtClock, fmtDate, fmtDuration } from '../lib/date'
import { EQUIPMENT_LABELS, MUSCLE_LABELS, SEED_EXERCISES, hasEquipment } from '../data/exercises'
import { ConfirmSheet, Empty, Sheet, Stepper, useToast } from '../components/ui'

const REST_PRESETS = [30, 60, 90, 120, 180]

export default function WorkoutSession() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t, locale } = useT()
  const { data, actions } = useStore()
  const toast = useToast()
  const profile = data.profile!
  const fmt = useMemo(() => makeFmt(profile.units), [profile.units])

  const session = data.sessions.find((s) => s.id === id)

  const allExercises = useMemo(
    () => [...SEED_EXERCISES, ...data.customExercises],
    [data.customExercises],
  )
  const exerciseById = useMemo(
    () => new Map(allExercises.map((e) => [e.id, e])),
    [allExercises],
  )

  /* The exercise list for this session: the plan's list, plus anything added
     mid-session, in first-logged order. */
  const planDay = session?.planId
    ? data.plans.find((p) => p.id === session.planId)?.days.find((d) => d.weekday === session.dayIndex)
    : undefined

  const [extraIds, setExtraIds] = useState<string[]>([])
  const exerciseIds = useMemo(() => {
    const fromPlan = planDay?.exerciseIds ?? []
    const fromSets = session?.sets.map((s) => s.exerciseId) ?? []
    return [...new Set([...fromPlan, ...fromSets, ...extraIds])]
  }, [planDay, session?.sets, extraIds])

  const [addSheet, setAddSheet] = useState(false)
  const [finishSheet, setFinishSheet] = useState(false)
  const [discardSheet, setDiscardSheet] = useState(false)
  const [prs, setPrs] = useState<PrHit[] | null>(null)

  /* ----------------------------- rest timer ------------------------------- */
  const [restTarget, setRestTarget] = useState(90)
  const [restLeft, setRestLeft] = useState<number | null>(null)
  const restRef = useRef<number>()

  useEffect(() => {
    if (restLeft == null) return
    if (restLeft <= 0) {
      setRestLeft(null)
      // A short vibration is the only notification that works with the phone in
      // a pocket and headphones in. Silently ignored where unsupported.
      navigator.vibrate?.([120, 80, 120])
      toast.show('Rest done — next set', { tone: 'good' })
      return
    }
    restRef.current = window.setTimeout(() => setRestLeft((v) => (v == null ? null : v - 1)), 1000)
    return () => window.clearTimeout(restRef.current)
  }, [restLeft, toast])

  /* ------------------------------ elapsed -------------------------------- */
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!session) return
    const tick = () => setElapsed(Math.floor((Date.now() - session.startedAt) / 1000))
    tick()
    const iv = window.setInterval(tick, 1000)
    return () => window.clearInterval(iv)
  }, [session?.startedAt, session])

  if (!session) {
    return (
      <div className="shell">
        <Empty
          title="That session is gone"
          body="It was finished or discarded. Start a new one from the Workout tab."
          action={
            <button type="button" className="btn btn--primary" onClick={() => navigate('/workout')}>
              {t('wk.title')}
            </button>
          }
        />
      </div>
    )
  }

  const doneSets = session.sets.filter((s) => s.done)
  const volume = doneSets.reduce((a, s) => a + s.weightKg * s.reps, 0)

  function finish() {
    const hits = actions.finishSession(session!.id)
    setFinishSheet(false)
    if (hits.length) {
      setPrs(hits)
    } else {
      toast.show(t('wk.complete'), { tone: 'good' })
      navigate('/', { replace: true })
    }
  }

  return (
    <div className="shell ws">
      {/* ----------------------------- top bar ---------------------------- */}
      <header className="ws-bar">
        <button
          type="button"
          className="icon-btn"
          aria-label={t('wk.discard')}
          onClick={() => setDiscardSheet(true)}
        >
          <X size={20} aria-hidden="true" />
        </button>
        <div className="grow">
          <h1 className="ws-title truncate">{session.title}</h1>
          <p className="ws-meta num">
            {fmtClock(elapsed)} · {doneSets.length} sets · {fmtInt(volume, locale)} {fmt.weightUnit}
          </p>
        </div>
        <button
          type="button"
          className="btn btn--primary ws-finish"
          onClick={() => setFinishSheet(true)}
          disabled={doneSets.length === 0}
        >
          <Flag size={15} aria-hidden="true" />
          {t('common.finish')}
        </button>
      </header>

      {/* --------------------------- rest timer --------------------------- */}
      {restLeft != null && (
        <div className="ws-rest" role="status" aria-live="polite">
          <Timer size={16} aria-hidden="true" />
          <span className="num ws-restTime">{fmtClock(restLeft)}</span>
          <div className="ws-restTrack" aria-hidden="true">
            <div
              className="ws-restFill"
              style={{ width: `${(restLeft / restTarget) * 100}%` }}
            />
          </div>
          <button type="button" className="btn btn--quiet" onClick={() => setRestLeft(null)}>
            Skip
          </button>
        </div>
      )}

      {/* ---------------------------- exercises --------------------------- */}
      {exerciseIds.length === 0 ? (
        <div className="card" style={{ marginTop: 'var(--s-4)' }}>
          <Empty
            icon={<Plus size={26} aria-hidden="true" />}
            title="Add your first exercise"
            body="Pick from the library and the app fills in last time's numbers."
            action={
              <button type="button" className="btn btn--primary" onClick={() => setAddSheet(true)}>
                {t('wk.addExercise')}
              </button>
            }
          />
        </div>
      ) : (
        <div className="ws-list">
          {exerciseIds.map((exId) => {
            const exercise = exerciseById.get(exId)
            if (!exercise) return null
            return (
              <ExerciseBlock
                key={exId}
                exercise={exercise}
                sessionId={session.id}
                sets={session.sets.filter((s) => s.exerciseId === exId)}
                onLogged={() => setRestLeft(restTarget)}
              />
            )
          })}
        </div>
      )}

      <button
        type="button"
        className="btn btn--ghost btn--block"
        style={{ marginTop: 'var(--s-4)' }}
        onClick={() => setAddSheet(true)}
      >
        <Plus size={16} aria-hidden="true" />
        {t('wk.addExercise')}
      </button>

      {/* --------------------------- rest presets ------------------------- */}
      <div className="eyebrow">{t('wk.restTimer')}</div>
      <div className="chips">
        {REST_PRESETS.map((sec) => (
          <button
            key={sec}
            type="button"
            className="chip"
            aria-pressed={restTarget === sec}
            onClick={() => {
              setRestTarget(sec)
              setRestLeft(sec)
            }}
          >
            <span className="num">{sec < 60 ? `${sec}s` : `${sec / 60}m`}</span>
          </button>
        ))}
        <CustomRestChip value={restTarget} onPick={(v) => { setRestTarget(v); setRestLeft(v) }} />
      </div>

      {/* ------------------------------ sheets ---------------------------- */}
      <AddExerciseSheet
        open={addSheet}
        onClose={() => setAddSheet(false)}
        exercises={allExercises}
        alreadyIn={exerciseIds}
        onPick={(exId) => {
          setExtraIds((ids) => [...ids, exId])
          setAddSheet(false)
        }}
      />

      <Sheet
        open={finishSheet}
        onClose={() => setFinishSheet(false)}
        title={t('wk.finish')}
        footer={
          <button type="button" className="btn btn--primary btn--block btn--lg" onClick={finish}>
            <Check size={17} aria-hidden="true" />
            {t('wk.finish')}
          </button>
        }
      >
        <div className="grid-2" style={{ marginBottom: 'var(--s-4)' }}>
          <SummaryTile label={t('wk.duration')} value={fmtDuration(elapsed / 60)} />
          <SummaryTile label={t('wk.sets')} value={String(doneSets.length)} />
          <SummaryTile
            label={t('wk.volume')}
            value={`${fmtInt(volume, locale)} ${fmt.weightUnit}`}
          />
          <SummaryTile
            label="Exercises"
            value={String(new Set(doneSets.map((s) => s.exerciseId)).size)}
          />
        </div>
        <label className="field">
          <span className="field__label">{t('wk.notes')}</span>
          <textarea
            className="textarea"
            value={session.note ?? ''}
            onChange={(e) => actions.updateSession(session.id, { note: e.target.value })}
            placeholder="How did it feel? Anything to change next time?"
          />
        </label>
        <p className="field__hint">
          Unticked sets are dropped when you finish — only completed sets are saved.
        </p>
      </Sheet>

      <ConfirmSheet
        open={discardSheet}
        onClose={() => setDiscardSheet(false)}
        onConfirm={() => {
          actions.discardSession(session.id)
          navigate('/workout', { replace: true })
        }}
        title={t('wk.discard')}
        body="Every set in this session will be deleted. Finishing instead keeps what you have logged."
        confirmLabel="Discard"
      />

      {prs && <PrCelebration hits={prs} onClose={() => navigate('/', { replace: true })} />}

      <style>{`
        .ws { padding-bottom: calc(var(--tabbar-h) + var(--safe-b) + var(--s-12)); }
        .ws-bar {
          position: sticky; top: 0; z-index: var(--z-sticky);
          display: flex; align-items: center; gap: var(--s-2);
          margin-inline: calc(var(--s-4) * -1);
          padding: calc(var(--safe-t) + var(--s-3)) var(--s-4) var(--s-3);
          background: var(--ink);
          border-bottom: 1px solid var(--hairline);
        }
        .ws-title {
          font-size: var(--fs-lg); font-weight: 800;
          letter-spacing: var(--tr-display);
        }
        .ws-meta { font-size: var(--fs-tiny); color: var(--text-3); }
        .ws-finish { min-height: 40px; padding: 0 var(--s-3); font-size: var(--fs-tiny); }

        .ws-rest {
          position: sticky; top: 64px; z-index: var(--z-sticky);
          display: flex; align-items: center; gap: var(--s-3);
          margin-top: var(--s-3); padding: var(--s-2) var(--s-3);
          background: var(--ember-soft);
          border: 1px solid var(--ember);
          border-radius: var(--r-md);
          color: var(--ember);
        }
        .ws-restTime { font-size: var(--fs-lg); font-weight: 600; min-width: 48px; }
        .ws-restTrack {
          flex: 1; height: 4px; border-radius: 2px;
          background: var(--surface-inset); overflow: hidden;
        }
        .ws-restFill {
          height: 100%; background: var(--ember);
          transition: width 1s linear;
        }

        .ws-list {
          display: flex; flex-direction: column; gap: var(--s-3);
          margin-top: var(--s-4);
        }
      `}</style>
    </div>
  )
}

/* ========================= one exercise block ============================ */

function ExerciseBlock({
  exercise,
  sessionId,
  sets,
  onLogged,
}: {
  exercise: Exercise
  sessionId: string
  sets: SetEntry[]
  onLogged: () => void
}) {
  const { t, locale } = useT()
  const { data, actions } = useStore()
  const toast = useToast()
  const profile = data.profile!
  const fmt = useMemo(() => makeFmt(profile.units), [profile.units])

  const last = useMemo(
    () => lastPerformance(data.sessions.filter((s) => s.completed), exercise.id),
    [data.sessions, exercise.id],
  )
  const progression = useMemo(
    () =>
      suggestProgression(last, exercise.defaultRepRange, exercise.isBodyweight, exercise.equipment),
    [last, exercise],
  )

  // Draft for the next set. Seeded from the progression suggestion, then carried
  // forward from the previous set in this session — which is what a lifter
  // actually does.
  const prior = sets.at(-1)
  const seedWeight = prior?.weightKg ?? progression.weightKg ?? 0
  const seedReps = prior?.reps ?? progression.repHigh ?? 10

  const [weight, setWeight] = useState(() => Number(fmt.weight(seedWeight, 1)))
  const [reps, setReps] = useState(seedReps)
  const [rpe, setRpe] = useState<number | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [note, setNote] = useState('')

  const step = exercise.isBodyweight ? 1 : profile.units === 'imperial' ? 5 : progression.step || 2.5

  function logSet() {
    const kg = exercise.isBodyweight ? 0 : Number(fmt.toKg(weight).toFixed(2))
    actions.addSet(sessionId, {
      exerciseId: exercise.id,
      setNumber: sets.length + 1,
      weightKg: kg,
      reps,
      rpe: rpe ?? undefined,
      restSec: undefined,
      done: true,
      note: note.trim() || undefined,
    })
    setRpe(null)
    setNote('')
    onLogged()
  }

  const firstTime = progression.rationale === 'first-time'

  const suggestionCopy: Record<typeof progression.rationale, string> = {
    'add-load': t('wk.suggest.addLoad'),
    'add-reps': t('wk.suggest.addReps'),
    hold: t('wk.suggest.hold'),
    deload: t('wk.suggest.deload'),
    'first-time': t('wk.suggest.first'),
  }

  return (
    <section className="card eb" aria-labelledby={`eb-${exercise.id}`}>
      <div className="row row--between">
        <div className="grow">
          <h2 id={`eb-${exercise.id}`} className="eb-name">
            {exercise.name}
          </h2>
          <p className="eb-muscle">
            {MUSCLE_LABELS[exercise.muscle]} · {EQUIPMENT_LABELS[exercise.equipment]}
          </p>
        </div>
      </div>

      {/* ------------------- last time + suggestion ------------------- */}
      <div className="eb-context">
        {last ? (
          <div className="eb-last">
            <span className="t-micro dim">{t('wk.last')}</span>
            <span className="num eb-lastVal">
              {exercise.isBodyweight
                ? `${last.topSet.reps} reps`
                : `${fmt.weight(last.topSet.weightKg)} ${fmt.weightUnit} × ${last.topSet.reps}`}
            </span>
            <span className="eb-lastDate">
              {last.sets.length} sets · {fmtDate(last.date, locale)}
            </span>
          </div>
        ) : (
          <div className="eb-last">
            <span className="t-micro dim">{t('wk.last')}</span>
            <span className="eb-lastDate">First time logging this</span>
          </div>
        )}

        <div className="eb-suggest" data-first={firstTime}>
          <TrendingUp size={13} aria-hidden="true" />
          <div>
            <span className="num eb-suggestVal">
              {firstTime ? 'Start at' : t('wk.suggest')}{' '}
              {exercise.isBodyweight
                ? `${progression.repLow}–${progression.repHigh} reps`
                : `${fmt.weight(progression.weightKg)} ${fmt.weightUnit} × ${progression.repLow}–${progression.repHigh}`}
            </span>
            <span className="eb-suggestWhy">{suggestionCopy[progression.rationale]}</span>
          </div>
        </div>
      </div>

      {/* --------------------------- logged sets --------------------------- */}
      {sets.length > 0 && (
        <ul className="eb-sets">
          {sets.map((s, i) => (
            <li key={s.id} className="eb-set">
              <span className="eb-setNum num">{i + 1}</span>
              <span className="num eb-setVal">
                {exercise.isBodyweight
                  ? `${s.reps} reps`
                  : `${fmt.weight(s.weightKg)} ${fmt.weightUnit} × ${s.reps}`}
              </span>
              {s.rpe != null && <span className="eb-setRpe num">RPE {s.rpe}</span>}
              {!exercise.isBodyweight && s.weightKg > 0 && (
                <span className="eb-set1rm num">
                  {fmt.weight(estimate1rm(s.weightKg, s.reps))} e1RM
                </span>
              )}
              <button
                type="button"
                className="eb-setDel"
                aria-label={`Remove set ${i + 1}`}
                onClick={() => {
                  const removed = s
                  actions.removeSet(sessionId, s.id)
                  toast.show('Set removed', {
                    action: {
                      label: t('common.undo'),
                      run: () =>
                        actions.addSet(sessionId, {
                          exerciseId: removed.exerciseId,
                          setNumber: removed.setNumber,
                          weightKg: removed.weightKg,
                          reps: removed.reps,
                          rpe: removed.rpe,
                          done: true,
                          note: removed.note,
                        }),
                    },
                  })
                }}
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* ------------------------- the logging row ------------------------- */}
      <div className="eb-entry">
        {!exercise.isBodyweight && (
          <Stepper
            label={t('wk.weight')}
            unit={fmt.weightUnit}
            decimals={1}
            step={step}
            value={weight}
            onChange={setWeight}
            min={0}
            max={999}
          />
        )}
        <Stepper
          label={t('wk.reps')}
          value={reps}
          onChange={setReps}
          min={1}
          max={200}
        />
      </div>

      <button type="button" className="btn btn--primary btn--block" onClick={logSet}>
        <Check size={16} aria-hidden="true" />
        Log set {sets.length + 1}
      </button>

      {/* --------------------------- optional bits ------------------------ */}
      <button
        type="button"
        className="eb-adv"
        aria-expanded={showAdvanced}
        onClick={() => setShowAdvanced((v) => !v)}
      >
        <ChevronDown
          size={14}
          aria-hidden="true"
          style={{ transform: showAdvanced ? 'rotate(180deg)' : undefined, transition: 'transform var(--t-fast)' }}
        />
        {t('wk.rpe')} and {t('wk.notes').toLowerCase()}
      </button>

      {showAdvanced && (
        <div className="eb-advBody">
          <fieldset className="eb-rpe">
            <legend className="t-micro dim">
              {t('wk.rpe')} — how hard was that set?
            </legend>
            <div className="eb-rpeRow" role="radiogroup" aria-label={t('wk.rpe')}>
              {[6, 7, 8, 9, 10].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rpe === n}
                  className="eb-rpeBtn num"
                  data-on={rpe === n}
                  onClick={() => setRpe(rpe === n ? null : n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="field__hint">6 = easy, 10 = nothing left. Optional, but it sharpens the next suggestion.</p>
          </fieldset>

          <label className="field">
            <span className="field__label">{t('wk.notes')}</span>
            <input
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Left shoulder tight"
              maxLength={80}
            />
          </label>
        </div>
      )}

      <style>{`
        .eb-name {
          font-size: var(--fs-lg); font-weight: 700;
          letter-spacing: var(--tr-display);
        }
        .eb-muscle {
          font-family: var(--font-display);
          font-size: var(--fs-micro); font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--text-3); margin-top: 2px;
        }

        .eb-context {
          display: flex; flex-direction: column; gap: var(--s-2);
          margin: var(--s-4) 0;
        }
        .eb-last {
          display: flex; align-items: baseline; gap: var(--s-2);
          flex-wrap: wrap;
        }
        .eb-lastVal { font-size: var(--fs-base); font-weight: 600; }
        .eb-lastDate { font-size: var(--fs-tiny); color: var(--text-3); }
        .eb-suggest {
          display: flex; align-items: flex-start; gap: var(--s-2);
          padding: var(--s-2) var(--s-3);
          background: var(--surface-2);
          border-left: 2px solid var(--kiln-4);
          border-radius: 0 var(--r-sm) var(--r-sm) 0;
          color: var(--kiln-4);
        }
        /* A first-time starting point is not a recommendation — it is an
           opening guess with no data behind it, so it is drawn quietly. */
        .eb-suggest[data-first='true'] {
          border-left-color: var(--hairline-strong);
          color: var(--text-2);
        }
        .eb-suggestVal {
          display: block;
          font-size: var(--fs-sm); font-weight: 600;
        }
        .eb-suggestWhy {
          display: block;
          font-family: var(--font-body);
          font-size: var(--fs-tiny); color: var(--text-3);
          margin-top: 1px;
        }

        .eb-sets {
          display: flex; flex-direction: column; gap: 1px;
          margin-bottom: var(--s-4);
          border-top: 1px solid var(--hairline);
        }
        .eb-set {
          display: flex; align-items: center; gap: var(--s-3);
          min-height: 40px;
          border-bottom: 1px solid var(--hairline);
        }
        .eb-setNum {
          width: 20px; flex: none;
          font-size: var(--fs-tiny); color: var(--text-3);
        }
        .eb-setVal { flex: 1; font-size: var(--fs-sm); font-weight: 500; }
        .eb-setRpe, .eb-set1rm {
          flex: none; font-size: var(--fs-micro); color: var(--text-3);
        }
        .eb-setDel {
          display: grid; place-items: center;
          width: 36px; height: 36px; flex: none;
          border-radius: var(--r-sm);
          color: var(--text-3);
        }
        .eb-setDel:hover { background: var(--critical-soft); color: var(--critical); }

        .eb-entry {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: var(--s-3); margin-bottom: var(--s-3);
        }
        .eb-entry:has(> :only-child) { grid-template-columns: 1fr; }

        .eb-adv {
          display: flex; align-items: center; gap: 5px;
          width: 100%; min-height: 40px; margin-top: var(--s-2);
          font-family: var(--font-display);
          font-size: var(--fs-micro); font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--text-3);
        }
        .eb-adv:hover { color: var(--text-1); }
        .eb-advBody {
          display: flex; flex-direction: column; gap: var(--s-4);
          padding-top: var(--s-2);
        }
        .eb-rpe { border: 0; padding: 0; margin: 0; }
        .eb-rpeRow { display: flex; gap: var(--s-2); margin-top: var(--s-2); }
        .eb-rpeBtn {
          flex: 1; height: 44px;
          border-radius: var(--r-sm);
          background: var(--surface-2);
          border: 1px solid var(--hairline);
          color: var(--text-2);
          font-size: var(--fs-sm); font-weight: 500;
        }
        .eb-rpeBtn[data-on='true'] {
          background: var(--ember-soft); border-color: var(--ember); color: var(--ember);
        }
      `}</style>
    </section>
  )
}

/* ========================= add-exercise sheet ============================ */

function AddExerciseSheet({
  open,
  onClose,
  exercises,
  alreadyIn,
  onPick,
}: {
  open: boolean
  onClose: () => void
  exercises: Exercise[]
  alreadyIn: string[]
  onPick: (id: string) => void
}) {
  const { t } = useT()
  const { data } = useStore()
  const [query, setQuery] = useState('')
  const [onlyMine, setOnlyMine] = useState(true)
  const equipment = data.profile!.equipment

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return exercises
      .filter((e) => !alreadyIn.includes(e.id))
      .filter((e) => (onlyMine ? hasEquipment(equipment, e.equipment) : true))
      .filter(
        (e) =>
          !q ||
          e.name.toLowerCase().includes(q) ||
          MUSCLE_LABELS[e.muscle].toLowerCase().includes(q),
      )
      .slice(0, 60)
  }, [exercises, alreadyIn, onlyMine, equipment, query])

  return (
    <Sheet open={open} onClose={onClose} title={t('wk.addExercise')} tall>
      <div className="aes-search">
        <Search size={16} aria-hidden="true" />
        <input
          className="aes-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or muscle"
          aria-label={t('common.search')}
          type="search"
        />
      </div>

      <label className="aes-filter">
        <input
          type="checkbox"
          checked={onlyMine}
          onChange={(e) => setOnlyMine(e.target.checked)}
        />
        <span>Only what I can train with</span>
      </label>

      {results.length === 0 ? (
        <Empty title="Nothing matches" body="Try a shorter word, or turn off the equipment filter." />
      ) : (
        <ul className="aes-list">
          {results.map((e) => (
            <li key={e.id}>
              <button type="button" className="aes-row pressable" onClick={() => onPick(e.id)}>
                <span className="grow">
                  <span className="aes-name">{e.name}</span>
                  <span className="aes-meta">
                    {MUSCLE_LABELS[e.muscle]} · {EQUIPMENT_LABELS[e.equipment]}
                  </span>
                </span>
                <Plus size={17} className="dim" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <style>{`
        .aes-search {
          display: flex; align-items: center; gap: var(--s-2);
          padding: 0 var(--s-3);
          background: var(--surface-2);
          border: 1px solid var(--hairline);
          border-radius: var(--r-md);
          color: var(--text-3);
        }
        .aes-input {
          flex: 1; height: 48px;
          background: transparent; border: 0;
          font-size: var(--fs-base);
        }
        .aes-input:focus { outline: none; }
        .aes-filter {
          display: flex; align-items: center; gap: var(--s-2);
          min-height: 44px; margin-top: var(--s-2);
          font-size: var(--fs-tiny); color: var(--text-2);
          cursor: pointer;
        }
        .aes-filter input { width: 17px; height: 17px; accent-color: var(--ember); }
        .aes-list { display: flex; flex-direction: column; }
        .aes-row {
          display: flex; align-items: center; gap: var(--s-3);
          width: 100%; min-height: 56px; padding: var(--s-2);
          border-bottom: 1px solid var(--hairline);
          border-radius: var(--r-sm);
          text-align: left;
        }
        .aes-name { display: block; font-size: var(--fs-sm); font-weight: 600; }
        .aes-meta {
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

/* ============================ PR celebration ============================= */

function PrCelebration({ hits, onClose }: { hits: PrHit[]; onClose: () => void }) {
  const { data } = useStore()
  const { t } = useT()
  const profile = data.profile!
  const fmt = makeFmt(profile.units)
  const nameOf = (id: string) =>
    [...SEED_EXERCISES, ...data.customExercises].find((e) => e.id === id)?.name ?? id

  return (
    <Sheet
      open
      onClose={onClose}
      title={t('pr.new')}
      footer={
        <button type="button" className="btn btn--primary btn--block btn--lg" onClick={onClose}>
          {t('common.done')}
        </button>
      }
    >
      <div className="prc-hero">
        <Trophy size={30} aria-hidden="true" />
        <p className="prc-title">{t('wk.complete')}</p>
        <p className="prc-sub">
          {hits.length} new {hits.length === 1 ? 'record' : 'records'} in that session.
        </p>
      </div>

      <ul className="prc-list">
        {hits.map((h, i) => (
          <li key={i} className="prc-row">
            <span className="grow">
              <span className="prc-name">{nameOf(h.exerciseId)}</span>
              <span className="prc-kind">
                {h.kind === 'weight'
                  ? t('pr.heaviest')
                  : h.kind === 'reps'
                    ? t('pr.bestReps')
                    : t('pr.best1rm')}
              </span>
            </span>
            <span className="num prc-val">
              {h.kind === 'reps'
                ? `${h.value} reps`
                : `${fmt.weight(h.value)} ${fmt.weightUnit}`}
              {h.previous > 0 && (
                <span className="prc-prev">
                  {' '}
                  from {h.kind === 'reps' ? h.previous : fmt.weight(h.previous)}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <style>{`
        .prc-hero {
          display: flex; flex-direction: column; align-items: center;
          gap: var(--s-2); padding: var(--s-5) 0 var(--s-6);
          color: var(--kiln-5);
        }
        .prc-title {
          font-family: var(--font-display);
          font-size: var(--fs-xl); font-weight: 800;
          letter-spacing: var(--tr-display);
          color: var(--text-1);
        }
        .prc-sub { font-size: var(--fs-sm); color: var(--text-2); }
        .prc-list { display: flex; flex-direction: column; }
        .prc-row {
          display: flex; align-items: center; gap: var(--s-3);
          min-height: 56px;
          border-top: 1px solid var(--hairline);
        }
        .prc-name { display: block; font-size: var(--fs-sm); font-weight: 600; }
        .prc-kind {
          display: block;
          font-family: var(--font-display);
          font-size: var(--fs-micro); font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--text-3);
        }
        .prc-val {
          flex: none; font-size: var(--fs-sm); font-weight: 600;
          color: var(--kiln-5);
        }
        .prc-prev {
          font-size: var(--fs-micro); color: var(--text-3); font-weight: 400;
        }
      `}</style>
    </Sheet>
  )
}

/* --------------------------- small components ---------------------------- */

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card card--inset" style={{ padding: 'var(--s-3)' }}>
      <span className="t-micro dim">{label}</span>
      <p className="num" style={{ fontSize: 'var(--fs-lg)', fontWeight: 600, marginTop: 2 }}>
        {value}
      </p>
    </div>
  )
}

function CustomRestChip({ value, onPick }: { value: number; onPick: (v: number) => void }) {
  const [open, setOpen] = useState(false)
  const [secs, setSecs] = useState(value)
  const custom = !REST_PRESETS.includes(value)

  return (
    <>
      <button type="button" className="chip" aria-pressed={custom} onClick={() => setOpen(true)}>
        {custom ? <span className="num">{secs}s</span> : 'Custom'}
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Custom rest"
        footer={
          <button
            type="button"
            className="btn btn--primary btn--block btn--lg"
            onClick={() => {
              onPick(secs)
              setOpen(false)
            }}
          >
            Start timer
          </button>
        }
      >
        <Stepper
          label="Rest"
          unit="seconds"
          step={15}
          min={15}
          max={600}
          value={secs}
          onChange={setSecs}
        />
      </Sheet>
    </>
  )
}

/* `snapToPlate` is re-exported for the plan builder, which suggests starting
   loads in plate-friendly increments. */
export { snapToPlate }
