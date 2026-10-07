/* ============================================================================
   Calendar. One cell per day, each cell carrying two layers of information:

   - The cell's BACKGROUND is the day's transformation score on the kiln ramp —
     the same encoding as the ring, so the month reads as a heat map of effort.
   - Small marks along the bottom say WHICH kinds of record exist that day.

   That split matters: colour answers "how was that day", marks answer "what did
   I log". Colour alone would be ambiguous, and marks alone would be flat.
   ========================================================================= */

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { dayScore, dayTotals } from '../lib/calc'
import { useStore } from '../lib/store'
import { useT } from '../lib/i18n'
import { fmtInt, makeFmt } from '../lib/units'
import {
  addDays,
  daysBetween,
  fmtDuration,
  fmtLongDate,
  fromKey,
  monthDays,
  monthStart,
  toKey,
  today,
} from '../lib/date'
import { kilnFor, ScreenHeader, Sheet, Stat } from '../components/ui'
import { ForgeLegend, ForgeRing } from '../components/ForgeRing'

const MARKS = [
  { key: 'workout', label: 'Workout', colour: 'var(--series-1)' },
  { key: 'food', label: 'Food', colour: 'var(--series-2)' },
  { key: 'sleep', label: 'Sleep', colour: 'var(--series-4)' },
  { key: 'checkin', label: 'Check-in', colour: 'var(--series-3)' },
  { key: 'photo', label: 'Photo', colour: 'var(--series-5)' },
  { key: 'pr', label: 'Record', colour: 'var(--kiln-5)' },
] as const

