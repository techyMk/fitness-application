import type { DateKey } from './types'

/** Local YYYY-MM-DD. Never use toISOString() — that shifts the day in IST. */
export function toKey(d: Date = new Date()): DateKey {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const today = () => toKey()

export function addDays(key: DateKey, n: number): DateKey {
  const d = fromKey(key)
  d.setDate(d.getDate() + n)
  return toKey(d)
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: DateKey, b: DateKey): number {
  const ms = fromKey(b).getTime() - fromKey(a).getTime()
  return Math.round(ms / 86_400_000)
}

/** Inclusive list of date keys. */
export function range(from: DateKey, to: DateKey): DateKey[] {
  const out: DateKey[] = []
  const n = daysBetween(from, to)
  for (let i = 0; i <= n; i++) out.push(addDays(from, i))
  return out
}

/** The last `n` days ending today, oldest first. */
export function lastNDays(n: number, end: DateKey = today()): DateKey[] {
  return range(addDays(end, -(n - 1)), end)
}

/** Monday-start week containing `key`. */
export function weekStart(key: DateKey): DateKey {
  const d = fromKey(key)
  const shift = (d.getDay() + 6) % 7
  return addDays(key, -shift)
}

export function weekRange(key: DateKey): [DateKey, DateKey] {
  const s = weekStart(key)
  return [s, addDays(s, 6)]
}

export function monthStart(key: DateKey): DateKey {
  const d = fromKey(key)
  return toKey(new Date(d.getFullYear(), d.getMonth(), 1))
}

export function monthDays(key: DateKey): DateKey[] {
  const d = fromKey(key)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  return range(monthStart(key), toKey(new Date(d.getFullYear(), d.getMonth(), last)))
}

/** Week number relative to a journey start, 1-based — "Week 7" in reviews. */
export function weekIndex(start: DateKey, key: DateKey): number {
  return Math.floor(daysBetween(weekStart(start), weekStart(key)) / 7) + 1
}

/* -------------------------------- display -------------------------------- */

export function fmtDate(key: DateKey, locale = 'en-IN'): string {
  return fromKey(key).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
}

export function fmtLongDate(key: DateKey, locale = 'en-IN'): string {
  return fromKey(key).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export function fmtWeekday(key: DateKey, locale = 'en-IN'): string {
  return fromKey(key).toLocaleDateString(locale, { weekday: 'short' })
}

export function relativeDay(key: DateKey): 'today' | 'yesterday' | null {
  const t = today()
  if (key === t) return 'today'
  if (key === addDays(t, -1)) return 'yesterday'
  return null
}

/** 7320 -> "2h 02m". Used for sleep and workout durations. */
export function fmtDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = Math.round(totalMinutes % 60)
  if (h === 0) return `${m}m`
  return `${h}h ${String(m).padStart(2, '0')}m`
}

export function fmtClock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** "22:45" + "06:15" -> 450 minutes, handling the midnight wrap. */
export function sleepMinutes(start: string, wake: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [wh, wm] = wake.split(':').map(Number)
  let mins = wh * 60 + wm - (sh * 60 + sm)
  if (mins <= 0) mins += 1440
  return mins
}
