/* ============================================================================
   Friend leaderboard. V1 has no backend, so this is an honest local scorecard:
   you enter your friends' numbers (they tell you, you type them) and the board
   ranks you against them.

   Two deliberate constraints from spec §34:
   - Only consistency metrics are rankable: streak, workouts, steps, achievements.
     Weight, body data and photos are never comparable here, and the screen says
     so in plain words.
   - No network calls, so nothing about the user leaves the device either.
   ========================================================================= */

import { useMemo, useState } from 'react'
import { Lock, Plus, Trash2, Trophy, Users } from 'lucide-react'
import type { Friend } from '../lib/types'
import { currentStreak } from '../lib/calc'
import { useStore } from '../lib/store'
import { useT } from '../lib/i18n'
import { fmtInt } from '../lib/units'
import {
  ConfirmSheet,
  Empty,
  ScreenHeader,
  Sheet,
  Stepper,
  useToast,
} from '../components/ui'

type Metric = 'streak' | 'workouts' | 'steps' | 'achievements'

const METRICS: Array<{ key: Metric; label: string; unit: string }> = [
  { key: 'streak', label: 'Streak', unit: 'days' },
  { key: 'workouts', label: 'Workouts', unit: 'total' },
  { key: 'steps', label: 'Steps', unit: 'this week' },
  { key: 'achievements', label: 'Badges', unit: 'unlocked' },
]

