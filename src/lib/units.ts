/* ============================================================================
   Units. Everything is STORED in metric (kg, km, cm) and converted only at the
   edges — display and input. That way switching units in Settings never rewrites
   history and never accumulates rounding error.
   ========================================================================= */

import type { Units } from './types'
import { cmToIn, inToCm, kgToLb, kmToMi, lbToKg, miToKm, round } from './calc'

export interface Fmt {
  units: Units
  weightUnit: string
  distanceUnit: string
  heightUnit: string
  /** kg -> display number in the user's unit */
  weight: (kg: number | null | undefined, dp?: number) => string
  /** kg -> display number + unit */
  weightLabel: (kg: number | null | undefined, dp?: number) => string
  /** user-entered number -> kg */
  toKg: (value: number) => number
  distance: (km: number | null | undefined, dp?: number) => string
  distanceLabel: (km: number | null | undefined, dp?: number) => string
  toKm: (value: number) => number
  /** cm -> "175" or "5'9"" */
  height: (cm: number) => string
  toCm: (value: number) => number
  speed: (kmh: number | null | undefined) => string
  speedUnit: string
}

const dash = '—'

export function makeFmt(units: Units): Fmt {
  const imperial = units === 'imperial'

  return {
    units,
    weightUnit: imperial ? 'lb' : 'kg',
    distanceUnit: imperial ? 'mi' : 'km',
    heightUnit: imperial ? 'in' : 'cm',
    speedUnit: imperial ? 'mph' : 'km/h',

    weight: (kg, dp = 1) =>
      kg == null ? dash : round(imperial ? kgToLb(kg) : kg, dp).toFixed(dp),
    weightLabel: (kg, dp = 1) =>
      kg == null ? dash : `${round(imperial ? kgToLb(kg) : kg, dp).toFixed(dp)} ${imperial ? 'lb' : 'kg'}`,
    toKg: (v) => (imperial ? lbToKg(v) : v),

    distance: (km, dp = 2) =>
      km == null ? dash : round(imperial ? kmToMi(km) : km, dp).toFixed(dp),
    distanceLabel: (km, dp = 2) =>
      km == null ? dash : `${round(imperial ? kmToMi(km) : km, dp).toFixed(dp)} ${imperial ? 'mi' : 'km'}`,
    toKm: (v) => (imperial ? miToKm(v) : v),

    height: (cm) => {
      if (!imperial) return String(Math.round(cm))
      const totalIn = Math.round(cmToIn(cm))
      return `${Math.floor(totalIn / 12)}'${totalIn % 12}"`
    },
    toCm: (v) => (imperial ? inToCm(v) : v),

    speed: (kmh) => (kmh == null ? dash : round(imperial ? kmToMi(kmh) : kmh, 1).toFixed(1)),
  }
}

/** 10420 -> "10,420". Locale-aware so Tamil/Indian grouping is right. */
export function fmtInt(n: number, locale = 'en-IN'): string {
  return Math.round(n).toLocaleString(locale)
}

/** Signed change, e.g. "-2.4" / "+0.6". Used for weight deltas. */
export function fmtDelta(n: number | null | undefined, dp = 1): string {
  if (n == null) return dash
  const v = round(n, dp)
  return `${v > 0 ? '+' : ''}${v.toFixed(dp)}`
}

/** Plate-friendly rounding so the app never suggests 23.7 kg. */
export function snapToPlate(kg: number, step = 2.5): number {
  return round(Math.round(kg / step) * step, 2)
}
