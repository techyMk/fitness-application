/* ============================================================================
   Achievements. Unlocked first, locked below with their hint visible — a locked
   badge whose requirement is hidden is just a tease, and the hint is what turns
   it into a next step.
   ========================================================================= */

import { useMemo } from 'react'
import { Lock, Medal } from 'lucide-react'
import { ACHIEVEMENTS } from '../data/achievements'
import { useStore } from '../lib/store'
import { useT } from '../lib/i18n'
import { fmtDate } from '../lib/date'
import { Meter, ScreenHeader, Stat } from '../components/ui'

const TIER_COLOUR: Record<string, string> = {
  bronze: 'var(--kiln-2)',
  silver: 'var(--kiln-3)',
  gold: 'var(--kiln-5)',
}

export default function Achievements() {
  const { t, locale } = useT()
  const { data } = useStore()

  const { unlocked, locked } = useMemo(() => {
    const u = ACHIEVEMENTS.filter((a) => data.achievements[a.id]).sort((a, b) =>
      data.achievements[a.id] < data.achievements[b.id] ? 1 : -1,
    )
    const l = ACHIEVEMENTS.filter((a) => !data.achievements[a.id])
    return { unlocked: u, locked: l }
  }, [data.achievements])

  const pct = (unlocked.length / ACHIEVEMENTS.length) * 100

  return (
    <div className="shell">
      <ScreenHeader title={t('ach.title')} back={true} />

      <section className="card" style={{ marginTop: 'var(--s-4)' }}>
        <div className="grid-2">
          <Stat
            label={t('ach.unlocked')}
            value={`${unlocked.length} / ${ACHIEVEMENTS.length}`}
            size="lg"
            tone="ember"
          />
          <Stat label="Gold" value={unlocked.filter((a) => a.tier === 'gold').length} size="lg" />
        </div>
        <div style={{ marginTop: 'var(--s-4)' }}>
          <Meter value={pct} max={100} label="Achievements unlocked" showOver={false} />
        </div>
      </section>

      {unlocked.length > 0 && (
        <>
          <div className="eyebrow">
            {t('ach.unlocked')}
            <span className="eyebrow__action num">{unlocked.length}</span>
          </div>
          <ul className="ac-grid">
            {unlocked.map((a) => (
              <li key={a.id}>
                <article className="ac-badge" data-tier={a.tier}>
                  <span className="ac-medal" style={{ color: TIER_COLOUR[a.tier] }}>
                    <Medal size={22} aria-hidden="true" />
                  </span>
                  <p className="ac-name">{a.name}</p>
                  <p className="ac-when num">
                    {t('ach.on', { date: fmtDate(data.achievements[a.id], locale) })}
                  </p>
                </article>
              </li>
            ))}
          </ul>
        </>
      )}

      {locked.length > 0 && (
        <>
          <div className="eyebrow">
            {t('ach.locked')}
            <span className="eyebrow__action num">{locked.length}</span>
          </div>
          <ul className="card card--flush">
            {locked.map((a, i) => (
              <li key={a.id}>
                {i > 0 && <div className="divider" />}
                <div className="ac-locked">
                  <span className="ac-lockedIcon">
                    <Lock size={14} aria-hidden="true" />
                  </span>
                  <span className="grow">
                    <span className="ac-lockedName">{a.name}</span>
                    <span className="ac-lockedHint">{a.hint}</span>
                  </span>
                  <span className="ac-tier" style={{ color: TIER_COLOUR[a.tier] }}>
                    {a.tier}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <style>{`
        .ac-grid {
          display: grid; grid-template-columns: repeat(2, 1fr);
          gap: var(--s-3);
        }
        .ac-badge {
          display: flex; flex-direction: column;
          align-items: center; text-align: center; gap: 4px;
          padding: var(--s-4) var(--s-3);
          background: var(--surface-1);
          border: 1px solid var(--hairline);
          border-radius: var(--r-lg);
        }
        .ac-badge[data-tier='gold'] { border-color: var(--ember-line); }
        .ac-medal {
          display: grid; place-items: center;
          width: 44px; height: 44px;
          border-radius: 50%;
          background: var(--surface-2);
          margin-bottom: 2px;
        }
        .ac-name {
          font-family: var(--font-display);
          font-size: var(--fs-sm); font-weight: 700;
          letter-spacing: -0.01em; line-height: 1.2;
        }
        .ac-when { font-size: 10px; color: var(--text-3); }

        .ac-locked {
          display: flex; align-items: center; gap: var(--s-3);
          min-height: 56px; padding: var(--s-2) var(--s-4);
        }
        .ac-lockedIcon {
          display: grid; place-items: center;
          width: 30px; height: 30px; flex: none;
          border-radius: 50%;
          background: var(--surface-2); color: var(--text-3);
        }
        .ac-lockedName {
          display: block; font-size: var(--fs-sm); font-weight: 600;
          color: var(--text-2);
        }
        .ac-lockedHint { display: block; font-size: var(--fs-tiny); color: var(--text-3); }
        .ac-tier {
          flex: none;
          font-family: var(--font-display);
          font-size: 9px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
        }
      `}</style>
    </div>
  )
}
