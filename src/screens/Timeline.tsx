/* ============================================================================
   Transformation timeline. Every meaningful event on one thread, newest first.

   The vertical rule down the left is the one place in this app where a line
   between items earns its keep: these events ARE a sequence, and the thread shows
   that the journey is continuous even on days nothing happened.
   ========================================================================= */

import { useMemo } from 'react'
import {
  Camera,
  Flag,
  Medal,
  Scale,
  ScrollText,
  Target,
  Trophy,
  Dumbbell,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { useT } from '../lib/i18n'
import { fmtDelta, fmtInt, makeFmt } from '../lib/units'
import { daysBetween, fmtDate, fmtDuration } from '../lib/date'
import { SEED_EXERCISES } from '../data/exercises'
import { ACHIEVEMENTS } from '../data/achievements'
import { Empty, ScreenHeader } from '../components/ui'

type Kind = 'weight' | 'workout' | 'pr' | 'photo' | 'achievement' | 'challenge' | 'goal'

interface Event {
  date: string
  kind: Kind
  title: string
  meta?: string
  accent?: boolean
}

const ICONS: Record<Kind, typeof Scale> = {
  weight: Scale,
  workout: Dumbbell,
  pr: Trophy,
  photo: Camera,
  achievement: Medal,
  challenge: Flag,
  goal: Target,
}

export default function Timeline() {
  const { t, locale } = useT()
  const { data } = useStore()
  const profile = data.profile!
  const fmt = useMemo(() => makeFmt(profile.units), [profile.units])

  const events = useMemo<Event[]>(() => {
    const out: Event[] = []
    const nameOf = (id: string) =>
      [...SEED_EXERCISES, ...data.customExercises].find((e) => e.id === id)?.name ?? id

    // Weight: only the entries that moved the needle, so the thread isn't 200
    // near-identical weigh-ins. Every 1 kg of net change from the start.
    const sorted = [...data.weights].sort((a, b) => (a.date < b.date ? -1 : 1))
    let lastMilestone = profile.startWeightKg
    for (const w of sorted) {
      if (Math.abs(w.kg - lastMilestone) >= 1) {
        const net = w.kg - profile.startWeightKg
        out.push({
          date: w.date,
          kind: 'weight',
          title: `${fmt.weightLabel(w.kg)}`,
          meta: `${fmtDelta(Number(fmt.weight(net, 1)))} ${fmt.weightUnit} from the start`,
        })
        lastMilestone = w.kg
      }
    }
    if (sorted.length) {
      out.push({
        date: sorted[0].date,
        kind: 'weight',
        title: `Started at ${fmt.weightLabel(sorted[0].kg)}`,
        meta: 'Day one',
        accent: true,
      })
    }

    for (const s of data.sessions) {
      if (!s.completed) continue
      out.push({
        date: s.date,
        kind: 'workout',
        title: s.title,
        meta: `${s.sets.length} sets · ${fmtInt(s.volumeKg, locale)} ${fmt.weightUnit}${
          s.durationSec ? ` · ${fmtDuration(s.durationSec / 60)}` : ''
        }`,
      })
    }

    for (const r of data.records) {
      out.push({
        date: r.bestWeightDate,
        kind: 'pr',
        title: `${nameOf(r.exerciseId)} record`,
        meta: `${fmt.weightLabel(r.bestWeightKg)} × ${r.bestWeightReps}`,
        accent: true,
      })
    }

    for (const p of data.photos) {
      out.push({
        date: p.date,
        kind: 'photo',
        title: `${t(`photos.${p.angle}`)} photo`,
        meta: p.weightKg ? fmt.weightLabel(p.weightKg) : undefined,
      })
    }

    for (const [id, date] of Object.entries(data.achievements)) {
      const def = ACHIEVEMENTS.find((a) => a.id === id)
      if (!def) continue
      out.push({ date, kind: 'achievement', title: def.name, meta: def.hint, accent: true })
    }

    for (const c of data.challenges) {
      out.push({
        date: c.startDate,
        kind: 'challenge',
        title: `${c.name} started`,
        meta: `${c.days} days`,
        accent: true,
      })
      if (c.completedAt) {
        out.push({
          date: c.completedAt,
          kind: 'challenge',
          title: `${c.name} complete`,
          meta: `${c.days} days finished`,
          accent: true,
        })
      }
    }

    for (const g of data.goals) {
      out.push({ date: g.startDate, kind: 'goal', title: `Goal set: ${g.label}`, meta: g.deadline ? `by ${fmtDate(g.deadline, locale)}` : undefined })
      if (g.completedAt) {
        out.push({ date: g.completedAt, kind: 'goal', title: `Goal reached: ${g.label}`, accent: true })
      }
    }

    return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  }, [data, fmt, locale, profile.startWeightKg, t])

  // Group by date so one day's events share a single date header.
  const grouped = useMemo(() => {
    const map = new Map<string, Event[]>()
    for (const e of events) {
      const list = map.get(e.date) ?? []
      list.push(e)
      map.set(e.date, list)
    }
    return [...map.entries()]
  }, [events])

  return (
    <div className="shell">
      <ScreenHeader
        title={t('tl.title')}
        subtitle={`${events.length} events since ${fmtDate(profile.createdAt, locale)}`}
        back={true}
      />

      {events.length === 0 ? (
        <Empty
          icon={<ScrollText size={26} aria-hidden="true" />}
          title={t('tl.empty')}
          body={t('tl.empty.body')}
        />
      ) : (
        <ol className="tl" style={{ marginTop: 'var(--s-4)' }}>
          {grouped.map(([date, items]) => (
            <li key={date} className="tl-day">
              <div className="tl-dayHead">
                <span className="tl-dayDate num">{fmtDate(date, locale)}</span>
                <span className="tl-dayNum num">
                  Day {daysBetween(profile.createdAt, date) + 1}
                </span>
              </div>

              <ul className="tl-items">
                {items.map((e, i) => {
                  const Icon = ICONS[e.kind]
                  return (
                    <li key={i} className="tl-item">
                      <span
                        className="tl-dot"
                        data-accent={e.accent}
                        aria-hidden="true"
                      >
                        <Icon size={12} strokeWidth={2.2} />
                      </span>
                      <span className="grow">
                        <span className="tl-title">{e.title}</span>
                        {e.meta && <span className="tl-meta num">{e.meta}</span>}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ol>
      )}

      <style>{`
        .tl { position: relative; }
        .tl-day { position: relative; padding-bottom: var(--s-5); }
        .tl-dayHead {
          display: flex; align-items: baseline; gap: var(--s-2);
          margin-bottom: var(--s-3);
        }
        .tl-dayDate {
          font-family: var(--font-display);
          font-size: var(--fs-sm); font-weight: 700;
          letter-spacing: 0.02em;
        }
        .tl-dayNum {
          font-size: var(--fs-micro); color: var(--text-3);
          letter-spacing: 0.06em; text-transform: uppercase;
        }
        .tl-items {
          display: flex; flex-direction: column; gap: var(--s-3);
          padding-left: var(--s-3);
          border-left: 1px solid var(--hairline);
        }
        .tl-item {
          display: flex; align-items: flex-start; gap: var(--s-3);
          position: relative;
        }
        .tl-dot {
          display: grid; place-items: center;
          width: 26px; height: 26px; flex: none;
          margin-left: calc(var(--s-3) * -1 - 13px);
          border-radius: 50%;
          background: var(--surface-2);
          border: 1px solid var(--hairline);
          color: var(--text-3);
        }
        .tl-dot[data-accent='true'] {
          background: var(--ember-soft);
          border-color: var(--ember-line);
          color: var(--kiln-4);
        }
        .tl-title {
          display: block;
          font-size: var(--fs-sm); font-weight: 600;
          line-height: 1.35;
        }
        .tl-meta { display: block; font-size: var(--fs-tiny); color: var(--text-3); }
      `}</style>
    </div>
  )
}
