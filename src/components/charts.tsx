/* ============================================================================
   Charts. Hand-rolled SVG rather than a library, for two reasons: the mark specs
   here are specific (2px lines, 4px rounded data-ends anchored to the baseline,
   2px surface gaps between stacked fills) and a library would fight them; and a
   phone-sized chart with 90 points does not need a 50 kB dependency.

   Rules applied throughout, from the data-viz method:
   - ONE axis. Never two y-scales. Weight and calories are two charts, not one.
   - Colour follows the entity, never its rank, so filtering never repaints.
   - Sequential magnitude uses the single-hue kiln ramp; categorical series use
     the fixed, validated `--series-*` order.
   - Every chart ships a hover/tap layer and a "Show values" table, because three
     light-mode series sit under 3:1 on paper and the relief rule applies.
   - Gridlines are recessive; text wears text tokens, never the series colour.
   ========================================================================= */

import { useId, useMemo, useState } from 'react'
import { Table2 } from 'lucide-react'
import { kilnFor } from './ui'

/* --------------------------------- shared -------------------------------- */

export interface Point {
  /** x label shown on the axis and in the tooltip */
  label: string
  value: number | null
}

const PAD = { top: 10, right: 6, bottom: 20, left: 30 }

function niceBounds(values: number[], padRatio = 0.08): [number, number] {
  const clean = values.filter((v) => Number.isFinite(v))
  if (!clean.length) return [0, 1]
  let min = Math.min(...clean)
  let max = Math.max(...clean)
  if (min === max) {
    min -= 1
    max += 1
  }
  const pad = (max - min) * padRatio
  return [min - pad, max + pad]
}

function fmtTick(n: number): string {
  if (Math.abs(n) >= 10000) return `${Math.round(n / 1000)}k`
  if (Math.abs(n) >= 100) return String(Math.round(n))
  return String(Math.round(n * 10) / 10)
}