export default function Calendar() {
  const { t, locale } = useT()
  const { data } = useStore()
  const profile = data.profile!
  const fmt = useMemo(() => makeFmt(profile.units), [profile.units])

  const [cursor, setCursor] = useState(monthStart(today()))
  const [selected, setSelected] = useState<string | null>(null)

  const days = useMemo(() => monthDays(cursor), [cursor])
  const firstWeekday = (fromKey(days[0]).getDay() + 6) % 7 // Monday-start

  // Dates on which any PR was set, for the record mark.
  const prDates = useMemo(() => {
    const set = new Set<string>()
    for (const r of data.records) {
      set.add(r.bestWeightDate)
      set.add(r.best1rmDate)
      set.add(r.bestRepsDate)
    }
    return set
  }, [data.records])

  const monthLabel = fromKey(cursor).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  })

  const atCurrentMonth = cursor >= monthStart(today())

  return (
    <div className="shell">
      <ScreenHeader title={t('cal.title')} back="/progress" />

      <div className="cl-nav">
        <button
          type="button"
          className="icon-btn"
          aria-label="Previous month"
          onClick={() => setCursor(monthStart(addDays(cursor, -1)))}
        >
          <ChevronLeft size={19} aria-hidden="true" />
        </button>
        <span className="cl-month">{monthLabel}</span>
        <button
          type="button"
          className="icon-btn"
          aria-label="Next month"
          disabled={atCurrentMonth}
          style={{ opacity: atCurrentMonth ? 0.3 : 1 }}
          onClick={() => {
            const d = fromKey(cursor)
            setCursor(toKey(new Date(d.getFullYear(), d.getMonth() + 1, 1)))
          }}
        >
          <ChevronRight size={19} aria-hidden="true" />
        </button>
      </div>

      <div className="cl-grid" role="grid" aria-label={`${monthLabel} activity`}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i} className="cl-head" role="columnheader">
            {d}
          </span>
        ))}

        {Array.from({ length: firstWeekday }, (_, i) => (
          <span key={`pad-${i}`} aria-hidden="true" />
        ))}

        {days.map((date) => {
          const future = date > today()
          const totals = dayTotals(data, date)
          const score = future ? 0 : dayScore(data, date).total
          const empty =
            future ||
            (totals.calories === 0 &&
              totals.workouts === 0 &&
              totals.steps === 0 &&
              totals.sleepMinutes === 0 &&
              !totals.checkIn)

          const marks = [
            totals.workouts > 0 && 'workout',
            totals.calories > 0 && 'food',
            totals.sleepMinutes > 0 && 'sleep',
            !!totals.checkIn && 'checkin',
            totals.photos > 0 && 'photo',
            prDates.has(date) && 'pr',
          ].filter(Boolean) as string[]

          const isToday = date === today()

          return (
            <button
              key={date}
              type="button"
              role="gridcell"
              className="cl-cell"
              data-today={isToday}
              data-empty={empty}
              disabled={future}
              aria-label={`${fmtLongDate(date, locale)}, score ${score} of 100, ${
                marks.length ? marks.join(', ') : 'nothing logged'
              }`}
              onClick={() => setSelected(date)}
              style={{
                background: empty ? 'var(--surface-inset)' : kilnFor(score / 100),
                opacity: future ? 0.25 : 1,
              }}
            >
              <span className="cl-num num" data-light={!empty && score >= 55}>
                {fromKey(date).getDate()}
              </span>
              <span className="cl-marks" aria-hidden="true">
                {MARKS.filter((m) => marks.includes(m.key)).map((m) => (
                  <span key={m.key} className="cl-mark" style={{ background: m.colour }} />
                ))}
              </span>
            </button>
          )
        })}
      </div>

      {/* The legend is mandatory: the cells encode two things by colour. */}
      <div className="eyebrow">{t('cal.legend')}</div>
      <div className="card">
        <p className="cl-legendNote">
          Cell colour is the day's transformation score, cold to hot. The dots say what you logged.
        </p>
        <ul className="cl-legend">
          {MARKS.map((m) => (
            <li key={m.key}>
              <span className="cl-legendDot" style={{ background: m.colour }} />
              {m.label}
            </li>
          ))}
        </ul>
        <div className="cl-ramp" aria-hidden="true">
          <span className="t-micro dim">Cold</span>
          <span className="cl-rampBar">
            {[0.1, 0.3, 0.6, 0.8, 1].map((r) => (
              <span key={r} style={{ background: kilnFor(r) }} />
            ))}
          </span>
          <span className="t-micro dim">Hot</span>
        </div>
      </div>

      {selected && (
        <DaySheet date={selected} fmt={fmt} onClose={() => setSelected(null)} />
      )}

      <style>{`
        .cl-nav {
          display: flex; align-items: center; justify-content: center;
          gap: var(--s-3); padding: var(--s-4) 0 var(--s-3);
        }
        .cl-month {
          min-width: 10rem; text-align: center;
          font-family: var(--font-display);
          font-size: var(--fs-base); font-weight: 700;
          letter-spacing: var(--tr-display);
        }
        .cl-grid {
          display: grid; grid-template-columns: repeat(7, 1fr);
          gap: 4px;
        }
        .cl-head {
          text-align: center; padding-bottom: var(--s-2);
          font-family: var(--font-display);
          font-size: var(--fs-micro); font-weight: 700;
          letter-spacing: 0.1em; color: var(--text-3);
        }
        .cl-cell {
          position: relative;
          aspect-ratio: 1;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 3px;
          border: 1px solid transparent;
          border-radius: var(--r-sm);
          transition: outline-color var(--t-fast) var(--ease-out);
        }
        .cl-cell[data-empty='true'] { border-color: var(--hairline); }
        .cl-cell[data-today='true'] {
          outline: 2px solid var(--ember);
          outline-offset: 1px;
        }
        .cl-cell:disabled { cursor: default; }
        .cl-num {
          font-size: var(--fs-tiny); font-weight: 500;
          color: var(--text-2);
        }
        /* On the hot end of the ramp the fill is light, so flip the numeral to
           keep contrast rather than hoping one colour works on all five steps. */
        .cl-num[data-light='true'] { color: #14100e; font-weight: 600; }
        .cl-marks {
          display: flex; gap: 2px; height: 4px;
        }
        .cl-mark { width: 4px; height: 4px; border-radius: 50%; }

        .cl-legendNote {
          font-size: var(--fs-tiny); color: var(--text-2);
          line-height: 1.5; margin-bottom: var(--s-3);
        }
        .cl-legend {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: var(--s-2) var(--s-4);
        }
        .cl-legend li {
          display: flex; align-items: center; gap: 7px;
          font-size: var(--fs-tiny); color: var(--text-2);
        }
        .cl-legendDot { width: 7px; height: 7px; border-radius: 50%; flex: none; }
        .cl-ramp {
          display: flex; align-items: center; gap: var(--s-2);
          margin-top: var(--s-4); padding-top: var(--s-3);
          border-top: 1px solid var(--hairline);
        }
        .cl-rampBar { display: flex; flex: 1; height: 7px; border-radius: var(--r-pill); overflow: hidden; }
        .cl-rampBar > span { flex: 1; }
      `}</style>
    </div>
  )
}

