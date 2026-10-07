/* ============================================================================
   Onboarding. Eight short steps, one question per screen, because a single long
   form is the thing the brief explicitly says to avoid.

   Two rules shape it:
   - Nothing here is a dead end. Every step can be answered with a tap; typing is
     only required for name, age, height and the two weights.
   - The last step shows the *calculated* targets and lets the user overwrite
     them. Editing one sets `targetsCustomised`, which stops later profile edits
     silently recalculating a number the user chose on purpose.
   ========================================================================= */

import { useMemo, useState } from 'react'
import { ArrowRight, Check, ChevronLeft, Flame } from 'lucide-react'
import type {
  ActivityLevel,
  Equipment,
  Experience,
  GoalType,
  Lang,
  Profile,
  Sex,
  Targets,
  Units,
} from '../lib/types'
import { suggestTargets } from '../lib/calc'
import { useStore } from '../lib/store'
import { useT, LANGUAGES } from '../lib/i18n'
import { makeFmt } from '../lib/units'
import { Stepper } from '../components/ui'

const GOALS: GoalType[] = ['fat-loss', 'muscle-gain', 'recomp', 'maintenance', 'general', 'custom']
const ACTIVITIES: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'very', 'extreme']
const EXPERIENCES: Experience[] = ['beginner', 'intermediate', 'advanced']
const EQUIPMENT: Equipment[] = [
  'full-gym',
  'dumbbells',
  'barbells',
  'machines',
  'cables',
  'bands',
  'bodyweight',
]
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const STEPS = ['you', 'weight', 'goal', 'activity', 'experience', 'equipment', 'days', 'targets'] as const
type Step = (typeof STEPS)[number]

interface Draft {
  name: string
  age: number
  sex: Sex
  heightCm: number
  startWeightKg: number
  targetWeightKg: number
  goal: GoalType
  activity: ActivityLevel
  experience: Experience
  equipment: Equipment[]
  workoutDays: number[]
  units: Units
  lang: Lang
}

