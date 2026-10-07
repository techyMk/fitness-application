/* ============================================================================
   Daily check-in. The quick evening pass.

   Everything the app can already see — weight, calories, workout, steps, sleep —
   is SHOWN, not asked. The user only answers what no sensor and no log can know:
   energy, hunger, cravings, mood. That is the minimum-input rule applied to the
   one screen most apps turn into a questionnaire.
   ========================================================================= */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, CheckCircle2, ChevronRight } from 'lucide-react'
import { dayTotals, effectiveHabits } from '../lib/calc'
import { useStore } from '../lib/store'
import { useT } from '../lib/i18n'
import { fmtInt, makeFmt } from '../lib/units'
import { fmtDuration, fmtLongDate, today } from '../lib/date'
import { Scale, ScreenHeader, useToast } from '../components/ui'

export default function CheckIn() {
  const { t, locale } = useT()
  const { data, actions } = useStore()
  const toast = useToast()
  const navigate = useNavigate()
  const profile = data.profile!
  const fmt = useMemo(() => makeFmt(profile.units), [profile.units])
  const date = today()

  const totals = useMemo(() => dayTotals(data, date), [data, date])
  const existing = totals.checkIn

  const [energy, setEnergy] = useState(existing?.energy)
  const [hunger, setHunger] = useState(existing?.hunger)
  const [cravings, setCravings] = useState(existing?.cravings)
  const [mood, setMood] = useState(existing?.mood)
  const [note, setNote] = useState(existing?.note ?? '')

  const habitsDone = effectiveHabits(data, date)
  const activeHabits = data.habits.filter((h) => !h.archived)

  function save() {
    actions.saveCheckIn({ date, energy, hunger, cravings, mood, note: note.trim() || undefined })
    toast.show(t('ci.done'), { tone: 'good' })
    navigate('/', { replace: true })
  }

  return (
    <div className="shell">
      <ScreenHeader title={t('ci.title')} subtitle={fmtLongDate(date, locale)} back={true} />

      <p className="ci-intro">{t('ci.body')}</p>

      {/* ----------------------- what the app already has ------------------ */}
      <div className="eyebrow">Already logged today</div>
      <ul className="card card--flush">
        <LoggedRow
          label={t('weight.title')}
          value={totals.weightKg ? fmt.weightLabel(totals.weightKg) : null}
          to="/weight"
        />
        <div className="divider" />
        <LoggedRow
          label={t('nutri.calories')}
          value={
            totals.calories
              ? `${fmtInt(totals.calories, locale)} / ${fmtInt(profile.targets.calories, locale)} kcal`
              : null
          }
          to="/nutrition"
        />
        <div className="divider" />
        <LoggedRow
          label={t('nutri.protein')}
          value={totals.protein ? `${totals.protein} / ${profile.targets.protein} g` : null}
          to="/nutrition"
        />
        <div className="divider" />
        <LoggedRow
          label={t('home.training')}
          value={totals.workouts ? `${totals.workouts} session${totals.workouts > 1 ? 's' : ''}` : null}
          to="/workout"
        />
        <div className="divider" />
        <LoggedRow
          label={t('cardio.steps')}
          value={totals.steps ? fmtInt(totals.steps, locale) : null}
          to="/cardio"
        />
        <div className="divider" />
        <LoggedRow
          label={t('home.sleep')}
          value={totals.sleepMinutes ? fmtDuration(totals.sleepMinutes) : null}
          to="/sleep"
        />
      </ul>

      {/* ------------------------------ habits ----------------------------- */}
      {activeHabits.length > 0 && (
        <>
          <div className="eyebrow">
            {t('habits.title')}
            <span className="eyebrow__action num">
              {habitsDone.length}/{activeHabits.length}
            </span>
          </div>
          <div className="card">
            <ul className="ci-habits">
              {activeHabits.map((h) => {
                const done = habitsDone.includes(h.id)
                return (
                  <li key={h.id}>
                    <button
                      type="button"
                      className="ci-habit"
                      data-on={done}
                      aria-pressed={done}
                      disabled={!!h.auto}
                      onClick={() => actions.toggleHabit(h.id, date)}
                    >
                      <span className="ci-habitBox" aria-hidden="true">
                        {done && <Check size={13} strokeWidth={3} />}
                      </span>
                      <span className="grow truncate">{h.name}</span>
                      {h.auto && <span className="ci-habitAuto">auto</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      )}

      {/* ----------------------- what only you know ----------------------- */}
      <div className="eyebrow">How did today feel?</div>
      <div className="card stack-4" style={{ display: 'flex', flexDirection: 'column' }}>
        <Scale
          label={t('ci.energy')}
          value={energy}
          onChange={setEnergy}
          lowLabel="Drained"
          highLabel="Firing"
        />
        <Scale
          label={t('ci.hunger')}
          value={hunger}
          onChange={setHunger}
          lowLabel="Not hungry"
          highLabel="Starving"
        />
        <Scale
          label={t('ci.cravings')}
          value={cravings}
          onChange={setCravings}
          lowLabel="None"
          highLabel="Constant"
        />
        <Scale
          label={t('ci.mood')}
          value={mood}
          onChange={setMood}
          lowLabel="Low"
          highLabel="Great"
        />

        <label className="field">
          <span className="field__label">{t('ci.note')}</span>
          <textarea
            className="textarea"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Slept badly, still hit the session."
            maxLength={280}
          />
          <span className="field__hint">Optional. Future you will be glad of the context.</span>
        </label>
      </div>

      <button
        type="button"
        className="btn btn--primary btn--block btn--lg"
        style={{ marginTop: 'var(--s-5)' }}
        onClick={save}
      >
        <CheckCircle2 size={17} aria-hidden="true" />
        {t('ci.save')}
      </button>

      {existing && (
        <p className="ci-already">
          You already checked in today. Saving again updates it.
        </p>
      )}

      <style>{`
        .ci-intro {
          margin-top: var(--s-4);
          font-size: var(--fs-sm); color: var(--text-2);
          max-width: 40ch;
        }
        .ci-habits { display: flex; flex-direction: column; gap: 2px; }
        .ci-habit {
          display: flex; align-items: center; gap: var(--s-3);
          width: 100%; min-height: 44px;
          font-size: var(--fs-sm); color: var(--text-2);
          text-align: left;
        }
        .ci-habit[data-on='true'] { color: var(--text-1); }
        .ci-habit:disabled { cursor: default; }
        .ci-habitBox {
          display: grid; place-items: center;
          width: 20px; height: 20px; flex: none;
          border-radius: 5px;
          border: 1.5px solid var(--hairline-strong);
          color: var(--text-on-ember);
        }
        .ci-habit[data-on='true'] .ci-habitBox {
          background: var(--kiln-4); border-color: var(--kiln-4);
        }
        .ci-habitAuto {
          flex: none;
          font-family: var(--font-display);
          font-size: 9px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--text-3);
        }
        .ci-already {
          margin-top: var(--s-3); text-align: center;
          font-size: var(--fs-tiny); color: var(--text-3);
        }
      `}</style>
    </div>
  )
}

function LoggedRow({
  label,
  value,
  to,
}: {
  label: string
  value: string | null
  to: string
}) {
  const navigate = useNavigate()
  return (
    <li>
      <button type="button" className="lg-row pressable" onClick={() => navigate(to)}>
        <span className="lg-label grow">{label}</span>
        {value ? (
          <span className="num lg-value">{value}</span>
        ) : (
          <span className="lg-missing">Not logged</span>
        )}
        <ChevronRight size={15} className="dim" aria-hidden="true" />
      </button>

      <style>{`
        .lg-row {
          display: flex; align-items: center; gap: var(--s-3);
          width: 100%; min-height: 48px; padding: 0 var(--s-3) 0 var(--s-4);
          text-align: left;
        }
        .lg-label { font-size: var(--fs-sm); color: var(--text-2); }
        .lg-value { flex: none; font-size: var(--fs-sm); font-weight: 600; }
        .lg-missing {
          flex: none;
          font-family: var(--font-display);
          font-size: var(--fs-micro); font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--text-3);
        }
      `}</style>
    </li>
  )
}
