/* ============================================================================
   Settings. Profile, targets, units, language, theme, dashboard layout,
   reminders, backup, and the destructive reset.

   Two things worth noting:
   - Editing a target by hand sets `targetsCustomised`, and the screen then offers
     an explicit "recalculate" rather than silently overwriting the user's choice
     when their weight changes.
   - Backup/restore is the whole login story (spec §42). The copy says where the
     data lives and what happens if the phone is lost, because without an account
     the user is the only backup system.
   ========================================================================= */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Check,
  Cpu,
  Download,
  Eye,
  EyeOff,
  GripVertical,
  HardDrive,
  Upload,
} from 'lucide-react'
import type { ActivityLevel, DashCard, GoalType, Lang, Sex, Theme, Units } from '../lib/types'
import { suggestTargets, weightStats } from '../lib/calc'
import { useStore } from '../lib/store'
import { LANGUAGES, useT } from '../lib/i18n'
import { fmtInt, makeFmt } from '../lib/units'
import { requestPersistence, storageEstimate, wipeAll } from '../lib/db'
import {
  backupFilename,
  createBackup,
  downloadBlob,
  fmtBackupAge,
  readBackup,
  RestoreError,
} from '../lib/backup'
import { ConfirmSheet, ScreenHeader, Sheet, Stepper, useToast } from '../components/ui'
import { KEY_STORE } from './Coach'
import { fmtSyncAge, useAuth } from '../lib/auth'

const GOALS: GoalType[] = ['fat-loss', 'muscle-gain', 'recomp', 'maintenance', 'general', 'custom']
const ACTIVITIES: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'very', 'extreme']

const CARD_LABELS: Record<DashCard['id'], string> = {
  challenge: 'Challenge banner',
  score: 'Transformation score',
  weight: 'Weight',
  nutrition: 'Food',
  workout: 'Training',
  movement: 'Movement',
  sleep: 'Sleep',
  habits: 'Habits',
  records: 'Records',
}

