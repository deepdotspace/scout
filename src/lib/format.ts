/**
 * Display formatters: schedules, relative times, send labels. Kept pure and
 * small so cards and chips read the same way everywhere. Tabular numerals are
 * applied at the component layer (the `tnum` class), not here.
 */

import type { Frequency, Newsletter } from './types'

const FREQUENCY_LABEL: Record<Frequency, string> = {
  daily: 'Daily',
  weekdays: 'Weekdays',
  weekly: 'Weekly',
  custom: 'Custom',
}

/** "Daily at 7:00" / "Weekly at 8:30". Falls back gracefully on partial data. */
export function scheduleLabel(n: Pick<Newsletter, 'frequency' | 'time'>): string {
  const freq = FREQUENCY_LABEL[n.frequency] ?? 'Scheduled'
  return n.time ? `${freq} at ${n.time}` : freq
}

/** A short relative time: "just now", "3h ago", "2d ago", "Apr 12". */
export function relativeTime(ts?: number): string {
  if (!ts) return ''
  const diff = Date.now() - ts
  const min = Math.round(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** A forward-looking label for the next scheduled send. */
export function nextSendLabel(ts?: number): string {
  if (!ts) return 'Not scheduled'
  const diff = ts - Date.now()
  if (diff <= 0) return 'Due now'
  const hr = Math.round(diff / 3600000)
  if (hr < 1) return 'Within the hour'
  if (hr < 24) return `In ${hr}h`
  const day = Math.round(hr / 24)
  if (day === 1) return 'Tomorrow'
  if (day < 7) return `In ${day}d`
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
