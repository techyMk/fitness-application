/* ============================================================================
   Weight. The trend line, the prediction, and the full entry history.

   The prediction block is the most careful copy in the app: it reports a date
   only when the data supports one, names its confidence, and always says it is
   an estimate from the user's own trend. Spec §6 asks for exactly that.
   ========================================================================= */

import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { predictGoal, weightStats } from '../lib/calc'
import { useStore } from '../lib/store'
import { useT } from '../lib/i18n'
import { fmtDelta, makeFmt } from '../lib/units'
import { daysBetween, fmtDate, fmtLongDate, lastNDays, today } from '../lib/date'
import { LineChart } from '../components/charts'
import {
  ConfirmSheet,
  Empty,
  Meter,
  ScreenHeader,
  Sheet,
  Stat,
  Stepper,
  useToast,
} from '../components/ui'

type Range = 30 | 90 | 365

export default function Weight() {
  const { t, locale } = useT()
  const { data, actions } = useStore()
  const toast = useToast()
  const profile = data.profile!
  const fmt = useMemo(() => makeFmt(profile.units), [profile.units])

  const [range, setRange] = useState<Range>(30)
  const [logSheet, setLogSheet] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const stats = useMemo(() => weightStats(data), [data])
  const prediction = useMemo(() => predictGoal(data), [data])

  const chart = useMemo(() => {
    const days = lastNDays(range)
    const byDate = new Map(data.weights.map((w) => [w.date, w.kg]))
    const points = days.map((d) => ({
      label: fmtDate(d, locale).split(' ')[0],
      value: byDate.has(d) ? Number(fmt.weight(byDate.get(d)!)) : null,
    }))
    let acc: number | null = null
    const trend = days.map((d) => {
      const v = byDate.get(d)
      if (v != null) {
        const display = Number(fmt.weight(v))
        acc = acc == null ? display : 0.25 * display + 0.75 * acc
      }
      return acc
    })
    return { points, trend }
  }, [data.weights, range, fmt, locale])

  const entries = useMemo(
    () => [...data.weights].sort((a, b) => (a.date < b.date ? 1 : -1)),
    [data.weights],
  )

  const predictionCopy = (() => {
    if (prediction.reason === 'reached') return t('weight.predict.reached')
    if (prediction.reason === 'flat') return t('weight.predict.flat')
    if (prediction.reason === 'wrong-way') return t('weight.predict.wrongWay')
    if (!prediction.date) return t('weight.predict.none')
    return null
  })()

  return (
    <div className="shell">
      <ScreenHeader
        title={t('weight.title')}
        back="/progress"
        action={
          <button
            type="button"
            className="icon-btn"
            aria-label={t('weight.log')}
            onClick={() => setLogSheet(true)}
          >
            <Plus size={20} aria-hidden="true" />
          </button>
        }
      />

      {entries.length === 0 ? (
        <Empty
          title={t('weight.empty')}
          body={t('weight.empty.body')}
          action={
            <button type="button" className="btn btn--primary" onClick={() => setLogSheet(true)}>
              <Plus size={15} aria-hidden="true" />
              {t('weight.log')}
            </button>
          }
        />
      ) : (
        <>
          {/* ---------------------------- headline --------------------------- */}
          <section className="card" style={{ marginTop: 'var(--s-4)' }}>
            <div className="wt-now">
              <span className="num wt-nowVal">{fmt.weight(stats.current)}</span>
              <span className="wt-nowUnit">{fmt.weightUnit}</span>
            </div>

            <div className="row row--between wt-ends">
              <span className="num">
                {t('weight.start')} {fmt.weight(stats.start)}
              </span>
              <span className="num wt-pct">{Math.round(stats.progressPct)}%</span>
              <span className="num">
                {t('weight.goal')} {fmt.weight(stats.target)}
              </span>
            </div>
            <Meter value={stats.progressPct} max={100} label="Progress toward target" showOver={false} />

            <div className="wt-stats">
              <Stat
                label={stats.change != null && stats.change <= 0 ? t('weight.lost') : t('weight.gained')}
                value={fmt.weight(stats.change == null ? null : Math.abs(stats.change))}
                unit={fmt.weightUnit}
                size="md"
              />
              <Stat
                label={t('weight.trend')}
                value={fmt.weight(stats.trend)}
                unit={fmt.weightUnit}
                size="md"
                tone="ember"
              />
              <Stat
                label={t('weight.rate')}
                value={fmtDelta(stats.ratePerWeek, 2)}
                unit={`${fmt.weightUnit}/wk`}
                size="md"
                tone={stats.ratePerWeek == null ? 'dim' : 'default'}
              />
              <Stat
                label={t('weight.remaining')}
                value={fmt.weight(stats.remaining == null ? null : Math.abs(stats.remaining))}
                unit={fmt.weightUnit}
                size="md"
                tone="dim"
              />
            </div>

            <p className="wt-trendHint">{t('weight.trend.hint')}</p>
          </section>

          {/* ----------------------------- chart ---------------------------- */}
          <div className="eyebrow">{t('weight.trend')}</div>
          <section className="card">
            <div className="segmented" style={{ marginBottom: 'var(--s-4)' }}>
              {([30, 90, 365] as Range[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-selected={range === r}
                  onClick={() => setRange(r)}
                >
                  {r === 365 ? '1 year' : `${r} days`}
                </button>
              ))}
            </div>
            <LineChart
              points={chart.points}
              trend={chart.trend}
              goal={Number(fmt.weight(profile.targetWeightKg))}
              goalLabel={`Target ${fmt.weight(profile.targetWeightKg)}`}
              seriesName={`Weight (${fmt.weightUnit})`}
              height={190}
            />
          </section>

          {/* --------------------------- prediction ------------------------- */}
          <div className="eyebrow">{t('weight.predict')}</div>
          <section className="card">
            {prediction.date && prediction.reason !== 'reached' ? (
              <>
                <p className="num wt-predDate">{fmtLongDate(prediction.date, locale)}</p>
                <p className="wt-predMeta">
                  About {Math.abs(prediction.weeksAway ?? 0)} weeks away, at{' '}
                  {fmtDelta(prediction.ratePerWeek, 2)} {fmt.weightUnit} a week ·{' '}
                  {daysBetween(today(), prediction.date)} days
                </p>
                <div className="wt-conf" data-level={prediction.confidence}>
                  <span className="t-micro">
                    {prediction.confidence} confidence
                  </span>
                  <span className="wt-confBar" aria-hidden="true">
                    {[1, 2, 3].map((n) => (
                      <span
                        key={n}
                        data-on={
                          n <= (prediction.confidence === 'high' ? 3 : prediction.confidence === 'medium' ? 2 : 1)
                        }
                      />
                    ))}
                  </span>
                </div>
                <p className="wt-caveat">
                  {prediction.confidence === 'low' ? t('weight.predict.low') : t('weight.predict.caveat')}{' '}
                  It updates itself every time you weigh in.
                </p>
              </>
            ) : (
              <p className="wt-predNone">{predictionCopy}</p>
            )}
          </section>

          {/* ---------------------------- entries --------------------------- */}
          <div className="eyebrow">
            History
            <span className="eyebrow__action num">{entries.length}</span>
          </div>
          <ul className="card card--flush">
            {entries.map((e, i) => {
              const prev = entries[i + 1]
              const delta = prev ? e.kg - prev.kg : null
              return (
                <li key={e.id}>
                  {i > 0 && <div className="divider" />}
                  <div className="wt-row">
                    <span className="wt-rowDate">{fmtDate(e.date, locale)}</span>
                    <span className="num wt-rowVal">
                      {fmt.weight(e.kg)}
                      <span className="t-unit"> {fmt.weightUnit}</span>
                    </span>
                    {delta != null && (
                      <span
                        className="num wt-rowDelta"
                        style={{
                          color:
                            Math.abs(delta) < 0.05
                              ? 'var(--text-3)'
                              : movingToward(delta, profile.startWeightKg, profile.targetWeightKg)
                                ? 'var(--good)'
                                : 'var(--warn)',
                        }}
                      >
                        {fmtDelta(Number(fmt.weight(delta, 1)))}
                      </span>
                    )}
                    <button
                      type="button"
                      className="wt-del"
                      aria-label={`Delete entry from ${fmtDate(e.date, locale)}`}
                      onClick={() => setDeleting(e.id)}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <LogSheet
        open={logSheet}
        onClose={() => setLogSheet(false)}
        current={stats.current ?? profile.startWeightKg}
      />

      <ConfirmSheet
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) actions.deleteWeight(deleting)
          toast.show('Entry deleted')
        }}
        title="Delete this weigh-in?"
        body="The trend line and prediction will recalculate without it."
      />

      <style>{`
        .wt-now { display: flex; align-items: baseline; gap: var(--s-2); }
        .wt-nowVal {
          font-size: var(--fs-4xl); font-weight: 600; line-height: 1;
          letter-spacing: -0.035em;
        }
        .wt-nowUnit {
          font-family: var(--font-data);
          font-size: var(--fs-lg); color: var(--text-3);
        }
        .wt-ends {
          margin: var(--s-5) 0 5px;
          font-size: var(--fs-tiny); color: var(--text-3);
        }
        .wt-pct { color: var(--text-2); }
        .wt-stats {
          display: grid; grid-template-columns: repeat(2, 1fr);
          gap: var(--s-4); margin-top: var(--s-5);
        }
        .wt-trendHint {
          margin-top: var(--s-4); padding-top: var(--s-3);
          border-top: 1px solid var(--hairline);
          font-size: var(--fs-tiny); color: var(--text-3); line-height: 1.5;
        }

        .wt-predDate {
          font-size: var(--fs-xl); font-weight: 600;
        }
        .wt-predMeta {
          margin-top: 3px;
          font-size: var(--fs-tiny); color: var(--text-2);
        }
        .wt-conf {
          display: flex; align-items: center; gap: var(--s-2);
          margin-top: var(--s-3);
        }
        .wt-conf[data-level='high'] { color: var(--good); }
        .wt-conf[data-level='medium'] { color: var(--warn); }
        .wt-conf[data-level='low'] { color: var(--text-3); }
        .wt-confBar { display: flex; gap: 3px; }
        .wt-confBar > span {
          width: 16px; height: 3px; border-radius: 2px;
          background: var(--surface-3);
        }
        .wt-confBar > span[data-on='true'] { background: currentColor; }
        .wt-caveat {
          margin-top: var(--s-3);
          font-size: var(--fs-tiny); color: var(--text-3); line-height: 1.5;
        }
        .wt-predNone { font-size: var(--fs-sm); color: var(--text-2); }

        .wt-row {
          display: flex; align-items: center; gap: var(--s-3);
          min-height: 50px; padding: 0 var(--s-2) 0 var(--s-4);
        }
        .wt-rowDate { flex: 1; font-size: var(--fs-sm); color: var(--text-2); }
        .wt-rowVal { flex: none; font-size: var(--fs-sm); font-weight: 600; }
        .wt-rowDelta {
          width: 48px; flex: none; text-align: right;
          font-size: var(--fs-tiny);
        }
        .wt-del {
          display: grid; place-items: center;
          width: 36px; height: 36px; flex: none;
          border-radius: var(--r-sm); color: var(--text-3);
        }
        .wt-del:hover { background: var(--critical-soft); color: var(--critical); }
      `}</style>
    </div>
  )

  function LogSheet({
    open,
    onClose,
    current,
  }: {
    open: boolean
    onClose: () => void
    current: number
  }) {
    const [kg, setKg] = useState(() => Number(fmt.weight(current)))
    const [date, setDate] = useState(today())

    return (
      <Sheet
        open={open}
        onClose={onClose}
        title={t('weight.log')}
        footer={
          <button
            type="button"
            className="btn btn--primary btn--block btn--lg"
            onClick={() => {
              actions.logWeight(Number(fmt.toKg(kg).toFixed(2)), date)
              toast.show(`Logged ${fmt.weightLabel(fmt.toKg(kg))}`, { tone: 'good' })
              onClose()
            }}
          >
            {t('common.save')}
          </button>
        }
      >
        <div className="stack-4">
          <Stepper
            label={t('weight.title')}
            unit={fmt.weightUnit}
            decimals={1}
            step={0.1}
            value={kg}
            onChange={setKg}
            min={profile.units === 'imperial' ? 66 : 30}
            max={profile.units === 'imperial' ? 660 : 300}
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
              Logging the same date twice replaces the earlier entry.
            </span>
          </label>
        </div>
      </Sheet>
    )
  }
}

function movingToward(delta: number, start: number, target: number): boolean {
  return start > target ? delta < 0 : delta > 0
}