export default function Friends() {
  const { t, locale } = useT()
  const { data, actions } = useStore()
  const toast = useToast()
  const profile = data.profile!

  const [metric, setMetric] = useState<Metric>('streak')
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<Friend | null>(null)

  // Your own row, computed from the log rather than typed.
  const me = useMemo(() => {
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 6)
    const cutoff = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth() + 1).padStart(2, '0')}-${String(weekAgo.getDate()).padStart(2, '0')}`
    return {
      id: 'me',
      name: profile.name || 'You',
      streak: currentStreak(data),
      workouts: data.sessions.filter((s) => s.completed).length,
      steps: data.steps.filter((s) => s.date >= cutoff).reduce((a, s) => a + s.steps, 0),
      achievements: Object.keys(data.achievements).length,
    } satisfies Friend
  }, [data, profile.name])

  const board = useMemo(
    () => [me, ...data.friends].sort((a, b) => b[metric] - a[metric]),
    [me, data.friends, metric],
  )

  const unit = METRICS.find((m) => m.key === metric)!.unit

  return (
    <div className="shell">
      <ScreenHeader
        title={t('fr.title')}
        back="/more"
        action={
          <button
            type="button"
            className="icon-btn"
            aria-label={t('fr.add')}
            onClick={() => setAdding(true)}
          >
            <Plus size={20} aria-hidden="true" />
          </button>
        }
      />

      <p className="fr-privacy">
        <Lock size={13} aria-hidden="true" />
        <span>
          <strong>{t('fr.privacy')}</strong> Only consistency is compared — streaks, workouts, steps
          and badges. Nothing is sent anywhere; you enter your friends' numbers yourself.
        </span>
      </p>

      {data.friends.length === 0 ? (
        <Empty
          icon={<Users size={26} aria-hidden="true" />}
          title={t('fr.empty')}
          body={t('fr.empty.body')}
          action={
            <button type="button" className="btn btn--primary" onClick={() => setAdding(true)}>
              <Plus size={15} aria-hidden="true" />
              {t('fr.add')}
            </button>
          }
        />
      ) : (
        <>
          <div className="hscroll" style={{ marginTop: 'var(--s-4)' }}>
            {METRICS.map((m) => (
              <button
                key={m.key}
                type="button"
                className="chip"
                aria-pressed={metric === m.key}
                onClick={() => setMetric(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>

          <ol className="fr-board">
            {board.map((row, i) => {
              const isMe = row.id === 'me'
              const leader = i === 0
              return (
                <li key={row.id}>
                  <div className={`card fr-row${isMe ? ' fr-row--me' : ''}`}>
                    <span className="num fr-rank" data-leader={leader}>
                      {leader ? <Trophy size={15} aria-hidden="true" /> : i + 1}
                    </span>
                    <span className="grow">
                      <span className="fr-name">
                        {row.name}
                        {isMe && <span className="fr-you">you</span>}
                      </span>
                      <span className="fr-unit">{unit}</span>
                    </span>
                    <span className="num fr-value">{fmtInt(row[metric], locale)}</span>
                    {!isMe && (
                      <button
                        type="button"
                        className="fr-del"
                        aria-label={`Remove ${row.name}`}
                        onClick={() => setDeleting(row)}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>

          <p className="fr-note">
            Your row updates itself from your log. Friends' numbers are whatever you last typed — tap
            a friend's row in the add sheet to refresh them.
          </p>
        </>
      )}

      {adding && <AddFriendSheet onClose={() => setAdding(false)} />}

      <ConfirmSheet
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) {
            actions.importData({
              ...data,
              friends: data.friends.filter((f) => f.id !== deleting.id),
            })
          }
          toast.show('Friend removed')
        }}
        title={`Remove ${deleting?.name ?? 'friend'}?`}
        body="They come off the board. Nothing else changes."
      />

      <style>{`
        .fr-privacy {
          display: flex; align-items: flex-start; gap: var(--s-2);
          margin-top: var(--s-4); padding: var(--s-3);
          background: var(--surface-2);
          border: 1px solid var(--hairline);
          border-radius: var(--r-md);
          font-size: var(--fs-tiny); color: var(--text-2); line-height: 1.5;
        }
        .fr-privacy strong { color: var(--text-1); }

        .fr-board {
          display: flex; flex-direction: column; gap: var(--s-2);
          margin-top: var(--s-4);
        }
        .fr-row {
          display: flex; align-items: center; gap: var(--s-3);
          padding: var(--s-3) var(--s-3) var(--s-3) var(--s-4);
        }
        .fr-row--me { border-color: var(--ember-line); background: linear-gradient(180deg, var(--ember-soft), var(--surface-1) 80%); }
        .fr-rank {
          display: grid; place-items: center;
          width: 28px; height: 28px; flex: none;
          border-radius: 50%;
          background: var(--surface-2);
          font-size: var(--fs-tiny); font-weight: 600;
          color: var(--text-3);
        }
        .fr-rank[data-leader='true'] {
          background: var(--ember-soft); color: var(--kiln-5);
        }
        .fr-name {
          display: flex; align-items: center; gap: 6px;
          font-size: var(--fs-sm); font-weight: 600;
        }
        .fr-you {
          font-family: var(--font-display);
          font-size: 9px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--ember);
        }
        .fr-unit {
          display: block;
          font-family: var(--font-display);
          font-size: var(--fs-micro); font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--text-3);
        }
        .fr-value {
          flex: none; font-size: var(--fs-lg); font-weight: 600;
        }
        .fr-del {
          display: grid; place-items: center;
          width: 34px; height: 34px; flex: none;
          border-radius: var(--r-sm); color: var(--text-3);
        }
        .fr-del:hover { background: var(--critical-soft); color: var(--critical); }
        .fr-note {
          margin-top: var(--s-5);
          font-size: var(--fs-tiny); color: var(--text-3); line-height: 1.5;
        }
      `}</style>
    </div>
  )
}

/* ------------------------------- add friend ------------------------------- */

function AddFriendSheet({ onClose }: { onClose: () => void }) {
  const { t } = useT()
  const { data, actions } = useStore()
  const toast = useToast()

  const [name, setName] = useState('')
  const [streak, setStreak] = useState(0)
  const [workouts, setWorkouts] = useState(0)
  const [steps, setSteps] = useState(0)
  const [achievements, setAchievements] = useState(0)
  const [error, setError] = useState<string | null>(null)

  function add() {
    if (!name.trim()) {
      setError("Add their name so you can tell the rows apart.")
      return
    }
    actions.importData({
      ...data,
      friends: [
        ...data.friends,
        {
          id: `fr-${Date.now()}`,
          name: name.trim(),
          streak,
          workouts,
          steps,
          achievements,
        },
      ],
    })
    toast.show(`${name.trim()} added to the board`, { tone: 'good' })
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={t('fr.add')}
      tall
      footer={
        <button type="button" className="btn btn--primary btn--block btn--lg" onClick={add}>
          {t('common.add')}
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
            placeholder="Arun"
            aria-invalid={!!error}
            maxLength={24}
          />
          {error && (
            <span className="field__error" role="alert">
              {error}
            </span>
          )}
        </label>

        <p className="field__hint" style={{ marginTop: 0 }}>
          Enter the numbers they tell you. There is no sync in this version, so these stay exactly as
          you type them until you edit them.
        </p>

        <div className="grid-2">
          <Stepper label="Streak" unit="days" min={0} max={1000} value={streak} onChange={setStreak} />
          <Stepper
            label="Workouts"
            unit="total"
            min={0}
            max={5000}
            value={workouts}
            onChange={setWorkouts}
          />
          <Stepper
            label="Steps"
            unit="this week"
            step={1000}
            min={0}
            max={500000}
            value={steps}
            onChange={setSteps}
          />
          <Stepper
            label="Badges"
            min={0}
            max={100}
            value={achievements}
            onChange={setAchievements}
          />
        </div>
      </div>
    </Sheet>
  )
}
