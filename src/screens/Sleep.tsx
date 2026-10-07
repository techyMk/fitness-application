/* ============================================================================
   Sleep. Two time fields and a quality tap. Duration is derived, including the
   midnight wrap — nobody should have to work out that 22:45 to 06:15 is 7h 30m.
   ========================================================================= */

import { useMemo, useState } from 'react'
import { Bed, Moon, Plus, Sun, Trash2 } from 'lucide-react'
import { averageOf } from '../lib/calc'
import { useStore } from '../lib/store'
import { useT } from '../lib/i18n'
import { addDays, fmtDate, fmtDuration, fmtWeekday, lastNDays, sleepMinutes, today } from '../lib/date'
import { BarChart } from '../components/charts'
import {
  ConfirmSheet,
  Empty,
  Meter,
  Scale,
  ScreenHeader,
  Sheet,
  Stat,
  useToast,
} from '../components/ui'

export default function Sleep() {
  const { t, locale } = useT()
  const { data, actions } = useStore()
  const toast = useToast()
  const profile = data.profile!
  const targetMin = profile.targets.sleepHours * 60

  const [sheet, setSheet] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const todayEntry = data.sleep.find((s) => s.date === today())
  const entries = useMemo(
    () => [...data.sleep].sort((a, b) => (a.date < b.date ? 1 : -1)),
    [data.sleep],
  )

  const week = useMemo(() => lastNDays(7), [])
  const points = week.map((d) => ({
    label: fmtWeekday(d, locale).slice(0, 2),
    value: (data.sleep.find((s) => s.date === d)?.minutes ?? 0) / 60,
  }))

  const weekAvg = averageOf(
    data.sleep.filter((s) => s.date >= addDays(today(), -6)).map((s) => s.minutes),
  )
  const monthAvg = averageOf(
    data.sleep.filter((s) => s.date >= addDays(today(), -29)).map((s) => s.minutes),
  )

  return (
    <div className="shell">
      <ScreenHeader
        title={t('sleep.title')}
        back="/more"
        action={
          <button
            type="button"
            className="icon-btn"
            aria-label={t('sleep.log')}
            onClick={() => setSheet(true)}
          >
            <Plus size={20} aria-hidden="true" />
          </button>
        }
      />

      {/* ----------------------------- last night -------------------------- */}
      <section className="card" style={{ marginTop: 'var(--s-4)' }} aria-labelledby="sl-last">
        <h2 id="sl-last" className="eyebrow" style={{ marginTop: 0 }}>
          Last night
        </h2>

        {todayEntry ? (
          <>
            <div className="sl-total">
              <span className="num sl-totalVal">{fmtDuration(todayEntry.minutes)}</span>
              <span className="sl-totalOf">/ {profile.targets.sleepHours}h target</span>
            </div>
            <Meter
              value={todayEntry.minutes}
              max={targetMin}
              label={`Sleep: ${fmtDuration(todayEntry.minutes)} of ${profile.targets.sleepHours} hours`}
              showOver={false}
            />
            <div className="sl-clock">
              <span className="sl-clockItem">
                <Moon size={13} aria-hidden="true" />
                <span className="num">{todayEntry.start}</span>
              </span>
              <span className="sl-clockLine" aria-hidden="true" />
              <span className="sl-clockItem">
                <Sun size={13} aria-hidden="true" />
                <span className="num">{todayEntry.wake}</span>
              </span>
            </div>
            <button
              type="button"
              className="btn btn--ghost btn--block"
              style={{ marginTop: 'var(--s-4)' }}
              onClick={() => setSheet(true)}
            >
              {t('common.edit')}
            </button>
          </>
        ) : (
          <Empty
            icon={<Bed size={26} aria-hidden="true" />}
            title="Nothing logged for today"
            body="Two taps when you wake up. The sleep input is 12% of your score."
            action={
              <button type="button" className="btn btn--primary" onClick={() => setSheet(true)}>
                <Plus size={15} aria-hidden="true" />
                {t('sleep.log')}
              </button>
            }
          />
        )}
      </section>

      {/* ------------------------------ averages --------------------------- */}
      {entries.length > 0 && (
        <>
          <div className="eyebrow">Averages</div>
          <section className="card">
            <div className="grid-2">
              <Stat
                label={t('sleep.avg')}
                value={weekAvg ? fmtDuration(weekAvg) : '—'}
                size="md"
                tone={weekAvg && weekAvg >= targetMin * 0.9 ? 'good' : 'warn'}
              />
              <Stat
                label="30-day average"
                value={monthAvg ? fmtDuration(monthAvg) : '—'}
                size="md"
              />
            </div>

            <div style={{ marginTop: 'var(--s-5)' }}>
              <BarChart
                points={points}
                target={profile.targets.sleepHours}
                seriesName="Hours slept"
                title="Last seven nights"
                unit="h"
                height={130}
              />
            </div>
          </section>

          {/* ------------------------------ history -------------------------- */}
          <div className="eyebrow">
            History
            <span className="eyebrow__action num">{entries.length}</span>
          </div>
          <ul className="card card--flush">
            {entries.slice(0, 40).map((s, i) => (
              <li key={s.id}>
                {i > 0 && <div className="divider" />}
                <div className="sl-row">
                  <span className="sl-rowDate">{fmtDate(s.date, locale)}</span>
                  <span className="num sl-rowClock">
                    {s.start} → {s.wake}
                  </span>
                  <span
                    className="num sl-rowDur"
                    style={{ color: s.minutes >= targetMin * 0.9 ? 'var(--good)' : 'var(--text-1)' }}
                  >
                    {fmtDuration(s.minutes)}
                  </span>
                  <button
                    type="button"
                    className="sl-del"
                    aria-label={`Delete sleep from ${fmtDate(s.date, locale)}`}
                    onClick={() => setDeleting(s.id)}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {sheet && <SleepSheet existing={todayEntry} onClose={() => setSheet(false)} />}

      <ConfirmSheet
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) actions.deleteSleep(deleting)
          toast.show('Entry deleted')
        }}
        title="Delete this night?"
        body="Your averages will recalculate without it."
      />

      <style>{`
        .sl-total { display: flex; align-items: baseline; gap: var(--s-2); margin: var(--s-3) 0; }
        .sl-totalVal {
          font-size: var(--fs-3xl); font-weight: 600; line-height: 1;
          letter-spacing: -0.03em;
        }
        .sl-totalOf { font-size: var(--fs-sm); color: var(--text-3); }
        .sl-clock {
          display: flex; align-items: center; gap: var(--s-3);
          margin-top: var(--s-4);
        }
        .sl-clockItem {
          display: flex; align-items: center; gap: 5px;
          font-size: var(--fs-sm); color: var(--text-2);
        }
        .sl-clockLine { flex: 1; height: 1px; background: var(--hairline); }

        .sl-row {
          display: flex; align-items: center; gap: var(--s-3);
          min-height: 50px; padding: 0 var(--s-2) 0 var(--s-4);
        }
        .sl-rowDate { width: 52px; flex: none; font-size: var(--fs-tiny); color: var(--text-3); }
        .sl-rowClock { flex: 1; font-size: var(--fs-tiny); color: var(--text-2); }
        .sl-rowDur { flex: none; font-size: var(--fs-sm); font-weight: 600; }
        .sl-del {
          display: grid; place-items: center;
          width: 36px; height: 36px; flex: none;
          border-radius: var(--r-sm); color: var(--text-3);
        }
        .sl-del:hover { background: var(--critical-soft); color: var(--critical); }
      `}</style>
    </div>
  )
}

/* ------------------------------- entry sheet ------------------------------ */

function SleepSheet({
  existing,
  onClose,
}: {
  existing?: { start: string; wake: string; quality?: 1 | 2 | 3 | 4 | 5 }
  onClose: () => void
}) {
  const { t } = useT()
  const { actions } = useStore()
  const toast = useToast()

  const [start, setStart] = useState(existing?.start ?? '23:00')
  const [wake, setWake] = useState(existing?.wake ?? '06:30')
  const [quality, setQuality] = useState<1 | 2 | 3 | 4 | 5 | undefined>(existing?.quality)
  const [date, setDate] = useState(today())

  const minutes = sleepMinutes(start, wake)

  return (
    <Sheet
      open
      onClose={onClose}
      title={t('sleep.log')}
      footer={
        <button
          type="button"
          className="btn btn--primary btn--block btn--lg"
          onClick={() => {
            actions.logSleep({ date, start, wake, minutes, quality })
            toast.show(`${fmtDuration(minutes)} logged`, { tone: 'good' })
            onClose()
          }}
        >
          {t('common.save')}
        </button>
      }
    >
      <div className="stack-4">
        <div className="grid-2">
          <label className="field">
            <span className="field__label">{t('sleep.start')}</span>
            <input
              className="input input--num"
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">{t('sleep.wake')}</span>
            <input
              className="input input--num"
              type="time"
              value={wake}
              onChange={(e) => setWake(e.target.value)}
            />
          </label>
        </div>

        <div className="card card--inset" style={{ padding: 'var(--s-4)', textAlign: 'center' }}>
          <span className="t-micro dim">{t('sleep.total')}</span>
          <p
            className="num"
            style={{ fontSize: 'var(--fs-2xl)', fontWeight: 600, marginTop: 4, color: 'var(--ember)' }}
          >
            {fmtDuration(minutes)}
          </p>
        </div>

        <Scale
          label={t('sleep.quality')}
          value={quality}
          onChange={setQuality}
          lowLabel="Terrible"
          highLabel="Excellent"
        />

        <label className="field">
          <span className="field__label">Date</span>
          <input
            className="input"
            type="date"
            value={date}
            max={today()}
            onChange={(e) => setDate(e.target.value)}
          />
          <span className="field__hint">
            Use the morning you woke up. A wake time earlier than lights-out is read as crossing
            midnight.
          </span>
        </label>
      </div>
    </Sheet>
  )
}
