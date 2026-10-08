/* ============================================================================
   Account.

   The copy here does real work. A user who has been logging anonymously for
   three months needs to know, before they type an email, that signing in will
   *upload what they already have* rather than replace it with an empty account.
   That is the single most likely reason someone would otherwise refuse to
   create one.
   ========================================================================= */

import { useState } from 'react'
import {
  AlertTriangle,
  Check,
  CloudOff,
  Cloud,
  Eye,
  EyeOff,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from 'lucide-react'
import { ApiError } from '../lib/api'
import { fmtSyncAge, useAuth } from '../lib/auth'
import { useStore } from '../lib/store'
import { useT } from '../lib/i18n'
import { ConfirmSheet, ScreenHeader, Sheet, Stat, useToast } from '../components/ui'

export default function Account() {
  const { t } = useT()
  const { data } = useStore()
  const toast = useToast()
  const auth = useAuth()

  const [mode, setMode] = useState<'in' | 'up'>('up')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [reveal, setReveal] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pwSheet, setPwSheet] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const entries =
    data.weights.length + data.sessions.length + data.meals.length + data.photos.length

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!email.trim()) return setError('Enter your email address.')
    if (password.length < 8) return setError('Password must be at least 8 characters.')

    setBusy(true)
    try {
      if (mode === 'up') await auth.signUp(email.trim(), password)
      else await auth.signIn(email.trim(), password)
      setPassword('')
      toast.show(mode === 'up' ? 'Account created. Syncing your log…' : 'Signed in. Syncing…', {
        tone: 'good',
      })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server.')
    } finally {
      setBusy(false)
    }
  }

  /* --------------------------- sync unavailable --------------------------- */

  if (auth.available === false) {
    return (
      <div className="shell">
        <ScreenHeader title="Account" back="/settings" />
        <div className="card ac-note" style={{ marginTop: 'var(--s-4)' }}>
          <CloudOff size={22} aria-hidden="true" />
          <h2 className="ac-noteTitle">Sync is not set up on this server</h2>
          <p className="ac-noteBody">
            Everything works exactly as it does now — your log lives on this device. Accounts only
            add a second device and an off-device copy.
          </p>
          <p className="ac-noteBody">
            Until then, Settings → Save a backup is your safety net. It is the only copy that
            survives clearing site data.
          </p>
        </div>
      </div>
    )
  }

  if (auth.loading) {
    return (
      <div className="shell">
        <ScreenHeader title="Account" back="/settings" />
        <div className="skeleton" style={{ height: 160, marginTop: 'var(--s-4)' }} />
      </div>
    )
  }

  /* ------------------------------ signed in ------------------------------- */

  if (auth.user) {
    const phaseCopy: Record<string, string> = {
      idle: 'Waiting',
      syncing: 'Syncing your log…',
      photos: 'Syncing photos…',
      ok: 'Up to date',
      offline: 'Offline — your log is safe on this device',
      error: 'Could not sync',
    }

    return (
      <div className="shell">
        <ScreenHeader title="Account" back="/settings" />

        <section className="card ac-who" style={{ marginTop: 'var(--s-4)' }}>
          <span className="ac-avatar" aria-hidden="true">
            {auth.user.email[0]?.toUpperCase()}
          </span>
          <div className="grow">
            <p className="ac-email truncate">{auth.user.email}</p>
            <p className="ac-sub">Signed in</p>
          </div>
        </section>

        <div className="eyebrow">Sync</div>
        <section className="card">
          <div className="ac-status" data-phase={auth.phase}>
            {auth.phase === 'offline' ? (
              <CloudOff size={16} aria-hidden="true" />
            ) : auth.phase === 'error' ? (
              <AlertTriangle size={16} aria-hidden="true" />
            ) : auth.phase === 'ok' ? (
              <Check size={16} aria-hidden="true" />
            ) : (
              <RefreshCw
                size={16}
                aria-hidden="true"
                className={auth.phase === 'syncing' || auth.phase === 'photos' ? 'ac-spin' : ''}
              />
            )}
            <span className="grow">{phaseCopy[auth.phase] ?? 'Waiting'}</span>
          </div>

          {auth.lastMessage && <p className="ac-msg">{auth.lastMessage}</p>}

          <div className="grid-2" style={{ marginTop: 'var(--s-4)' }}>
            <Stat label="Last sync" value={fmtSyncAge(auth.syncedAt)} size="sm" />
            <Stat label="Entries" value={entries} size="sm" />
          </div>

          <button
            type="button"
            className="btn btn--ghost btn--block"
            style={{ marginTop: 'var(--s-4)' }}
            disabled={auth.phase === 'syncing' || auth.phase === 'photos'}
            onClick={() => void auth.sync('manual')}
          >
            <RefreshCw size={15} aria-hidden="true" />
            Sync now
          </button>

          <p className="ac-fine">
            Syncs automatically when you open the app and when you switch away from it. Logging a
            set never waits for the network.
          </p>
        </section>

        <div className="eyebrow">Security</div>
        <div className="card card--flush">
          <button type="button" className="ac-row pressable" onClick={() => setPwSheet(true)}>
            <ShieldCheck size={16} aria-hidden="true" />
            <span className="grow">Change password</span>
          </button>
          <div className="divider" />
          <button
            type="button"
            className="ac-row pressable"
            onClick={() =>
              void auth.signOut().then(() => toast.show('Signed out. Your log stays on this device.'))
            }
          >
            <LogOut size={16} aria-hidden="true" />
            <span className="grow">Sign out</span>
          </button>
        </div>

        <p className="ac-fine" style={{ marginTop: 'var(--s-3)' }}>
          Signing out pushes anything outstanding first, then leaves your log on this device exactly
          as it is. Nothing is erased.
        </p>

        <div className="eyebrow">Danger</div>
        <button
          type="button"
          className="btn btn--danger btn--block"
          onClick={() => setDeleting(true)}
        >
          <AlertTriangle size={15} aria-hidden="true" />
          Delete account
        </button>

        {pwSheet && <PasswordSheet onClose={() => setPwSheet(false)} />}

        <ConfirmSheet
          open={deleting}
          onClose={() => setDeleting(false)}
          onConfirm={() => {
            void auth
              .deleteAccount()
              .then(() => toast.show('Account deleted. Your log stays on this device.'))
              .catch(() => toast.show('Could not delete the account', { tone: 'warn' }))
          }}
          title="Delete your account?"
          body="This erases the synced copy and every photo on the server. The log on this device is untouched — to remove that too, use Erase everything in Settings."
          confirmLabel="Delete account"
        />

        <AccountStyles />
      </div>
    )
  }

  /* ----------------------------- signed out ------------------------------- */

  return (
    <div className="shell">
      <ScreenHeader title="Account" back="/settings" />

      <section className="card ac-pitch" style={{ marginTop: 'var(--s-4)' }}>
        <Cloud size={22} aria-hidden="true" />
        <h2 className="ac-pitchTitle">Keep your log safe, on every device</h2>
        <ul className="ac-benefits">
          <li>
            <Smartphone size={14} aria-hidden="true" />
            <span>Phone and laptop stay in step automatically</span>
          </li>
          <li>
            <ShieldCheck size={14} aria-hidden="true" />
            <span>A copy survives a lost phone or cleared browser data</span>
          </li>
          <li>
            <Check size={14} aria-hidden="true" />
            <span>Everything keeps working offline — the gym does not need a signal</span>
          </li>
        </ul>

        {entries > 0 && (
          <p className="ac-carry">
            <strong>Your {entries} existing entries come with you.</strong> Signing in uploads what
            is already on this device and merges it with anything in the account — it never starts
            you from scratch.
          </p>
        )}
      </section>

      <div className="segmented" style={{ marginTop: 'var(--s-4)' }}>
        <button type="button" aria-selected={mode === 'up'} onClick={() => setMode('up')}>
          Create account
        </button>
        <button type="button" aria-selected={mode === 'in'} onClick={() => setMode('in')}>
          Sign in
        </button>
      </div>

      <form className="card stack-4" style={{ marginTop: 'var(--s-3)' }} onSubmit={submit}>
        <label className="field">
          <span className="field__label">Email</span>
          <input
            className="input"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError(null)
            }}
            placeholder="you@example.com"
            aria-invalid={!!error}
          />
        </label>

        <label className="field">
          <span className="field__label">Password</span>
          <div className="ac-pw">
            <input
              className="input"
              type={reveal ? 'text' : 'password'}
              autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError(null)
              }}
              placeholder={mode === 'up' ? 'At least 8 characters' : 'Your password'}
            />
            <button
              type="button"
              className="icon-btn"
              aria-label={reveal ? 'Hide password' : 'Show password'}
              onClick={() => setReveal((v) => !v)}
            >
              {reveal ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
            </button>
          </div>
          {mode === 'up' && (
            <span className="field__hint">
              There is no password reset yet, so use something you will not lose. Your backup file
              is the fallback either way.
            </span>
          )}
        </label>

        {error && (
          <p className="field__error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={busy}>
          {busy ? 'Working…' : mode === 'up' ? 'Create account' : t('common.next')}
        </button>
      </form>

      <p className="ac-fine">
        You can keep using Forge without an account for as long as you like — nothing here is
        required.
      </p>

      <AccountStyles />
    </div>
  )
}

/* ----------------------------- change password ---------------------------- */

function PasswordSheet({ onClose }: { onClose: () => void }) {
  const auth = useAuth()
  const toast = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setError(null)
    if (next.length < 8) return setError('New password must be at least 8 characters.')
    setBusy(true)
    try {
      await auth.changePassword(current, next)
      toast.show('Password changed. Sign in again on each device.', { tone: 'good' })
      onClose()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not change the password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Change password"
      footer={
        <button
          type="button"
          className="btn btn--primary btn--block btn--lg"
          onClick={() => void save()}
          disabled={busy}
        >
          {busy ? 'Working…' : 'Change password'}
        </button>
      }
    >
      <div className="stack-4">
        <label className="field">
          <span className="field__label">Current password</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field__label">New password</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </label>
        {error && (
          <p className="field__error" role="alert">
            {error}
          </p>
        )}
        <p className="field__hint" style={{ marginTop: 0 }}>
          This signs you out everywhere, including here. Your log stays on each device.
        </p>
      </div>
    </Sheet>
  )
}

function AccountStyles() {
  return (
    <style>{`
      .ac-note, .ac-pitch {
        display: flex; flex-direction: column; gap: var(--s-2);
        color: var(--text-2);
      }
      .ac-note > svg, .ac-pitch > svg { color: var(--ember); }
      .ac-noteTitle, .ac-pitchTitle {
        font-size: var(--fs-lg); font-weight: 700;
        letter-spacing: var(--tr-display); color: var(--text-1);
      }
      .ac-noteBody { font-size: var(--fs-sm); line-height: 1.55; max-width: 42ch; }

      .ac-benefits {
        display: flex; flex-direction: column; gap: var(--s-2);
        margin-top: var(--s-2);
      }
      .ac-benefits li {
        display: flex; align-items: flex-start; gap: var(--s-2);
        font-size: var(--fs-sm); line-height: 1.5;
      }
      .ac-benefits svg { color: var(--kiln-4); flex: none; margin-top: 3px; }
      .ac-carry {
        margin-top: var(--s-3); padding: var(--s-3);
        background: var(--ember-soft);
        border-radius: var(--r-sm);
        font-size: var(--fs-tiny); line-height: 1.55;
      }
      .ac-carry strong { color: var(--text-1); }

      .ac-who { display: flex; align-items: center; gap: var(--s-3); }
      .ac-avatar {
        display: grid; place-items: center;
        width: 44px; height: 44px; flex: none;
        border-radius: 50%;
        background: var(--ember); color: var(--text-on-ember);
        font-family: var(--font-display);
        font-size: var(--fs-lg); font-weight: 800;
      }
      .ac-email { font-size: var(--fs-base); font-weight: 600; }
      .ac-sub {
        font-family: var(--font-display);
        font-size: var(--fs-micro); font-weight: 700;
        letter-spacing: 0.1em; text-transform: uppercase;
        color: var(--good);
      }

      .ac-status {
        display: flex; align-items: center; gap: var(--s-2);
        font-size: var(--fs-sm); font-weight: 600;
        color: var(--text-2);
      }
      .ac-status[data-phase='ok'] { color: var(--good); }
      .ac-status[data-phase='error'] { color: var(--critical); }
      .ac-status[data-phase='offline'] { color: var(--warn); }
      .ac-spin { animation: ac-spin 1s linear infinite; }
      @keyframes ac-spin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) { .ac-spin { animation: none; } }

      .ac-msg {
        margin-top: var(--s-2);
        font-size: var(--fs-tiny); color: var(--text-3); line-height: 1.5;
      }
      .ac-fine {
        margin-top: var(--s-3);
        font-size: var(--fs-tiny); color: var(--text-3); line-height: 1.5;
      }

      .ac-row {
        display: flex; align-items: center; gap: var(--s-3);
        width: 100%; min-height: 52px; padding: 0 var(--s-4);
        text-align: left; font-size: var(--fs-sm); font-weight: 600;
        color: var(--text-1);
      }
      .ac-row > svg { color: var(--text-3); flex: none; }

      .ac-pw { display: flex; align-items: center; gap: var(--s-2); }
      .ac-pw .input { flex: 1; min-width: 0; }
    `}</style>
  )
}