export function Onboarding() {
  const { t } = useT()
  const { actions } = useStore()
  const [started, setStarted] = useState(false)
  const [index, setIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const [draft, setDraft] = useState<Draft>({
    name: '',
    age: 28,
    sex: 'unspecified',
    heightCm: 170,
    startWeightKg: 75,
    targetWeightKg: 70,
    goal: 'fat-loss',
    activity: 'light',
    experience: 'beginner',
    equipment: ['full-gym'],
    workoutDays: [1, 2, 3, 4, 5],
    units: 'metric',
    lang: 'en',
  })

  const fmt = useMemo(() => makeFmt(draft.units), [draft.units])
  const suggested = useMemo(() => suggestTargets(draft, draft.startWeightKg), [draft])
  const [targets, setTargets] = useState<Targets | null>(null)
  const [customised, setCustomised] = useState(false)

  const effectiveTargets = targets ?? suggested
  const step = STEPS[index]

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  function validate(s: Step): string | null {
    if (s === 'you') {
      if (!draft.name.trim()) return 'Add a name so the app can greet you properly.'
      if (draft.age < 13 || draft.age > 100) return 'Enter an age between 13 and 100.'
      if (draft.heightCm < 120 || draft.heightCm > 230) return 'That height looks off — check it.'
    }
    if (s === 'weight') {
      if (draft.startWeightKg < 30 || draft.startWeightKg > 300) {
        return 'Enter a current weight between 30 and 300 kg.'
      }
      if (draft.targetWeightKg < 30 || draft.targetWeightKg > 300) {
        return 'Enter a target weight between 30 and 300 kg.'
      }
    }
    if (s === 'equipment' && draft.equipment.length === 0) {
      return 'Pick at least one. Bodyweight is a valid answer.'
    }
    return null
  }

  function next() {
    const problem = validate(step)
    setError(problem)
    if (problem) return
    if (index < STEPS.length - 1) setIndex(index + 1)
  }

  function finish() {
    const profile: Omit<Profile, 'id' | 'createdAt'> = {
      ...draft,
      theme: 'dark',
      targets: effectiveTargets,
      targetsCustomised: customised,
      coaching: 'balanced',
    }
    // The six-day split is the programme written in the brief, so a new user
    // lands on something real rather than an empty week.
    actions.completeOnboarding(profile, 'plan-ppl6')
  }

  if (!started) {
    return (
      <div className="onb onb--hero">
        <div className="onb__heroArt" aria-hidden="true">
          <svg viewBox="0 0 200 200" width="180" height="180">
            {/* a cold ring with one hot arc: the before-and-after in one mark */}
            <circle cx="100" cy="100" r="76" fill="none" stroke="var(--surface-2)" strokeWidth="18" />
            <path
              d="M100 24a76 76 0 0 1 65.8 114"
              fill="none"
              stroke="var(--kiln-3)"
              strokeWidth="18"
              strokeLinecap="round"
            />
            <path
              d="M100 24a76 76 0 0 1 38 10.2"
              fill="none"
              stroke="var(--kiln-5)"
              strokeWidth="18"
              strokeLinecap="round"
            />
            <circle cx="100" cy="100" r="26" fill="var(--ember-soft)" stroke="var(--ember-line)" />
            <g transform="translate(100 100)">
              <path
                d="M0-11c3 4 6 6 6 11a6 6 0 0 1-12 0c0-5 3-7 6-11z"
                fill="var(--ember)"
              />
            </g>
          </svg>
        </div>

        <h1 className="onb__heroTitle">{t('onb.welcome.title')}</h1>
        <p className="onb__heroBody">{t('onb.welcome.body')}</p>

        <button type="button" className="btn btn--primary btn--lg btn--block" onClick={() => setStarted(true)}>
          {t('onb.welcome.cta')}
          <ArrowRight size={17} aria-hidden="true" />
        </button>

        <div className="onb__langs">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              className="chip"
              aria-pressed={draft.lang === l.code}
              onClick={() => set('lang', l.code)}
            >
              {l.native}
            </button>
          ))}
        </div>

        <OnboardingStyles />
      </div>
    )
  }

  return (
    <div className="onb">
      <header className="onb__head">
        {index > 0 ? (
          <button
            type="button"
            className="icon-btn"
            aria-label={t('common.back')}
            onClick={() => {
              setError(null)
              setIndex(index - 1)
            }}
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
        ) : (
          <span style={{ width: 44 }} />
        )}
        <div className="onb__progress" role="progressbar" aria-valuenow={index + 1} aria-valuemin={1} aria-valuemax={STEPS.length} aria-label={t('onb.step', { n: index + 1, total: STEPS.length })}>
          {STEPS.map((s, i) => (
            <span key={s} className="onb__pip" data-on={i <= index} />
          ))}
        </div>
        <span className="onb__count num">
          {index + 1}/{STEPS.length}
        </span>
      </header>

      <main className="onb__body" key={step}>
        {step === 'you' && (
          <StepShell title={t('onb.you.title')} body={t('onb.you.body')}>
            <label className="field">
              <span className="field__label">
                {t('onb.name')}
                <span className="field__req" aria-hidden="true">*</span>
              </span>
              <input
                className="input"
                value={draft.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Your name"
                autoComplete="given-name"
                maxLength={32}
              />
            </label>

            <div className="grid-2">
              <Stepper label={t('onb.age')} value={draft.age} onChange={(v) => set('age', v)} min={13} max={100} />
              <Stepper
                label={t('onb.height')}
                unit={fmt.heightUnit}
                value={Math.round(draft.units === 'imperial' ? draft.heightCm / 2.54 : draft.heightCm)}
                onChange={(v) => set('heightCm', Math.round(fmt.toCm(v)))}
                min={draft.units === 'imperial' ? 47 : 120}
                max={draft.units === 'imperial' ? 91 : 230}
              />
            </div>

            <fieldset className="onb__fieldset">
              <legend className="field__label">{t('onb.sex')}</legend>
              <p className="field__hint" style={{ marginTop: 0, marginBottom: 'var(--s-2)' }}>
                Only used in the calorie formula. Pick “Prefer not to say” and the app uses a midpoint.
              </p>
              <div className="chips">
                {(
                  [
                    ['male', 'Male'],
                    ['female', 'Female'],
                    ['unspecified', 'Prefer not to say'],
                  ] as Array<[Sex, string]>
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className="chip"
                    aria-pressed={draft.sex === value}
                    onClick={() => set('sex', value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
          </StepShell>
        )}

        {step === 'weight' && (
          <StepShell title={t('onb.weight.title')}>
            <div className="stack-4">
              <Stepper
                label={t('onb.weight.current')}
                unit={fmt.weightUnit}
                decimals={1}
                step={0.5}
                value={Number(fmt.weight(draft.startWeightKg))}
                onChange={(v) => set('startWeightKg', Number(fmt.toKg(v).toFixed(2)))}
                min={draft.units === 'imperial' ? 66 : 30}
                max={draft.units === 'imperial' ? 660 : 300}
              />
              <Stepper
                label={t('onb.weight.target')}
                unit={fmt.weightUnit}
                decimals={1}
                step={0.5}
                value={Number(fmt.weight(draft.targetWeightKg))}
                onChange={(v) => set('targetWeightKg', Number(fmt.toKg(v).toFixed(2)))}
                min={draft.units === 'imperial' ? 66 : 30}
                max={draft.units === 'imperial' ? 660 : 300}
              />

              <div className="onb__delta card card--inset">
                <span className="t-micro dim">The gap</span>
                <span className="num onb__deltaVal">
                  {fmt.weightLabel(Math.abs(draft.startWeightKg - draft.targetWeightKg))}
                </span>
                <span className="dim" style={{ fontSize: 'var(--fs-tiny)' }}>
                  {draft.startWeightKg > draft.targetWeightKg ? 'to lose' : draft.startWeightKg < draft.targetWeightKg ? 'to gain' : 'you are at your target'}
                </span>
              </div>
            </div>
          </StepShell>
        )}

        {step === 'goal' && (
          <StepShell title={t('onb.goal.title')}>
            <OptionList
              options={GOALS.map((g) => ({
                value: g,
                label: t(`goal.${g}`),
                hint: t(`goal.${g}.hint`),
              }))}
              value={draft.goal}
              onChange={(v) => set('goal', v)}
            />
          </StepShell>
        )}

        {step === 'activity' && (
          <StepShell title={t('onb.activity.title')} body={t('onb.activity.body')}>
            <OptionList
              options={ACTIVITIES.map((a) => ({
                value: a,
                label: t(`activity.${a}`),
                hint: t(`activity.${a}.hint`),
              }))}
              value={draft.activity}
              onChange={(v) => set('activity', v)}
            />
          </StepShell>
        )}

        {step === 'experience' && (
          <StepShell title={t('onb.experience.title')}>
            <OptionList
              options={EXPERIENCES.map((e) => ({
                value: e,
                label: t(`exp.${e}`),
                hint: t(`exp.${e}.hint`),
              }))}
              value={draft.experience}
              onChange={(v) => set('experience', v)}
            />
          </StepShell>
        )}

        {step === 'equipment' && (
          <StepShell title={t('onb.equipment.title')} body={t('onb.equipment.body')}>
            <div className="chips">
              {EQUIPMENT.map((e) => {
                const on = draft.equipment.includes(e)
                return (
                  <button
                    key={e}
                    type="button"
                    className="chip"
                    aria-pressed={on}
                    onClick={() =>
                      set(
                        'equipment',
                        on ? draft.equipment.filter((x) => x !== e) : [...draft.equipment, e],
                      )
                    }
                  >
                    {on && <Check size={14} aria-hidden="true" />}
                    {t(`equip.${e}`)}
                  </button>
                )
              })}
            </div>
            <p className="field__hint">
              The exercise library filters to what you pick, so you never scroll past lifts you
              cannot do.
            </p>
          </StepShell>
        )}

        {step === 'days' && (
          <StepShell title={t('onb.days.title')}>
            <div className="onb__days" role="group" aria-label={t('onb.days.title')}>
              {WEEKDAYS.map((d, i) => {
                const on = draft.workoutDays.includes(i)
                return (
                  <button
                    key={i}
                    type="button"
                    className="onb__day"
                    data-on={on}
                    aria-pressed={on}
                    aria-label={WEEKDAY_NAMES[i]}
                    onClick={() =>
                      set(
                        'workoutDays',
                        on
                          ? draft.workoutDays.filter((x) => x !== i)
                          : [...draft.workoutDays, i].sort(),
                      )
                    }
                  >
                    {d}
                  </button>
                )
              })}
            </div>
            <p className="field__hint">
              {draft.workoutDays.length} training {draft.workoutDays.length === 1 ? 'day' : 'days'} a
              week. You can change this any time without losing history.
            </p>

            <div className="divider" style={{ margin: 'var(--s-6) 0 var(--s-4)' }} />

            <fieldset className="onb__fieldset">
              <legend className="field__label">{t('set.units')}</legend>
              <div className="segmented" style={{ marginTop: 'var(--s-2)' }}>
                {(
                  [
                    ['metric', 'kg · km · cm'],
                    ['imperial', 'lb · mi · in'],
                  ] as Array<[Units, string]>
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-selected={draft.units === value}
                    onClick={() => set('units', value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
          </StepShell>
        )}

        {step === 'targets' && (
          <StepShell title={t('onb.targets.title')} body={t('onb.targets.body')}>
            <div className="stack-4">
              <div className="grid-2">
                <Stepper
                  label={t('nutri.calories')}
                  unit="kcal"
                  step={50}
                  min={1200}
                  max={6000}
                  value={effectiveTargets.calories}
                  onChange={(v) => {
                    setTargets({ ...effectiveTargets, calories: v })
                    setCustomised(true)
                  }}
                />
                <Stepper
                  label={t('nutri.protein')}
                  unit="g"
                  step={5}
                  min={40}
                  max={400}
                  value={effectiveTargets.protein}
                  onChange={(v) => {
                    setTargets({ ...effectiveTargets, protein: v })
                    setCustomised(true)
                  }}
                />
                <Stepper
                  label={t('cardio.steps')}
                  step={500}
                  min={2000}
                  max={30000}
                  value={effectiveTargets.steps}
                  onChange={(v) => {
                    setTargets({ ...effectiveTargets, steps: v })
                    setCustomised(true)
                  }}
                />
                <Stepper
                  label={t('sleep.title')}
                  unit="h"
                  step={0.5}
                  decimals={1}
                  min={4}
                  max={12}
                  value={effectiveTargets.sleepHours}
                  onChange={(v) => {
                    setTargets({ ...effectiveTargets, sleepHours: v })
                    setCustomised(true)
                  }}
                />
              </div>

              <div className="card card--inset onb__macros">
                <span className="t-micro dim">Also set for you</span>
                <div className="row row--between" style={{ marginTop: 'var(--s-2)' }}>
                  <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
                    {t('nutri.carbs')} · {t('nutri.fat')}
                  </span>
                  <span className="num" style={{ fontSize: 'var(--fs-sm)' }}>
                    {effectiveTargets.carbs} g · {effectiveTargets.fat} g
                  </span>
                </div>
                <div className="row row--between" style={{ marginTop: 'var(--s-1)' }}>
                  <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
                    Training days a week
                  </span>
                  <span className="num" style={{ fontSize: 'var(--fs-sm)' }}>
                    {effectiveTargets.workoutsPerWeek}
                  </span>
                </div>
              </div>

              {customised && (
                <button
                  type="button"
                  className="btn btn--quiet"
                  onClick={() => {
                    setTargets(null)
                    setCustomised(false)
                  }}
                >
                  {t('onb.targets.recalc')}
                </button>
              )}
            </div>
          </StepShell>
        )}

        {error && (
          <p className="onb__error" role="alert">
            {error}
          </p>
        )}
      </main>

      <footer className="onb__foot">
        {step === 'targets' ? (
          <button type="button" className="btn btn--primary btn--lg btn--block" onClick={finish}>
            <Flame size={17} aria-hidden="true" />
            {t('onb.targets.cta')}
          </button>
        ) : (
          <button type="button" className="btn btn--primary btn--lg btn--block" onClick={next}>
            {t('common.next')}
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        )}
      </footer>

      <OnboardingStyles />
    </div>
  )
}

/* ------------------------------- step pieces ------------------------------ */

function StepShell({
  title,
  body,
  children,
}: {
  title: string
  body?: string
  children: React.ReactNode
}) {
  return (
    <div className="onb__step rise">
      <h2 className="onb__title">{title}</h2>
      {body && <p className="onb__sub">{body}</p>}
      <div className="onb__fields">{children}</div>
    </div>
  )
}

function OptionList<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string; hint?: string }>
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="onb__opts" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className="onb__opt"
          data-on={value === o.value}
          onClick={() => onChange(o.value)}
        >
          <span className="onb__optText">
            <span className="onb__optLabel">{o.label}</span>
            {o.hint && <span className="onb__optHint">{o.hint}</span>}
          </span>
          <span className="onb__optMark" aria-hidden="true">
            {value === o.value && <Check size={14} strokeWidth={3} />}
          </span>
        </button>
      ))}
    </div>
  )
}

function OnboardingStyles() {
  return (
    <style>{`
      .onb {
        min-height: 100dvh;
        display: flex; flex-direction: column;
        max-width: var(--col); margin-inline: auto;
        padding: 0 var(--s-5);
      }
      .onb--hero {
        justify-content: center; align-items: center;
        text-align: center; gap: var(--s-3);
        padding-block: var(--s-10);
      }
      .onb__heroArt { margin-bottom: var(--s-2); }
      .onb__heroTitle {
        font-size: var(--fs-2xl); font-weight: 800;
        letter-spacing: var(--tr-display); line-height: 1.12;
        max-width: 20ch;
      }
      .onb__heroBody {
        font-size: var(--fs-sm); color: var(--text-2);
        max-width: 36ch; margin-bottom: var(--s-4);
      }
      .onb--hero .btn { max-width: 22rem; }
      .onb__langs { display: flex; gap: var(--s-2); margin-top: var(--s-4); }

      .onb__head {
        display: flex; align-items: center; gap: var(--s-3);
        padding-top: calc(var(--safe-t) + var(--s-3));
        padding-bottom: var(--s-4);
      }
      .onb__progress { display: flex; gap: 4px; flex: 1; }
      .onb__pip {
        flex: 1; height: 3px; border-radius: 2px;
        background: var(--surface-3);
        transition: background-color var(--t-mid) var(--ease-out);
      }
      .onb__pip[data-on='true'] { background: var(--ember); }
      .onb__count { font-size: var(--fs-tiny); color: var(--text-3); }

      .onb__body { flex: 1; }
      .onb__step { display: flex; flex-direction: column; }
      .onb__title {
        font-size: var(--fs-2xl); font-weight: 800;
        letter-spacing: var(--tr-display); line-height: 1.14;
      }
      .onb__sub {
        margin-top: var(--s-2);
        font-size: var(--fs-sm); color: var(--text-2);
        max-width: 40ch;
      }
      .onb__fields { margin-top: var(--s-6); display: flex; flex-direction: column; gap: var(--s-5); }
      .onb__fieldset { border: 0; padding: 0; margin: 0; }

      .onb__opts { display: flex; flex-direction: column; gap: var(--s-2); }
      .onb__opt {
        display: flex; align-items: center; gap: var(--s-3);
        min-height: 62px; padding: var(--s-3) var(--s-4);
        background: var(--surface-1);
        border: 1px solid var(--hairline);
        border-radius: var(--r-md);
        text-align: left;
        transition:
          background-color var(--t-fast) var(--ease-out),
          border-color var(--t-fast) var(--ease-out);
      }
      .onb__opt:hover { border-color: var(--hairline-strong); }
      .onb__opt[data-on='true'] {
        background: var(--ember-soft); border-color: var(--ember);
      }
      .onb__optText { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
      .onb__optLabel {
        font-family: var(--font-display);
        font-size: var(--fs-base); font-weight: 700;
        letter-spacing: -0.01em;
      }
      .onb__opt[data-on='true'] .onb__optLabel { color: var(--ember); }
      .onb__optHint { font-size: var(--fs-tiny); color: var(--text-3); }
      .onb__optMark {
        display: grid; place-items: center;
        width: 22px; height: 22px; flex: none;
        border-radius: 50%;
        border: 1.5px solid var(--hairline-strong);
        color: var(--text-on-ember);
      }
      .onb__opt[data-on='true'] .onb__optMark {
        background: var(--ember); border-color: var(--ember);
      }

      .onb__days { display: flex; gap: var(--s-2); }
      .onb__day {
        flex: 1; height: 54px;
        border-radius: var(--r-md);
        background: var(--surface-2);
        border: 1px solid var(--hairline);
        color: var(--text-2);
        font-family: var(--font-display);
        font-size: var(--fs-sm); font-weight: 700;
        transition:
          background-color var(--t-fast) var(--ease-out),
          border-color var(--t-fast) var(--ease-out),
          color var(--t-fast) var(--ease-out);
      }
      .onb__day[data-on='true'] {
        background: var(--ember-soft); border-color: var(--ember); color: var(--ember);
      }

      .onb__delta {
        display: flex; flex-direction: column; align-items: center; gap: 2px;
        padding: var(--s-4);
      }
      .onb__deltaVal {
        font-size: var(--fs-2xl); font-weight: 600; color: var(--ember);
      }
      .onb__macros { padding: var(--s-3) var(--s-4); }

      .onb__error {
        display: flex; gap: var(--s-2);
        margin-top: var(--s-4); padding: var(--s-3);
        background: var(--critical-soft);
        border: 1px solid var(--critical);
        border-radius: var(--r-md);
        font-size: var(--fs-sm); color: var(--critical);
      }

      .onb__foot {
        position: sticky; bottom: 0;
        padding: var(--s-4) 0 calc(var(--s-5) + var(--safe-b));
        background: linear-gradient(180deg, transparent, var(--ink) 40%);
      }
    `}</style>
  )
}