/** The table view every chart offers. This is the accessibility backstop. */
function ValueTable({
  caption,
  rows,
  seriesNames,
}: {
  caption: string
  rows: Array<{ label: string; values: Array<number | null> }>
  seriesNames: string[]
}) {
  return (
    <div className="vtable-wrap">
      <table className="vtable">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            {seriesNames.map((n) => (
              <th key={n} scope="col">
                {n}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              {r.values.map((v, i) => (
                <td key={i} className="num">
                  {v == null ? '—' : fmtTick(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <style>{`
        .vtable-wrap { overflow-x: auto; margin-top: var(--s-3); }
        .vtable { width: 100%; border-collapse: collapse; font-size: var(--fs-tiny); }
        .vtable th, .vtable td {
          padding: 5px var(--s-2); text-align: right;
          border-bottom: 1px solid var(--hairline);
          white-space: nowrap;
        }
        .vtable thead th {
          color: var(--text-3); font-weight: 700;
          font-family: var(--font-display);
          letter-spacing: 0.08em; text-transform: uppercase;
          font-size: var(--fs-micro);
        }
        .vtable tbody th {
          text-align: left; color: var(--text-2); font-weight: 500;
        }
        .vtable td { color: var(--text-1); }
      `}</style>
    </div>
  )
}

export function ChartFrame({
  title,
  subtitle,
  legend,
  children,
  table,
}: {
  title?: string
  subtitle?: string
  legend?: React.ReactNode
  children: React.ReactNode
  table?: React.ReactNode
}) {
  const [showTable, setShowTable] = useState(false)
  return (
    <div className="cframe">
      {(title || table) && (
        <div className="cframe__head">
          <div className="grow">
            {title && <h3 className="cframe__title">{title}</h3>}
            {subtitle && <p className="cframe__sub">{subtitle}</p>}
          </div>
          {table && (
            <button
              type="button"
              className="cframe__toggle"
              aria-pressed={showTable}
              onClick={() => setShowTable((v) => !v)}
            >
              <Table2 size={13} aria-hidden="true" />
              {showTable ? 'Hide values' : 'Show values'}
            </button>
          )}
        </div>
      )}
      {children}
      {legend}
      {showTable && table}

      <style>{`
        .cframe__head {
          display: flex; align-items: flex-start; gap: var(--s-2);
          margin-bottom: var(--s-3);
        }
        .cframe__title {
          font-size: var(--fs-sm); font-weight: 700; color: var(--text-1);
        }
        .cframe__sub { font-size: var(--fs-tiny); color: var(--text-3); margin-top: 1px; }
        .cframe__toggle {
          display: inline-flex; align-items: center; gap: 5px;
          flex: none; min-height: 44px; padding: 0 var(--s-2);
          margin-top: calc(var(--s-2) * -1);
          border-radius: var(--r-sm);
          font-family: var(--font-display);
          font-size: var(--fs-micro); font-weight: 700;
          letter-spacing: 0.06em; text-transform: uppercase;
          color: var(--text-3);
        }
        .cframe__toggle:hover { background: var(--surface-2); color: var(--text-1); }
        .cframe__toggle[aria-pressed='true'] { color: var(--ember); }
      `}</style>
    </div>
  )
}

/* ============================== legend ================================= */

export function Legend({
  items,
}: {
  items: Array<{ name: string; colour: string; dashed?: boolean }>
}) {
  return (
    <ul className="clegend">
      {items.map((i) => (
        <li key={i.name} className="clegend__item">
          <span
            className="clegend__swatch"
            style={{
              background: i.dashed ? 'transparent' : i.colour,
              borderTop: i.dashed ? `2px dashed ${i.colour}` : undefined,
            }}
          />
          <span>{i.name}</span>
        </li>
      ))}

      <style>{`
        .clegend {
          display: flex; flex-wrap: wrap; gap: var(--s-2) var(--s-4);
          margin-top: var(--s-3);
        }
        .clegend__item {
          display: flex; align-items: center; gap: 6px;
          font-size: var(--fs-tiny); color: var(--text-2);
        }
        .clegend__swatch {
          width: 12px; height: 3px; border-radius: 2px; flex: none;
        }
      `}</style>
    </ul>
  )
}

/* ============================== line chart =============================
   Used for weight (with its trend line) and any single continuous measure.
   Gaps are real gaps: a day with no weigh-in breaks the line rather than
   interpolating a number the user never recorded.
   ====================================================================== */

export function LineChart({
  points,
  trend,
  height = 150,
  colour = 'var(--series-1)',
  trendColour = 'var(--text-2)',
  goal,
  goalLabel,
  seriesName = 'Value',
  title,
  subtitle,
}: {
  points: Point[]
  /** optional smoothed overlay, same length/order as `points` */
  trend?: Array<number | null>
  height?: number
  colour?: string
  trendColour?: string
  goal?: number
  goalLabel?: string
  seriesName?: string
  title?: string
  subtitle?: string
}) {
  const clipId = useId()
  const [hover, setHover] = useState<number | null>(null)
  const W = 320
  const H = height

  const values = points.map((p) => p.value).filter((v): v is number => v != null)
  const all = goal != null ? [...values, goal] : values
  const [lo, hi] = niceBounds(all)

  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const x = (i: number) =>
    PAD.left + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW)
  const y = (v: number) => PAD.top + innerH - ((v - lo) / (hi - lo)) * innerH

  const path = useMemo(() => buildPath(points.map((p) => p.value), x, y), [points, lo, hi])
  const trendPath = useMemo(
    () => (trend ? buildPath(trend, x, y) : null),
    [trend, lo, hi],
  )

  const ticks = [lo, (lo + hi) / 2, hi]
  const labelEvery = Math.max(1, Math.ceil(points.length / 5))
  const firstIndexWithValue = points.findIndex((p) => p.value != null)
  const lastIndexWithValue = points.length - 1 - [...points].reverse().findIndex((p) => p.value != null)

  if (!values.length) return <ChartEmpty height={height} />

  const hoverPoint = hover != null ? points[hover] : null

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      legend={
        trend ? (
          <Legend
            items={[
              { name: seriesName, colour },
              { name: 'Trend', colour: trendColour, dashed: true },
            ]}
          />
        ) : undefined
      }
      table={
        <ValueTable
          caption={`${seriesName} by date`}
          seriesNames={trend ? [seriesName, 'Trend'] : [seriesName]}
          rows={points.map((p, i) => ({
            label: p.label,
            values: trend ? [p.value, trend[i] ?? null] : [p.value],
          }))}
        />
      }
    >
      <div className="lc">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height={H}
          role="img"
          aria-label={`${seriesName} over ${points.length} points. Lowest ${fmtTick(
            Math.min(...values),
          )}, highest ${fmtTick(Math.max(...values))}.`}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const px = ((e.clientX - rect.left) / rect.width) * W
            const i = Math.round(((px - PAD.left) / innerW) * (points.length - 1))
            setHover(Math.max(0, Math.min(points.length - 1, i)))
          }}
          onTouchMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const px = ((e.touches[0].clientX - rect.left) / rect.width) * W
            const i = Math.round(((px - PAD.left) / innerW) * (points.length - 1))
            setHover(Math.max(0, Math.min(points.length - 1, i)))
          }}
          onTouchEnd={() => setHover(null)}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={PAD.left} y={PAD.top} width={innerW} height={innerH} />
            </clipPath>
            <linearGradient id={`${clipId}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colour} stopOpacity="0.18" />
              <stop offset="100%" stopColor={colour} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* gridlines + y ticks */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--grid)"
                strokeWidth={1}
              />
              <text x={PAD.left - 6} y={y(t) + 3.5} className="lc__tick" textAnchor="end">
                {fmtTick(t)}
              </text>
            </g>
          ))}

          {/* goal line — a reference, so it is dashed and labelled, never a series */}
          {goal != null && goal >= lo && goal <= hi && (
            <g>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(goal)}
                y2={y(goal)}
                stroke="var(--ember)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
              {goalLabel && (
                <text x={W - PAD.right} y={y(goal) - 5} className="lc__goal" textAnchor="end">
                  {goalLabel}
                </text>
              )}
            </g>
          )}

          <g clipPath={`url(#${clipId})`}>
            {/* The area fill needs at least two points. With one, closing the
                path to the baseline draws a triangle out of thin air — a shape
                that implies a trend the data does not contain. */}
            {path && values.length >= 2 && (
              <path
                d={`${path} L ${x(lastIndexWithValue)} ${H - PAD.bottom} L ${x(firstIndexWithValue)} ${H - PAD.bottom} Z`}
                fill={`url(#${clipId}-fill)`}
              />
            )}
            {path && <path d={path} fill="none" stroke={colour} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
            {trendPath && (
              <path
                d={trendPath}
                fill="none"
                stroke={trendColour}
                strokeWidth={2}
                strokeDasharray="5 4"
                strokeLinecap="round"
              />
            )}
          </g>

          {/* markers: >=8px so they are real targets, with a surface ring so
              overlapping points stay separable */}
          {points.map((p, i) =>
            p.value == null ? null : (
              <circle
                key={i}
                cx={x(i)}
                cy={y(p.value)}
                r={hover === i ? 5 : 3.2}
                fill={colour}
                stroke="var(--surface-1)"
                strokeWidth={2}
                style={{ transition: 'r var(--t-fast) var(--ease-out)' }}
              />
            ),
          )}

          {/* crosshair */}
          {hover != null && points[hover].value != null && (
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="var(--hairline-strong)"
              strokeWidth={1}
            />
          )}

          {/* x labels, auto-skipped so they never cram */}
          {points.map((p, i) =>
            i % labelEvery === 0 || i === points.length - 1 ? (
              <text key={i} x={x(i)} y={H - 6} className="lc__tick" textAnchor="middle">
                {p.label}
              </text>
            ) : null,
          )}
        </svg>

        {hoverPoint && hoverPoint.value != null && (
          <div
            className="lc__tip num"
            style={{
              left: `${(x(hover!) / W) * 100}%`,
              transform: `translateX(${hover! > points.length / 2 ? '-100%' : '0'})`,
            }}
          >
            <span className="lc__tipVal">{fmtTick(hoverPoint.value)}</span>
            <span className="lc__tipLabel">{hoverPoint.label}</span>
          </div>
        )}
      </div>

      <style>{`
        .lc { position: relative; }
        .lc__tick {
          font-family: var(--font-data); font-size: 9px;
          fill: var(--text-3);
        }
        .lc__goal {
          font-family: var(--font-display); font-size: 8.5px; font-weight: 700;
          letter-spacing: 0.08em; fill: var(--ember);
        }
        .lc__tip {
          position: absolute; top: 0;
          display: flex; flex-direction: column;
          padding: 5px var(--s-2);
          background: var(--surface-3);
          border: 1px solid var(--hairline-strong);
          border-radius: var(--r-sm);
          pointer-events: none;
          white-space: nowrap;
        }
        .lc__tipVal { font-size: var(--fs-sm); font-weight: 600; color: var(--text-1); }
        .lc__tipLabel { font-size: 10px; color: var(--text-3); }
      `}</style>
    </ChartFrame>
  )
}

function buildPath(
  values: Array<number | null>,
  x: (i: number) => number,
  y: (v: number) => number,
): string | null {
  let d = ''
  let open = false
  values.forEach((v, i) => {
    if (v == null) {
      open = false
      return
    }
    d += `${open ? ' L' : (d ? ' M' : 'M')} ${x(i)} ${y(v)}`
    open = true
  })
  return d || null
}

/* ============================== bar chart ==============================
   Magnitude per day. Bars use the kiln ramp against their own target, so a week
   of bars reads as a heat map of consistency — the same encoding as the ring.
   ====================================================================== */

export function BarChart({
  points,
  target,
  height = 140,
  colour,
  seriesName = 'Value',
  title,
  subtitle,
  unit,
}: {
  points: Point[]
  /** when given, bar colour comes from completion against this, not absolute size */
  target?: number
  height?: number
  colour?: string
  seriesName?: string
  title?: string
  subtitle?: string
  unit?: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 320
  const H = height
  const values = points.map((p) => p.value ?? 0)
  const max = Math.max(target ?? 0, ...values, 1)

  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  // a 2px surface gap between adjacent bars
  const slot = innerW / Math.max(1, points.length)
  const barW = Math.max(3, Math.min(26, slot - 2))

  // An axis frame over an all-zero series looks like a rendered chart that
  // happens to be flat. It is not — there is no data. Say so.
  if (!points.length || values.every((v) => v === 0)) return <ChartEmpty height={height} />

  const labelEvery = Math.max(1, Math.ceil(points.length / 7))

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      table={
        <ValueTable
          caption={`${seriesName} by date`}
          seriesNames={[seriesName]}
          rows={points.map((p) => ({ label: p.label, values: [p.value] }))}
        />
      }
    >
      <div className="bc">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height={H}
          role="img"
          aria-label={`${seriesName} by day. Highest ${fmtTick(Math.max(...values))}${
            unit ? ` ${unit}` : ''
          }.`}
          onMouseLeave={() => setHover(null)}
        >
          {/* target reference line */}
          {target != null && target > 0 && (
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={PAD.top + innerH - (target / max) * innerH}
              y2={PAD.top + innerH - (target / max) * innerH}
              stroke="var(--ember)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
          )}

          {/* baseline — bars are anchored here, which is what makes the rounded
              data-end read as a bar and not a pill */}
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={PAD.top + innerH}
            y2={PAD.top + innerH}
            stroke="var(--axis)"
            strokeWidth={1}
          />

          <text x={PAD.left - 6} y={PAD.top + 4} className="bc__tick" textAnchor="end">
            {fmtTick(max)}
          </text>

          {points.map((p, i) => {
            const v = p.value ?? 0
            const h = Math.max(v > 0 ? 3 : 0, (v / max) * innerH)
            const bx = PAD.left + i * slot + (slot - barW) / 2
            const by = PAD.top + innerH - h
            const fill = colour ?? (target ? kilnFor(v / target) : 'var(--series-1)')
            return (
              <g key={i} onMouseEnter={() => setHover(i)}>
                <rect
                  x={bx}
                  y={by}
                  width={barW}
                  height={h}
                  rx={Math.min(4, barW / 2)}
                  fill={fill}
                  opacity={hover == null || hover === i ? 1 : 0.45}
                  style={{ transition: 'opacity var(--t-fast) var(--ease-out)' }}
                />
                {/* tap target spans the full slot height */}
                <rect
                  x={PAD.left + i * slot}
                  y={PAD.top}
                  width={slot}
                  height={innerH}
                  fill="transparent"
                  onTouchStart={() => setHover(i)}
                  style={{ cursor: 'pointer' }}
                />
              </g>
            )
          })}

          {points.map((p, i) =>
            i % labelEvery === 0 || i === points.length - 1 ? (
              <text
                key={i}
                x={PAD.left + i * slot + slot / 2}
                y={H - 6}
                className="bc__tick"
                textAnchor="middle"
              >
                {p.label}
              </text>
            ) : null,
          )}
        </svg>

        {hover != null && (
          <div className="bc__tip">
            <span className="num bc__tipVal">
              {fmtTick(points[hover].value ?? 0)}
              {unit && <span className="t-unit"> {unit}</span>}
            </span>
            <span className="bc__tipLabel">{points[hover].label}</span>
          </div>
        )}
      </div>

      <style>{`
        .bc { position: relative; }
        .bc__tick { font-family: var(--font-data); font-size: 9px; fill: var(--text-3); }
        .bc__tip {
          position: absolute; top: -2px; right: 0;
          display: flex; align-items: baseline; gap: var(--s-2);
          padding: 3px var(--s-2);
          background: var(--surface-3);
          border: 1px solid var(--hairline-strong);
          border-radius: var(--r-sm);
          pointer-events: none;
        }
        .bc__tipVal { font-size: var(--fs-sm); font-weight: 600; color: var(--text-1); }
        .bc__tipLabel { font-size: 10px; color: var(--text-3); }
      `}</style>
    </ChartFrame>
  )
}

/* =========================== stacked macro bar =========================
   Protein / carbs / fat as a share of the day's calories. Categorical slots in
   their fixed order, a 2px surface gap between segments, and direct labels — so
   it never depends on colour alone.
   ====================================================================== */

export function MacroBar({
  protein,
  carbs,
  fat,
  height = 10,
}: {
  protein: number
  carbs: number
  fat: number
  height?: number
}) {
  // calories from each macro, which is the honest denominator for a share bar
  const kcal = { protein: protein * 4, carbs: carbs * 4, fat: fat * 9 }
  const total = kcal.protein + kcal.carbs + kcal.fat

  if (total <= 0) {
    return (
      <div
        style={{
          height,
          borderRadius: 'var(--r-pill)',
          background: 'var(--surface-inset)',
        }}
        aria-hidden="true"
      />
    )
  }

  const segs = [
    { name: 'Protein', value: kcal.protein, grams: protein, colour: 'var(--series-1)' },
    { name: 'Carbs', value: kcal.carbs, grams: carbs, colour: 'var(--series-2)' },
    { name: 'Fat', value: kcal.fat, grams: fat, colour: 'var(--series-3)' },
  ]

  return (
    <div className="mb">
      <div
        className="mb__bar"
        style={{ height }}
        role="img"
        aria-label={segs
          .map((s) => `${s.name} ${Math.round(s.grams)} g, ${Math.round((s.value / total) * 100)}%`)
          .join('. ')}
      >
        {segs.map((s) =>
          s.value <= 0 ? null : (
            <span
              key={s.name}
              className="mb__seg"
              style={{ flexGrow: s.value, background: s.colour }}
            />
          ),
        )}
      </div>
      <ul className="mb__keys">
        {segs.map((s) => (
          <li key={s.name}>
            <span className="mb__dot" style={{ background: s.colour }} />
            <span className="mb__name">{s.name}</span>
            <span className="mb__g num">{Math.round(s.grams)}g</span>
          </li>
        ))}
      </ul>
      {/* The bar is split by CALORIES, the labels report GRAMS. Fat is 9 kcal/g
          against 4 for the others, so its slice always looks larger than its
          gram figure — say which is which rather than let it read as an error. */}
      <p className="mb__note">Bar shows share of calories; figures are grams.</p>

      <style>{`
        .mb__bar {
          display: flex; gap: 2px;
          border-radius: var(--r-pill); overflow: hidden;
          background: var(--surface-inset);
        }
        .mb__seg { min-width: 3px; }
        .mb__seg:first-child { border-radius: var(--r-pill) 0 0 var(--r-pill); }
        .mb__seg:last-child { border-radius: 0 var(--r-pill) var(--r-pill) 0; }
        .mb__keys {
          display: flex; gap: var(--s-4);
          margin-top: var(--s-2);
        }
        .mb__keys li { display: flex; align-items: center; gap: 5px; }
        .mb__dot { width: 8px; height: 8px; border-radius: 2px; }
        .mb__name { font-size: var(--fs-tiny); color: var(--text-3); }
        .mb__g { font-size: var(--fs-tiny); font-weight: 500; color: var(--text-1); }
        .mb__note { margin-top: 5px; font-size: var(--fs-micro); color: var(--text-3); }
      `}</style>
    </div>
  )
}

/* ============================= heat strip ==============================
   One cell per day on the kiln ramp — the compact form of the score. Used in the
   weekly review and the habit rows, where a full chart would be too much and a
   bare number too little.
   ====================================================================== */

export function HeatStrip({
  cells,
  label,
}: {
  cells: Array<{ label: string; ratio: number; empty?: boolean }>
  label: string
}) {
  return (
    <div className="hs" role="img" aria-label={`${label}: ${cells.map((c) => `${c.label} ${Math.round(c.ratio * 100)}%`).join(', ')}`}>
      {cells.map((c, i) => (
        <div key={i} className="hs__col">
          <div
            className="hs__cell"
            style={{
              background: c.empty ? 'var(--surface-inset)' : kilnFor(c.ratio),
              borderColor: c.empty ? 'var(--hairline)' : 'transparent',
            }}
          />
          <span className="hs__label">{c.label}</span>
        </div>
      ))}

      <style>{`
        .hs { display: flex; gap: 3px; }
        .hs__col { flex: 1; display: flex; flex-direction: column; gap: 4px; align-items: center; min-width: 0; }
        .hs__cell {
          width: 100%; height: 26px;
          border: 1px solid transparent;
          border-radius: 4px;
        }
        .hs__label {
          font-family: var(--font-data); font-size: 9px; color: var(--text-3);
        }
      `}</style>
    </div>
  )
}

/* ============================= empty chart ============================= */

function ChartEmpty({ height }: { height: number }) {
  return (
    <div className="cempty" style={{ height }}>
      <span>No data for this range</span>
      <style>{`
        .cempty {
          display: grid; place-items: center;
          border: 1px dashed var(--hairline);
          border-radius: var(--r-md);
          font-size: var(--fs-tiny); color: var(--text-3);
        }
      `}</style>
    </div>
  )
}