/* ------------------------------- day detail ------------------------------- */

function DaySheet({
  date,
  fmt,
  onClose,
}: {
  date: string
  fmt: ReturnType<typeof makeFmt>
  onClose: () => void
}) {
  const { t, locale } = useT()
  const { data } = useStore()
  const profile = data.profile!

  const totals = dayTotals(data, date)
  const score = dayScore(data, date)
  const [seg, setSeg] = useState<Parameters<typeof ForgeLegend>[0]['activeKey']>(null)

  const sessions = data.sessions.filter((s) => s.date === date && s.completed)
  const meals = data.meals.filter((m) => m.date === date)
  const cardio = data.cardio.filter((c) => c.date === date)
  const challenge = data.challenges.find((c) => date >= c.startDate && date <= c.endDate)

  const nothing =
    totals.calories === 0 &&
    totals.workouts === 0 &&
    totals.steps === 0 &&
    totals.sleepMinutes === 0 &&
    !totals.checkIn &&
    totals.photos === 0

  return (
    <Sheet open onClose={onClose} title={fmtLongDate(date, locale)} tall>
      {nothing ? (
        <p className="ds-none">{t('cal.noRecord')}</p>
      ) : (
        <>
          <div className="ds-ring">
            <ForgeRing score={score} size={160} activeKey={seg} onSelect={setSeg} />
          </div>
          <ForgeLegend score={score} activeKey={seg} onSelect={setSeg} />

          {challenge && (
            <p className="ds-challenge num">
              {challenge.name} · Day {daysBetween(challenge.startDate, date) + 1} / {challenge.days}
            </p>
          )}

          <div className="eyebrow">Numbers</div>
          <div className="grid-2">
            {totals.weightKg != null && (
              <Stat
                label={t('weight.title')}
                value={fmt.weight(totals.weightKg)}
                unit={fmt.weightUnit}
                size="md"
              />
            )}
            {totals.calories > 0 && (
              <Stat
                label={t('nutri.calories')}
                value={fmtInt(totals.calories, locale)}
                unit="kcal"
                size="md"
                hint={`of ${fmtInt(profile.targets.calories, locale)}`}
              />
            )}
            {totals.protein > 0 && (
              <Stat
                label={t('nutri.protein')}
                value={totals.protein}
                unit="g"
                size="md"
                hint={`of ${profile.targets.protein} g`}
              />
            )}
            {totals.steps > 0 && (
              <Stat label={t('cardio.steps')} value={fmtInt(totals.steps, locale)} size="md" />
            )}
            {totals.sleepMinutes > 0 && (
              <Stat label={t('home.sleep')} value={fmtDuration(totals.sleepMinutes)} size="md" />
            )}
            {totals.volumeKg > 0 && (
              <Stat
                label={t('wk.volume')}
                value={fmtInt(totals.volumeKg, locale)}
                unit={fmt.weightUnit}
                size="md"
              />
            )}
          </div>

          {sessions.length > 0 && (
            <>
              <div className="eyebrow">{t('home.training')}</div>
              <ul className="ds-list">
                {sessions.map((s) => (
                  <li key={s.id} className="ds-row">
                    <span className="grow truncate">{s.title}</span>
                    <span className="num ds-rowVal">
                      {s.sets.length} sets
                      {s.durationSec ? ` · ${fmtDuration(s.durationSec / 60)}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {meals.length > 0 && (
            <>
              <div className="eyebrow">{t('nutri.title')}</div>
              <ul className="ds-list">
                {meals.map((m) => {
                  const kcal = m.items.reduce((a, i) => a + i.calories * i.qty, 0)
                  return (
                    <li key={m.id} className="ds-row">
                      <span className="grow">
                        <span className="ds-mealType">{t(`nutri.${m.type}`)}</span>
                        <span className="ds-mealItems truncate">
                          {m.items.map((i) => i.name).join(', ')}
                        </span>
                      </span>
                      <span className="num ds-rowVal">{Math.round(kcal)} kcal</span>
                    </li>
                  )
                })}
              </ul>
            </>
          )}

          {cardio.length > 0 && (
            <>
              <div className="eyebrow">{t('cardio.title')}</div>
              <ul className="ds-list">
                {cardio.map((c) => (
                  <li key={c.id} className="ds-row">
                    <span className="grow">{t(`cardio.${c.type}`)}</span>
                    <span className="num ds-rowVal">
                      {fmtDuration(c.minutes)}
                      {c.distanceKm ? ` · ${fmt.distanceLabel(c.distanceKm)}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {totals.checkIn && (
            <>
              <div className="eyebrow">{t('ci.title')}</div>
              <div className="grid-2">
                {totals.checkIn.energy && (
                  <Stat label={t('ci.energy')} value={`${totals.checkIn.energy}/5`} size="sm" />
                )}
                {totals.checkIn.hunger && (
                  <Stat label={t('ci.hunger')} value={`${totals.checkIn.hunger}/5`} size="sm" />
                )}
                {totals.checkIn.cravings && (
                  <Stat label={t('ci.cravings')} value={`${totals.checkIn.cravings}/5`} size="sm" />
                )}
                {totals.checkIn.mood && (
                  <Stat label={t('ci.mood')} value={`${totals.checkIn.mood}/5`} size="sm" />
                )}
              </div>
              {totals.checkIn.note && <p className="ds-note">“{totals.checkIn.note}”</p>}
            </>
          )}
        </>
      )}

      <style>{`
        .ds-none { font-size: var(--fs-sm); color: var(--text-3); padding: var(--s-6) 0; text-align: center; }
        .ds-ring { display: grid; place-items: center; padding: var(--s-3) 0 var(--s-4); }
        .ds-challenge {
          margin-top: var(--s-4); padding: var(--s-2) var(--s-3);
          background: var(--ember-soft);
          border-radius: var(--r-sm);
          font-size: var(--fs-tiny); color: var(--ember);
          text-align: center;
        }
        .ds-list { display: flex; flex-direction: column; }
        .ds-row {
          display: flex; align-items: center; gap: var(--s-3);
          min-height: 44px;
          border-bottom: 1px solid var(--hairline);
          font-size: var(--fs-sm);
        }
        .ds-rowVal { flex: none; font-size: var(--fs-tiny); color: var(--text-3); }
        .ds-mealType {
          display: block;
          font-family: var(--font-display);
          font-size: var(--fs-micro); font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--text-3);
        }
        .ds-mealItems { display: block; font-size: var(--fs-tiny); color: var(--text-2); }
        .ds-note {
          margin-top: var(--s-3); padding: var(--s-3);
          background: var(--surface-2);
          border-radius: var(--r-sm);
          font-size: var(--fs-sm); color: var(--text-2);
          font-style: italic; line-height: 1.5;
        }
      `}</style>
    </Sheet>
  )
}
