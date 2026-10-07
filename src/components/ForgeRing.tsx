/* ============================================================================
   THE FORGE RING — the app's signature element.

   A conventional fitness app shows one arc filling toward a goal. That tells you
   the score and nothing else. This ring is split into one arc per scoring input
   (seven of them), each arc's *fill* showing that input's completion and each
   arc's *colour* taken from the kiln ramp at its own heat. So the ring answers
   two questions at once: how did today go, and which input is cold.

   The arcs sit in a fixed order so the shape is learnable — training at the top,
   then food, then movement, recovery, consistency. A user glances at it after a
   week and reads the gap without reading a label.

   Everything else in the app is deliberately quiet so this can be the one loud
   thing.
   ========================================================================= */

import { useId, useMemo } from 'react'
import type { Score, ScorePart } from '../lib/calc'

interface Props {
  score: Score
  size?: number
  /** which segment is selected, if any — dims the others */
  activeKey?: ScorePart['key'] | null
  onSelect?: (key: ScorePart['key'] | null) => void
  /** suppress the centre readout when the ring is used as a small inline mark */
  bare?: boolean
}

const KILN = ['var(--kiln-1)', 'var(--kiln-2)', 'var(--kiln-3)', 'var(--kiln-4)', 'var(--kiln-5)']

/** Completion -> kiln step. Same scale as the score's own heat, so a 90%-filled
 *  arc and a 90 score read the same temperature. */
function heatOf(value: number): string {
  if (value >= 0.95) return KILN[4]
  if (value >= 0.75) return KILN[3]
  if (value >= 0.5) return KILN[2]
  if (value >= 0.25) return KILN[1]
  return KILN[0]
}

export function ForgeRing({ score, size = 212, activeKey = null, onSelect, bare = false }: Props) {
  const titleId = useId()
  const r = size / 2 - 14
  const c = size / 2
  const stroke = 13
  const gapDeg = 3.4

  const segments = useMemo(() => {
    const total = score.parts.reduce((a, p) => a + p.weight, 0) || 1
    let cursor = -90 // start at twelve o'clock
    return score.parts.map((part) => {
      const sweep = (part.weight / total) * 360
      const seg = {
        part,
        from: cursor + gapDeg / 2,
        to: cursor + sweep - gapDeg / 2,
      }
      cursor += sweep
      return seg
    })
  }, [score.parts])

  const summary = `Transformation score ${score.total} out of 100. ${score.parts
    .map((p) => `${p.label} ${Math.round(p.value * 100)}%`)
    .join(', ')}.`

  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        role="img"
        aria-labelledby={titleId}
      >
        <title id={titleId}>{summary}</title>

        {segments.map(({ part, from, to }) => {
          const dim = activeKey != null && activeKey !== part.key
          const filledTo = from + (to - from) * part.value
          return (
            <g
              key={part.key}
              opacity={dim ? 0.3 : 1}
              style={{ transition: 'opacity var(--t-mid) var(--ease-out)' }}
            >
              {/* groove — the unfilled remainder of this input. It has to be
                  visible against the card or a cold segment reads as a hole
                  rather than as capacity left on the table. */}
              <path
                d={arc(c, c, r, from, to)}
                fill="none"
                stroke="var(--surface-3)"
                strokeWidth={stroke}
                strokeLinecap="round"
              />
              {part.value > 0.012 && (
                <path
                  d={arc(c, c, r, from, filledTo)}
                  fill="none"
                  stroke={heatOf(part.value)}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                />
              )}
              {onSelect && (
                <path
                  // invisible fat hit path — 40px of touch target over a 13px mark
                  d={arc(c, c, r, from, to)}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={40}
                  strokeLinecap="butt"
                  style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                  onClick={() => onSelect(activeKey === part.key ? null : part.key)}
                />
              )}
            </g>
          )
        })}
      </svg>

      {!bare && (
        <div className="ring__centre" aria-hidden="true">
          {/* The numeral wears a text token, never a ramp step: the arcs carry
              the heat encoding, and a score painted in kiln-1 or kiln-2 drops
              under contrast on both surfaces. A small heat pip beneath it keeps
              the temperature reading without staking legibility on it. */}
          <span className="ring__score num">{score.total}</span>
          <span className="ring__denom num">/100</span>
          <span className="ring__heat" style={{ background: KILN[score.heat - 1] }} />
        </div>
      )}

      <style>{`
        .ring { position: relative; flex: none; }
        .ring__centre {
          position: absolute; inset: 0;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 2px;
        }
        .ring__score {
          font-family: var(--font-data);
          font-variant-numeric: tabular-nums;
          font-size: ${Math.round(size * 0.235)}px;
          font-weight: 600;
          line-height: 1;
          letter-spacing: -0.03em;
          color: var(--text-1);
        }
        .ring__denom {
          font-size: var(--fs-tiny);
          color: var(--text-3);
          letter-spacing: 0.02em;
        }
        .ring__heat {
          width: ${Math.round(size * 0.14)}px;
          height: 3px;
          border-radius: 2px;
          margin-top: 5px;
        }
      `}</style>
    </div>
  )
}

/** SVG arc path between two angles, degrees, clockwise. */
function arc(cx: number, cy: number, r: number, fromDeg: number, toDeg: number): string {
  const span = Math.max(0.01, toDeg - fromDeg)
  const start = polar(cx, cy, r, fromDeg)
  const end = polar(cx, cy, r, fromDeg + span)
  const largeArc = span > 180 ? 1 : 0
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

/* ===========================================================================
   The legend. Not optional decoration: the ring encodes identity by position
   and heat by colour, so without this list the segments are colour-only. It
   doubles as the "which input is cold" readout.
   ======================================================================== */

export function ForgeLegend({
  score,
  activeKey,
  onSelect,
}: {
  score: Score
  activeKey: ScorePart['key'] | null
  onSelect: (k: ScorePart['key'] | null) => void
}) {
  return (
    <ul className="legend">
      {score.parts.map((p) => {
        const pct = Math.round(p.value * 100)
        const on = activeKey === p.key
        return (
          <li key={p.key}>
            <button
              type="button"
              className="legend__row"
              data-on={on}
              aria-pressed={on}
              onClick={() => onSelect(on ? null : p.key)}
            >
              <span className="legend__dot" style={{ background: heatOf(p.value) }} />
              <span className="legend__label">{p.label}</span>
              <span className="legend__pct num">{pct}%</span>
            </button>
          </li>
        )
      })}

      <style>{`
        .legend { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 10px; }
        .legend__row {
          display: flex; align-items: center; gap: 8px;
          width: 100%; min-height: 44px; padding: 0 6px;
          border-radius: var(--r-sm);
          text-align: left;
          transition: background-color var(--t-fast) var(--ease-out);
        }
        .legend__row:hover { background: var(--surface-2); }
        .legend__row[data-on='true'] { background: var(--surface-3); }
        .legend__dot {
          width: 9px; height: 9px; border-radius: 2px; flex: none;
        }
        .legend__label {
          flex: 1; min-width: 0;
          font-size: var(--fs-tiny); color: var(--text-2);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .legend__pct {
          font-size: var(--fs-tiny); font-weight: 500; color: var(--text-1);
        }
      `}</style>
    </ul>
  )
}
