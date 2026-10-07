/* ============================================================================
   Navigation. Five top-level destinations, as the brief specifies.

   Below 1024px: a bottom tab bar with icon + label (never icon-only — an
   unlabelled nav is guesswork). At 1024px and up the same five become a side
   rail, because a bottom bar on a desktop monitor is a phone emulator, not a
   design. The content column keeps its phone measure either way so line length
   stays readable.
   ========================================================================= */

import { NavLink } from 'react-router-dom'
import { Dumbbell, Home, LayoutGrid, Salad, TrendingUp } from 'lucide-react'
import { useT } from '../lib/i18n'

const TABS = [
  { to: '/', key: 'nav.home', Icon: Home },
  { to: '/workout', key: 'nav.workout', Icon: Dumbbell },
  { to: '/nutrition', key: 'nav.nutrition', Icon: Salad },
  { to: '/progress', key: 'nav.progress', Icon: TrendingUp },
  { to: '/more', key: 'nav.more', Icon: LayoutGrid },
] as const

export function TabBar() {
  const { t } = useT()
  return (
    <nav className="tabs" aria-label="Main">
      <ul className="tabs__list">
        {TABS.map(({ to, key, Icon }) => (
          <li key={to} className="tabs__item">
            <NavLink to={to} end={to === '/'} className="tabs__link">
              {({ isActive }) => (
                <>
                  <span className="tabs__mark" data-on={isActive} aria-hidden="true" />
                  <Icon size={21} strokeWidth={isActive ? 2.4 : 1.9} aria-hidden="true" />
                  <span className="tabs__label">{t(key)}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>

      <style>{`
        .tabs {
          position: fixed; left: 0; right: 0; bottom: 0;
          z-index: var(--z-tabbar);
          background: color-mix(in srgb, var(--ink) 92%, transparent);
          backdrop-filter: blur(14px);
          border-top: 1px solid var(--hairline);
          padding-bottom: var(--safe-b);
        }
        .tabs__list {
          display: flex;
          max-width: var(--col); margin-inline: auto;
        }
        .tabs__item { flex: 1; }
        .tabs__link {
          position: relative;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 3px;
          height: var(--tabbar-h);
          color: var(--text-3);
          transition: color var(--t-fast) var(--ease-out);
        }
        .tabs__link:hover { color: var(--text-2); }
        .tabs__link.active { color: var(--ember); }
        .tabs__label {
          font-family: var(--font-display);
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.05em;
        }
        /* the active marker is a short ember bar riding the top edge — reads as
           a hot element on the rail, which is the app's whole metaphor */
        .tabs__mark {
          position: absolute; top: -1px;
          width: 26px; height: 2px; border-radius: 0 0 2px 2px;
          background: var(--ember);
          opacity: 0; transform: scaleX(0.3);
          transition: opacity var(--t-mid) var(--ease-out), transform var(--t-mid) var(--ease-spring);
        }
        .tabs__mark[data-on='true'] { opacity: 1; transform: none; }

        @media (min-width: 1024px) { .tabs { display: none; } }
      `}</style>
    </nav>
  )
}

export function SideRail() {
  const { t } = useT()
  return (
    <nav className="rail" aria-label="Main">
      <div className="rail__brand">
        <svg viewBox="0 0 64 64" width="30" height="30" aria-hidden="true">
          <circle cx="32" cy="32" r="19" fill="none" stroke="var(--hairline)" strokeWidth="6" />
          <path
            d="M32 13a19 19 0 0 1 16.45 28.5"
            fill="none"
            stroke="var(--kiln-4)"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <circle cx="32" cy="32" r="6" fill="var(--ember)" />
        </svg>
        <span className="rail__name">{t('app.name')}</span>
      </div>
      <ul>
        {TABS.map(({ to, key, Icon }) => (
          <li key={to}>
            <NavLink to={to} end={to === '/'} className="rail__link">
              <Icon size={19} strokeWidth={1.9} aria-hidden="true" />
              <span>{t(key)}</span>
            </NavLink>
          </li>
        ))}
      </ul>

      <style>{`
        .rail { display: none; }
        @media (min-width: 1024px) {
          .rail {
            display: flex; flex-direction: column; gap: var(--s-2);
            width: var(--rail); flex: none;
            padding: var(--s-6) var(--s-3);
            border-right: 1px solid var(--hairline);
            position: sticky; top: 0; height: 100dvh;
          }
          .rail__brand {
            display: flex; align-items: center; gap: var(--s-2);
            padding: 0 var(--s-2) var(--s-5);
          }
          .rail__name {
            font-family: var(--font-display);
            font-size: var(--fs-lg); font-weight: 800;
            letter-spacing: var(--tr-display);
          }
          .rail__link {
            display: flex; align-items: center; gap: var(--s-3);
            min-height: 46px; padding: 0 var(--s-3);
            border-radius: var(--r-md);
            font-size: var(--fs-sm); font-weight: 600;
            color: var(--text-2);
            transition: background-color var(--t-fast) var(--ease-out), color var(--t-fast) var(--ease-out);
          }
          .rail__link:hover { background: var(--surface-2); color: var(--text-1); }
          .rail__link.active {
            background: var(--ember-soft); color: var(--ember);
          }
        }
      `}</style>
    </nav>
  )
}