export default function Settings() {
  const { t } = useT()
  const { data, actions } = useStore()
  const toast = useToast()
  const profile = data.profile!
  const fmt = useMemo(() => makeFmt(profile.units), [profile.units])

  const auth = useAuth()
  const navigate = useNavigate()
  const [sheet, setSheet] = useState<'profile' | 'targets' | 'dashboard' | 'key' | null>(null)
  const [resetting, setResetting] = useState(false)
  const [storage, setStorage] = useState<{ usedMb: number; quotaMb: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void storageEstimate().then(setStorage)
    // Ask once so the browser does not evict the log under storage pressure.
    void requestPersistence()
  }, [data.lastBackupAt])

  async function saveBackup() {
    setBusy(true)
    try {
      const blob = await createBackup(data)
      downloadBlob(blob, backupFilename())
      actions.markBackedUp()
      toast.show('Backup saved to your downloads', { tone: 'good' })
    } catch {
      toast.show('The backup could not be created', { tone: 'warn' })
    } finally {
      setBusy(false)
    }
  }

  async function restore(file: File) {
    setBusy(true)
    setRestoreError(null)
    try {
      const incoming = await readBackup(file)
      actions.importData(incoming)
      toast.show('Backup restored', { tone: 'good' })
    } catch (err) {
      setRestoreError(
        err instanceof RestoreError ? err.message : 'That file could not be restored.',
      )
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const hasKey = (() => {
    try {
      return !!localStorage.getItem(KEY_STORE)
    } catch {
      return false
    }
  })()

  return (
    <div className="shell">
      <ScreenHeader title={t('set.title')} back="/more" />

      {/* ------------------------------ profile ---------------------------- */}
      {/* Account first: it is the only row that changes where the data lives. */}
      <div className="eyebrow">Account</div>
      <div className="card card--flush">
        <SettingRow
          label={auth.user ? 'Signed in' : 'Sync & backup'}
          value={
            auth.available === false
              ? 'Not set up'
              : auth.user
                ? auth.user.email
                : 'Not signed in'
          }
          onClick={() => navigate('/account')}
        />
        {auth.user && (
          <>
            <div className="divider" />
            <SettingRow
              label="Last sync"
              value={auth.phase === 'syncing' || auth.phase === 'photos' ? 'Syncing…' : fmtSyncAge(auth.syncedAt)}
              onClick={() => navigate('/account')}
            />
          </>
        )}
      </div>

      <div className="eyebrow">{t('set.profile')}</div>
      <div className="card card--flush">
        <SettingRow label="Name" value={profile.name} onClick={() => setSheet('profile')} />
        <div className="divider" />
        <SettingRow label="Age" value={String(profile.age)} onClick={() => setSheet('profile')} />
        <div className="divider" />
        <SettingRow
          label={t('onb.height')}
          value={`${fmt.height(profile.heightCm)} ${profile.units === 'imperial' ? '' : 'cm'}`.trim()}
          onClick={() => setSheet('profile')}
        />
        <div className="divider" />
        <SettingRow
          label="Goal"
          value={t(`goal.${profile.goal}`)}
          onClick={() => setSheet('profile')}
        />
        <div className="divider" />
        <SettingRow
          label="Activity"
          value={t(`activity.${profile.activity}`)}
          onClick={() => setSheet('profile')}
        />
        <div className="divider" />
        <SettingRow
          label="Target weight"
          value={fmt.weightLabel(profile.targetWeightKg)}
          onClick={() => setSheet('profile')}
        />
      </div>

      {/* ------------------------------ targets ---------------------------- */}
      <div className="eyebrow">{t('set.targets')}</div>
      <div className="card card--flush">
        <SettingRow
          label={t('nutri.calories')}
          value={`${fmtInt(profile.targets.calories)} kcal`}
          onClick={() => setSheet('targets')}
        />
        <div className="divider" />
        <SettingRow
          label={t('nutri.protein')}
          value={`${profile.targets.protein} g`}
          onClick={() => setSheet('targets')}
        />
        <div className="divider" />
        <SettingRow
          label={t('cardio.steps')}
          value={fmtInt(profile.targets.steps)}
          onClick={() => setSheet('targets')}
        />
        <div className="divider" />
        <SettingRow
          label={t('sleep.title')}
          value={`${profile.targets.sleepHours} h`}
          onClick={() => setSheet('targets')}
        />
      </div>
      {profile.targetsCustomised && (
        <p className="st-hint">
          You set these by hand, so they stay as you left them even when your weight changes.
        </p>
      )}

      {/* ---------------------------- appearance --------------------------- */}
      <div className="eyebrow">Appearance</div>
      <div className="card">
        <p className="field__label">{t('set.theme')}</p>
        <div className="segmented">
          {(
            [
              ['dark', t('set.theme.dark')],
              ['light', t('set.theme.light')],
              ['system', t('set.theme.system')],
            ] as Array<[Theme, string]>
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-selected={profile.theme === value}
              onClick={() => actions.setTheme(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="field__label" style={{ marginTop: 'var(--s-5)' }}>
          {t('set.units')}
        </p>
        <div className="segmented">
          {(
            [
              ['metric', t('set.units.metric')],
              ['imperial', t('set.units.imperial')],
            ] as Array<[Units, string]>
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-selected={profile.units === value}
              onClick={() => actions.updateProfile({ units: value })}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="field__hint">
          Everything is stored in metric and converted for display, so switching never changes your
          history.
        </p>

        <p className="field__label" style={{ marginTop: 'var(--s-5)' }}>
          {t('set.language')}
        </p>
        <div className="chips">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              className="chip"
              aria-pressed={profile.lang === l.code}
              onClick={() => actions.updateProfile({ lang: l.code as Lang })}
            >
              {l.native}
            </button>
          ))}
        </div>

        <p className="field__label" style={{ marginTop: 'var(--s-5)' }}>
          {t('set.coaching')}
        </p>
        <div className="segmented">
          {(
            [
              ['gentle', t('set.coaching.gentle')],
              ['balanced', t('set.coaching.balanced')],
              ['direct', t('set.coaching.direct')],
            ] as Array<[typeof profile.coaching, string]>
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-selected={profile.coaching === value}
              onClick={() => actions.updateProfile({ coaching: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="btn btn--ghost btn--block"
        style={{ marginTop: 'var(--s-3)' }}
        onClick={() => setSheet('dashboard')}
      >
        {t('home.customise')}
      </button>

      {/* --------------------------- notifications ------------------------- */}
      <div className="eyebrow">{t('set.notifications')}</div>
      <div className="card">
        <Toggle
          label="Reminders on"
          hint="Nothing fires until you allow notifications in your browser."
          checked={data.notifications.enabled}
          onChange={async (on) => {
            if (on && 'Notification' in window) {
              const permission = await Notification.requestPermission()
              if (permission !== 'granted') {
                toast.show('Your browser blocked notifications', { tone: 'warn' })
                return
              }
            }
            actions.setNotifications({ enabled: on })
          }}
        />

        {data.notifications.enabled && (
          <div className="st-notis">
            {(
              [
                ['workout', 'Workout reminder'],
                ['checkIn', 'Check-in reminder'],
                ['nutrition', 'Meal reminders'],
                ['protein', 'Protein nudge'],
                ['sleep', 'Wind-down reminder'],
                ['supplements', 'Supplement reminder'],
                ['challenge', 'Challenge progress'],
                ['goals', 'Goal deadlines'],
              ] as Array<[keyof typeof data.notifications, string]>
            ).map(([key, label]) => (
              <Toggle
                key={key}
                label={label}
                checked={!!data.notifications[key]}
                onChange={(on) => actions.setNotifications({ [key]: on })}
              />
            ))}

            <div className="grid-2" style={{ marginTop: 'var(--s-3)' }}>
              <label className="field">
                <span className="field__label">Check-in time</span>
                <input
                  className="input input--num"
                  type="time"
                  value={data.notifications.checkInTime}
                  onChange={(e) => actions.setNotifications({ checkInTime: e.target.value })}
                />
              </label>
              <label className="field">
                <span className="field__label">Workout time</span>
                <input
                  className="input input--num"
                  type="time"
                  value={data.notifications.workoutTime}
                  onChange={(e) => actions.setNotifications({ workoutTime: e.target.value })}
                />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------ AI coach ---------------------------- */}
      <div className="eyebrow">{t('coach.title')}</div>
      <div className="card">
        <p className="st-body">
          The coach answers the common questions from your log with no key and no network. Connecting
          a model adds open conversation, using the same log digest as context.
        </p>
        <button
          type="button"
          className="btn btn--ghost btn--block"
          style={{ marginTop: 'var(--s-3)' }}
          onClick={() => setSheet('key')}
        >
          <Cpu size={15} aria-hidden="true" />
          {hasKey ? 'Model connected — change key' : 'Connect a model'}
        </button>
      </div>

      {/* ------------------------------ backup ----------------------------- */}
      <div className="eyebrow">{t('set.backup')}</div>
      <div className="card">
        <p className="st-body">{t('set.backup.body')}</p>

        <div className="st-storage">
          <HardDrive size={14} aria-hidden="true" />
          <span className="grow">
            {storage
              ? `${storage.usedMb.toFixed(1)} MB used of ${Math.round(storage.quotaMb)} MB available`
              : 'Storage usage unavailable'}
          </span>
        </div>

        <p className="st-lastBackup num">
          {data.lastBackupAt
            ? t('set.backup.last', { when: fmtBackupAge(data.lastBackupAt) ?? '' })
            : t('set.backup.never')}
        </p>

        <div className="row" style={{ gap: 'var(--s-2)', marginTop: 'var(--s-3)' }}>
          <button
            type="button"
            className="btn btn--primary grow"
            onClick={() => void saveBackup()}
            disabled={busy}
          >
            <Download size={15} aria-hidden="true" />
            {t('set.backup.save')}
          </button>
          <button
            type="button"
            className="btn btn--ghost grow"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            <Upload size={15} aria-hidden="true" />
            Restore
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void restore(file)
          }}
        />

        {restoreError && (
          <p className="field__error" role="alert" style={{ marginTop: 'var(--s-3)' }}>
            {restoreError}
          </p>
        )}

        <p className="field__hint">
          The backup file contains everything, photos included. Restoring replaces what is on this
          device, so save a current backup first if you are unsure.
        </p>
      </div>

      {/* ------------------------------- about ----------------------------- */}
      <div className="eyebrow">{t('set.about')}</div>
      <div className="card">
        <dl className="st-about">
          <div>
            <dt>Version</dt>
            <dd className="num">1.0.0</dd>
          </div>
          <div>
            <dt>Device ID</dt>
            <dd className="num st-device">{data.deviceId}</dd>
          </div>
          <div>
            <dt>Logging since</dt>
            <dd className="num">{profile.createdAt}</dd>
          </div>
          <div>
            <dt>Entries</dt>
            <dd className="num">
              {data.weights.length + data.sessions.length + data.meals.length}
            </dd>
          </div>
        </dl>
        <p className="field__hint">
          The device ID travels in your backup file. Restoring on a new phone adopts it, which is how
          the journey stays continuous without an account.
        </p>
      </div>

      {/* ------------------------------- danger ---------------------------- */}
      <div className="eyebrow">Danger</div>
      <button type="button" className="btn btn--danger btn--block" onClick={() => setResetting(true)}>
        <AlertTriangle size={15} aria-hidden="true" />
        {t('set.reset')}
      </button>

      {/* ------------------------------ sheets ----------------------------- */}
      {sheet === 'profile' && <ProfileSheet onClose={() => setSheet(null)} />}
      {sheet === 'targets' && <TargetsSheet onClose={() => setSheet(null)} />}
      {sheet === 'dashboard' && <DashboardSheet onClose={() => setSheet(null)} />}
      {sheet === 'key' && <KeySheet onClose={() => setSheet(null)} />}

      <ConfirmSheet
        open={resetting}
        onClose={() => setResetting(false)}
        onConfirm={() => {
          void wipeAll().then(() => {
            actions.resetAll()
            toast.show('Everything erased')
          })
        }}
        title={t('set.reset')}
        body={t('set.reset.confirm')}
        confirmLabel="Erase everything"
      />

      <style>{`
        .st-hint {
          margin-top: var(--s-2);
          font-size: var(--fs-tiny); color: var(--text-3); line-height: 1.5;
        }
        .st-body {
          font-size: var(--fs-sm); color: var(--text-2);
          line-height: 1.55; max-width: 44ch;
        }
        .st-notis {
          display: flex; flex-direction: column;
          margin-top: var(--s-3); padding-top: var(--s-3);
          border-top: 1px solid var(--hairline);
        }
        .st-storage {
          display: flex; align-items: center; gap: var(--s-2);
          margin-top: var(--s-4);
          font-size: var(--fs-tiny); color: var(--text-2);
        }
        .st-lastBackup {
          margin-top: 4px;
          font-size: var(--fs-tiny); color: var(--text-3);
        }
        .st-about {
          display: grid; grid-template-columns: repeat(2, 1fr);
          gap: var(--s-4) var(--s-3);
        }
        .st-about dt {
          font-family: var(--font-display);
          font-size: var(--fs-micro); font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--text-3);
        }
        .st-about dd { font-size: var(--fs-sm); margin-top: 2px; }
        .st-device {
          font-size: var(--fs-tiny);
          overflow: hidden; text-overflow: ellipsis;
        }
      `}</style>
    </div>
  )
}

/* ------------------------------- small parts ------------------------------ */

function SettingRow({
  label,
  value,
  onClick,
}: {
  label: string
  value: string
  onClick: () => void
}) {
  return (
    <button type="button" className="sr pressable" onClick={onClick}>
      <span className="sr__label grow">{label}</span>
      <span className="sr__value num truncate">{value}</span>

      <style>{`
        .sr {
          display: flex; align-items: center; gap: var(--s-3);
          width: 100%; min-height: 50px; padding: 0 var(--s-4);
          text-align: left;
        }
        .sr__label { font-size: var(--fs-sm); color: var(--text-2); }
        .sr__value {
          flex: none; max-width: 55%;
          font-size: var(--fs-sm); font-weight: 600; color: var(--text-1);
        }
      `}</style>
    </button>
  )
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (on: boolean) => void
}) {
  return (
    <label className="tg">
      <span className="grow">
        <span className="tg__label">{label}</span>
        {hint && <span className="tg__hint">{hint}</span>}
      </span>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="tg__track" data-on={checked} aria-hidden="true">
        <span className="tg__knob" />
      </span>

      <style>{`
        .tg {
          display: flex; align-items: center; gap: var(--s-3);
          min-height: 48px; cursor: pointer;
        }
        .tg__label { display: block; font-size: var(--fs-sm); font-weight: 600; }
        .tg__hint {
          display: block; font-size: var(--fs-tiny); color: var(--text-3);
          line-height: 1.4; max-width: 36ch;
        }
        .tg__track {
          position: relative; flex: none;
          width: 44px; height: 26px;
          border-radius: var(--r-pill);
          background: var(--surface-3);
          border: 1px solid var(--hairline-strong);
          transition: background-color var(--t-mid) var(--ease-out), border-color var(--t-mid) var(--ease-out);
        }
        .tg__track[data-on='true'] { background: var(--ember); border-color: var(--ember); }
        .tg__knob {
          position: absolute; top: 2px; left: 2px;
          width: 20px; height: 20px; border-radius: 50%;
          background: var(--text-1);
          transition: transform var(--t-mid) var(--ease-spring);
        }
        .tg__track[data-on='true'] .tg__knob {
          transform: translateX(18px);
          background: var(--text-on-ember);
        }
        .tg input:focus-visible + .tg__track {
          outline: 2px solid var(--focus); outline-offset: 2px;
        }
      `}</style>
    </label>
  )
}

/* ------------------------------ profile sheet ----------------------------- */

function ProfileSheet({ onClose }: { onClose: () => void }) {
  const { t } = useT()
  const { data, actions } = useStore()
  const toast = useToast()
  const profile = data.profile!
  const fmt = useMemo(() => makeFmt(profile.units), [profile.units])

  const [name, setName] = useState(profile.name)
  const [age, setAge] = useState(profile.age)
  const [sex, setSex] = useState<Sex>(profile.sex)
  const [heightCm, setHeightCm] = useState(profile.heightCm)
  const [goal, setGoal] = useState(profile.goal)
  const [activity, setActivity] = useState(profile.activity)
  const [targetWeight, setTargetWeight] = useState(() => Number(fmt.weight(profile.targetWeightKg)))

  function save() {
    actions.updateProfile({
      name: name.trim() || profile.name,
      age,
      sex,
      heightCm,
      goal,
      activity,
      targetWeightKg: Number(fmt.toKg(targetWeight).toFixed(2)),
    })
    toast.show(t('common.saved'), { tone: 'good' })
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={t('set.profile')}
      tall
      footer={
        <button type="button" className="btn btn--primary btn--block btn--lg" onClick={save}>
          {t('common.save')}
        </button>
      }
    >
      <div className="stack-4">
        <label className="field">
          <span className="field__label">Name</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={32}
          />
        </label>

        <div className="grid-2">
          <Stepper label={t('onb.age')} value={age} onChange={setAge} min={13} max={100} />
          <Stepper
            label={t('onb.height')}
            unit={fmt.heightUnit}
            value={Math.round(profile.units === 'imperial' ? heightCm / 2.54 : heightCm)}
            onChange={(v) => setHeightCm(Math.round(fmt.toCm(v)))}
            min={profile.units === 'imperial' ? 47 : 120}
            max={profile.units === 'imperial' ? 91 : 230}
          />
        </div>

        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field__label">{t('onb.sex')}</legend>
          <div className="chips" style={{ marginTop: 'var(--s-2)' }}>
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
                aria-pressed={sex === value}
                onClick={() => setSex(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

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

        <div className="field">
          <span className="field__label">Activity level</span>
          <select
            className="select"
            value={activity}
            onChange={(e) => setActivity(e.target.value as ActivityLevel)}
          >
            {ACTIVITIES.map((a) => (
              <option key={a} value={a}>
                {t(`activity.${a}`)}
              </option>
            ))}
          </select>
        </div>

        <Stepper
          label={t('onb.weight.target')}
          unit={fmt.weightUnit}
          step={0.5}
          decimals={1}
          min={profile.units === 'imperial' ? 66 : 30}
          max={profile.units === 'imperial' ? 660 : 300}
          value={targetWeight}
          onChange={setTargetWeight}
        />

        <p className="field__hint" style={{ marginTop: 0 }}>
          Changing your goal or activity does not move targets you edited by hand. Use “Reset to
          suggested” in Daily targets if you want them recalculated.
        </p>
      </div>
    </Sheet>
  )
}

/* ------------------------------ targets sheet ----------------------------- */

function TargetsSheet({ onClose }: { onClose: () => void }) {
  const { t } = useT()
  const { data, actions } = useStore()
  const toast = useToast()
  const profile = data.profile!
  const current = weightStats(data).current ?? profile.startWeightKg

  const [targets, setTargets] = useState(profile.targets)

  const suggested = useMemo(() => suggestTargets(profile, current), [profile, current])
  const differs = JSON.stringify(targets) !== JSON.stringify(suggested)

  function save() {
    actions.updateProfile({ targets, targetsCustomised: differs })
    toast.show(t('common.saved'), { tone: 'good' })
    onClose()
  }

  const set = <K extends keyof typeof targets>(k: K, v: (typeof targets)[K]) =>
    setTargets((prev) => ({ ...prev, [k]: v }))

  return (
    <Sheet
      open
      onClose={onClose}
      title={t('set.targets')}
      tall
      footer={
        <button type="button" className="btn btn--primary btn--block btn--lg" onClick={save}>
          {t('common.save')}
        </button>
      }
    >
      <div className="stack-4">
        <div className="grid-2">
          <Stepper
            label={t('nutri.calories')}
            unit="kcal"
            step={50}
            min={1200}
            max={6000}
            value={targets.calories}
            onChange={(v) => set('calories', v)}
          />
          <Stepper
            label={t('nutri.protein')}
            unit="g"
            step={5}
            min={40}
            max={400}
            value={targets.protein}
            onChange={(v) => set('protein', v)}
          />
          <Stepper
            label={t('nutri.carbs')}
            unit="g"
            step={5}
            min={0}
            max={700}
            value={targets.carbs}
            onChange={(v) => set('carbs', v)}
          />
          <Stepper
            label={t('nutri.fat')}
            unit="g"
            step={5}
            min={0}
            max={300}
            value={targets.fat}
            onChange={(v) => set('fat', v)}
          />
          <Stepper
            label={t('cardio.steps')}
            step={500}
            min={2000}
            max={30000}
            value={targets.steps}
            onChange={(v) => set('steps', v)}
          />
          <Stepper
            label={t('sleep.title')}
            unit="h"
            step={0.5}
            decimals={1}
            min={4}
            max={12}
            value={targets.sleepHours}
            onChange={(v) => set('sleepHours', v)}
          />
        </div>

        <Stepper
          label="Sessions a week"
          step={1}
          min={1}
          max={14}
          value={targets.workoutsPerWeek}
          onChange={(v) => set('workoutsPerWeek', v)}
        />

        {differs && (
          <button
            type="button"
            className="btn btn--ghost btn--block"
            onClick={() => setTargets(suggested)}
          >
            {t('onb.targets.recalc')}
          </button>
        )}

        <p className="field__hint" style={{ marginTop: 0 }}>
          Suggested from your current weight ({suggested.calories} kcal, {suggested.protein} g
          protein). Your numbers beat the formula — the formula does not know how you felt last week.
        </p>
      </div>
    </Sheet>
  )
}

/* ---------------------------- dashboard sheet ----------------------------- */

function DashboardSheet({ onClose }: { onClose: () => void }) {
  const { t } = useT()
  const { data, actions } = useStore()
  const [cards, setCards] = useState<DashCard[]>(data.dashboard)

  function move(index: number, dir: -1 | 1) {
    const next = [...cards]
    const to = index + dir
    if (to < 0 || to >= next.length) return
    ;[next[index], next[to]] = [next[to], next[index]]
    setCards(next)
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={t('home.customise')}
      tall
      footer={
        <button
          type="button"
          className="btn btn--primary btn--block btn--lg"
          onClick={() => {
            actions.setDashboard(cards)
            onClose()
          }}
        >
          {t('common.save')}
        </button>
      }
    >
      <p className="field__hint" style={{ marginTop: 0, marginBottom: 'var(--s-4)' }}>
        Hide what you do not use and put what you check most at the top. The challenge banner only
        appears while a challenge is running.
      </p>

      <ul className="db-list">
        {cards.map((c, i) => (
          <li key={c.id} className="db-row">
            <span className="db-grip" aria-hidden="true">
              <GripVertical size={15} />
            </span>
            <span className="grow db-name">{CARD_LABELS[c.id]}</span>

            <span className="db-moves">
              <button
                type="button"
                className="db-move"
                aria-label={`Move ${CARD_LABELS[c.id]} up`}
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="db-move"
                aria-label={`Move ${CARD_LABELS[c.id]} down`}
                disabled={i === cards.length - 1}
                onClick={() => move(i, 1)}
              >
                ↓
              </button>
            </span>

            <button
              type="button"
              className="db-eye"
              aria-pressed={c.visible}
              aria-label={`${c.visible ? 'Hide' : 'Show'} ${CARD_LABELS[c.id]}`}
              onClick={() =>
                setCards(cards.map((x, idx) => (idx === i ? { ...x, visible: !x.visible } : x)))
              }
            >
              {c.visible ? <Eye size={16} aria-hidden="true" /> : <EyeOff size={16} aria-hidden="true" />}
            </button>
          </li>
        ))}
      </ul>

      <style>{`
        .db-list { display: flex; flex-direction: column; gap: var(--s-2); }
        .db-row {
          display: flex; align-items: center; gap: var(--s-2);
          min-height: 52px; padding: 0 var(--s-2) 0 var(--s-3);
          background: var(--surface-2);
          border: 1px solid var(--hairline);
          border-radius: var(--r-md);
        }
        .db-grip { color: var(--text-3); flex: none; display: grid; place-items: center; }
        .db-name { font-size: var(--fs-sm); font-weight: 600; }
        .db-moves { display: flex; gap: 2px; flex: none; }
        .db-move {
          width: 34px; height: 36px;
          border-radius: var(--r-sm);
          color: var(--text-2);
          font-size: var(--fs-base);
        }
        .db-move:hover:not(:disabled) { background: var(--surface-3); color: var(--text-1); }
        .db-move:disabled { opacity: 0.3; cursor: not-allowed; }
        .db-eye {
          display: grid; place-items: center;
          width: 40px; height: 40px; flex: none;
          border-radius: var(--r-sm);
          color: var(--text-3);
        }
        .db-eye[aria-pressed='true'] { color: var(--ember); }
      `}</style>
    </Sheet>
  )
}

/* ------------------------------- key sheet -------------------------------- */

function KeySheet({ onClose }: { onClose: () => void }) {
  const { t } = useT()
  const toast = useToast()
  const [key, setKey] = useState(() => {
    try {
      return localStorage.getItem(KEY_STORE) ?? ''
    } catch {
      return ''
    }
  })
  const [reveal, setReveal] = useState(false)

  return (
    <Sheet
      open
      onClose={onClose}
      title="Connect a model"
      footer={
        <button
          type="button"
          className="btn btn--primary btn--block btn--lg"
          onClick={() => {
            try {
              if (key.trim()) localStorage.setItem(KEY_STORE, key.trim())
              else localStorage.removeItem(KEY_STORE)
              toast.show(key.trim() ? 'Model connected' : 'Key removed', { tone: 'good' })
            } catch {
              toast.show('The key could not be saved', { tone: 'warn' })
            }
            onClose()
          }}
        >
          <Check size={16} aria-hidden="true" />
          {t('common.save')}
        </button>
      }
    >
      <p className="st-body">
        The coach already answers your progress, weight, protein, calorie, training, sleep and step
        questions from the log with no key at all. A key adds open conversation on top.
      </p>

      <label className="field" style={{ marginTop: 'var(--s-4)' }}>
        <span className="field__label">Anthropic API key</span>
        <div className="ks-row">
          <input
            className="input"
            type={reveal ? 'text' : 'password'}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-ant-…"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="icon-btn"
            aria-label={reveal ? 'Hide key' : 'Show key'}
            onClick={() => setReveal((v) => !v)}
          >
            {reveal ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
          </button>
        </div>
        <span className="field__hint">
          Stored on this device only and sent directly to Anthropic when you ask a question. Leave it
          blank to disconnect. A key in a browser is visible to anything running on this page, so use
          a key you are willing to rotate.
        </span>
      </label>

      <style>{`
        .ks-row { display: flex; align-items: center; gap: var(--s-2); }
        .ks-row .input { flex: 1; min-width: 0; }
      `}</style>
    </Sheet>
  )
}
