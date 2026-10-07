/* ============================================================================
   More. The index for everything that isn't a daily tab, grouped by what it is
   for — tracking, progress, system. Three short groups beat one long list.
   ========================================================================= */

import {
  Bed,
  BarChart3,
  CalendarDays,
  Camera,
  CheckSquare,
  Flag,
  Footprints,
  Info,
  Layers,
  ListChecks,
  Medal,
  MessageSquare,
  Pill,
  ScrollText,
  Scale,
  Settings,
  Sparkles,
  Target,
  Trophy,
  Users,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { useT } from '../lib/i18n'
import { dayTotals } from '../lib/calc'
import { today } from '../lib/date'
import { ScreenHeader } from '../components/ui'
import { NavRow } from './Workout'

export function More() {
  const { t } = useT()
  const { data } = useStore()
  const totals = dayTotals(data, today())

  return (
    <div className="shell">
      <ScreenHeader title={t('more.title')} />

      <div className="eyebrow">{t('more.tracking')}</div>
      <div className="card card--flush">
        <NavRow to="/weight" icon={<Scale size={17} aria-hidden="true" />} title={t('weight.title')} />
        <div className="divider" />
        <NavRow
          to="/cardio"
          icon={<Footprints size={17} aria-hidden="true" />}
          title={t('cardio.title')}
        />
        <div className="divider" />
        <NavRow to="/sleep" icon={<Bed size={17} aria-hidden="true" />} title={t('sleep.title')} />
        <div className="divider" />
        <NavRow
          to="/check-in"
          icon={<CheckSquare size={17} aria-hidden="true" />}
          title={t('ci.title')}
          meta={totals.checkIn ? t('ci.done') : undefined}
        />
        <div className="divider" />
        <NavRow
          to="/habits"
          icon={<ListChecks size={17} aria-hidden="true" />}
          title={t('habits.title')}
          meta={`${totals.habitsDone} of ${totals.habitsTotal} today`}
        />
        <div className="divider" />
        <NavRow
          to="/supplements"
          icon={<Pill size={17} aria-hidden="true" />}
          title={t('supp.title')}
        />
      </div>

      <div className="eyebrow">{t('more.progress')}</div>
      <div className="card card--flush">
        <NavRow to="/photos" icon={<Camera size={17} aria-hidden="true" />} title={t('photos.title')} />
        <div className="divider" />
        <NavRow to="/analytics" icon={<BarChart3 size={17} aria-hidden="true" />} title={t('an.title')} />
        <div className="divider" />
        <NavRow to="/review" icon={<Sparkles size={17} aria-hidden="true" />} title={t('rev.title')} />
        <div className="divider" />
        <NavRow to="/timeline" icon={<ScrollText size={17} aria-hidden="true" />} title={t('tl.title')} />
        <div className="divider" />
        <NavRow to="/calendar" icon={<CalendarDays size={17} aria-hidden="true" />} title={t('cal.title')} />
        <div className="divider" />
        <NavRow to="/goals" icon={<Target size={17} aria-hidden="true" />} title={t('goals.title')} />
        <div className="divider" />
        <NavRow to="/challenges" icon={<Flag size={17} aria-hidden="true" />} title={t('ch.title')} />
        <div className="divider" />
        <NavRow to="/records" icon={<Trophy size={17} aria-hidden="true" />} title={t('pr.title')} />
        <div className="divider" />
        <NavRow
          to="/achievements"
          icon={<Medal size={17} aria-hidden="true" />}
          title={t('ach.title')}
          meta={`${Object.keys(data.achievements).length} unlocked`}
        />
        <div className="divider" />
        <NavRow to="/phases" icon={<Layers size={17} aria-hidden="true" />} title={t('set.phases')} />
      </div>

      <div className="eyebrow">{t('more.system')}</div>
      <div className="card card--flush">
        <NavRow
          to="/coach"
          icon={<MessageSquare size={17} aria-hidden="true" />}
          title={t('coach.title')}
          meta="Answers read from your own log"
        />
        <div className="divider" />
        <NavRow
          to="/friends"
          icon={<Users size={17} aria-hidden="true" />}
          title={t('fr.title')}
          meta={t('fr.privacy')}
        />
        <div className="divider" />
        <NavRow to="/settings" icon={<Settings size={17} aria-hidden="true" />} title={t('set.title')} />
      </div>

      <p className="mo-about">
        <Info size={13} aria-hidden="true" />
        Everything you log stays on this device. Save a backup from Settings so a lost phone does not
        lose the journey.
      </p>

      <style>{`
        .mo-about {
          display: flex; align-items: flex-start; gap: 6px;
          margin-top: var(--s-6);
          font-size: var(--fs-tiny); color: var(--text-3);
          line-height: 1.5;
        }
      `}</style>
    </div>
  )
}
