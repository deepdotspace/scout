/**
 * Schedule math: compute the next send instant from a newsletter's cadence.
 *
 * Pure and side-effect free so it is unit-testable hard. The hard part is doing
 * the day/time arithmetic in the reader's OWN timezone (IANA), not the worker's
 * UTC, so "weekly on Monday at 08:00 America/New_York" lands at the right epoch
 * across DST shifts. We never construct a Date from a local string (that uses
 * the runtime tz); instead we read the target tz's offset at a candidate instant
 * via Intl.DateTimeFormat and solve for the epoch whose wall-clock matches.
 *
 * Contract: nextSendAt is always strictly AFTER `fromMs` (the reference time),
 * so a scan that fires at exactly the due instant advances the schedule rather
 * than re-firing the same slot.
 */

import type { Frequency } from './types'

export interface Schedule {
  frequency: Frequency
  /** For 'custom': lowercase weekday names ('mon'..'sun'). Ignored otherwise. */
  days: string[]
  /** Local wall-clock time, 'HH:mm' (24h). */
  time: string
  /** IANA timezone, e.g. 'America/New_York'. */
  timezone: string
}

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
const DAY_MS = 86_400_000

/** Parse 'HH:mm' to { hour, minute }, clamped to valid ranges, default 09:00. */
function parseTime(time: string): { hour: number; minute: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim())
  if (!m) return { hour: 9, minute: 0 }
  const hour = Math.min(23, Math.max(0, Number(m[1])))
  const minute = Math.min(59, Math.max(0, Number(m[2])))
  return { hour, minute }
}

/**
 * The offset (ms east of UTC) that `timezone` is at for the given instant.
 * Derived by formatting the instant in the target tz and diffing the resulting
 * wall-clock against the same wall-clock read as UTC. DST-correct because the
 * offset is sampled at the instant itself.
 */
function tzOffsetMs(instantMs: number, timezone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = dtf.formatToParts(new Date(instantMs))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  let hour = get('hour')
  if (hour === 24) hour = 0 // some engines emit '24' for midnight
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'))
  return asUtc - instantMs
}

/**
 * The epoch ms at which the wall-clock in `timezone` reads
 * year-month-day hour:minute:00. Two-pass: estimate with the offset at the naive
 * UTC guess, then re-sample the offset at that guess and correct once. The
 * second pass handles the case where the first guess landed on the other side of
 * a DST boundary. (Nonexistent spring-forward local times resolve backward, to
 * the instant just before the gap. Harmless: it only affects the one slot a year
 * that falls inside the lost hour, and the issue still sends.)
 */
function zonedTimeToEpoch(
  y: number,
  mo: number,
  d: number,
  hour: number,
  minute: number,
  timezone: string,
): number {
  const naiveUtc = Date.UTC(y, mo, d, hour, minute, 0)
  let epoch = naiveUtc - tzOffsetMs(naiveUtc, timezone)
  epoch = naiveUtc - tzOffsetMs(epoch, timezone)
  return epoch
}

/** The 0..6 weekday (0=Sun) that `instantMs` falls on in `timezone`. */
function zonedWeekday(instantMs: number, timezone: string): number {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' })
    .formatToParts(new Date(instantMs))
    .find((p) => p.type === 'weekday')?.value
  const i = WEEKDAY_KEYS.indexOf((wd ?? '').slice(0, 3).toLowerCase() as (typeof WEEKDAY_KEYS)[number])
  return i < 0 ? 0 : i
}

/** The calendar Y/M/D that `instantMs` falls on in `timezone`. */
function zonedDateParts(instantMs: number, timezone: string): { y: number; mo: number; d: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(instantMs))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  return { y: get('year'), mo: get('month') - 1, d: get('day') }
}

/** Which weekdays (0=Sun..6=Sat) the schedule sends on. */
function allowedWeekdays(schedule: Schedule): Set<number> {
  switch (schedule.frequency) {
    case 'daily':
      return new Set([0, 1, 2, 3, 4, 5, 6])
    case 'weekdays':
      return new Set([1, 2, 3, 4, 5])
    case 'weekly':
    case 'custom': {
      const days = schedule.days
        .map((d) => WEEKDAY_KEYS.indexOf(d.slice(0, 3).toLowerCase() as (typeof WEEKDAY_KEYS)[number]))
        .filter((i) => i >= 0)
      // Weekly defaults to Monday if no day was picked; custom with no days is empty.
      if (days.length === 0) return schedule.frequency === 'weekly' ? new Set([1]) : new Set()
      return new Set(days)
    }
  }
}

/**
 * The next send instant strictly after `fromMs`, or null if the schedule can
 * never fire (custom with no days). Walks day by day in the reader's timezone,
 * placing the target wall-clock time on the first allowed weekday on or after
 * `fromMs`, and skips a same-day slot that has already passed.
 */
export function computeNextSendAt(schedule: Schedule, fromMs: number): number | null {
  const allowed = allowedWeekdays(schedule)
  if (allowed.size === 0) return null

  const { hour, minute } = parseTime(schedule.time)
  const tz = schedule.timezone || 'UTC'

  // Scan up to 8 days out (covers any weekly/custom gap) from the reader's
  // current calendar day, advancing one local day at a time.
  for (let offset = 0; offset <= 8; offset++) {
    // Step `offset` days forward, then re-read the calendar day in-tz so DST
    // day-length changes never drift the date.
    const probe = fromMs + offset * DAY_MS
    const { y, mo, d } = zonedDateParts(probe, tz)
    const candidate = zonedTimeToEpoch(y, mo, d, hour, minute, tz)
    if (candidate <= fromMs) continue // today's slot already passed (or is now)
    if (allowed.has(zonedWeekday(candidate, tz))) return candidate
  }
  return null
}

/**
 * The next send instant that is still in the FUTURE, walking the cadence
 * forward from the slot just fired.
 *
 * Why this exists: computeNextSendAt() advances exactly one slot from its
 * reference. Advancing from the fired slot rather than from `now` is what keeps
 * a scan that runs a few minutes late from dragging the cadence forward — for
 * any normal tick the very next slot is already in the future and this returns
 * it unchanged, one iteration, same answer as before.
 *
 * It only does more after an OUTAGE. If the scanner was down for weeks, one
 * step lands on a slot that is also long past, so the next tick fires again,
 * and again — replaying every missed slot as a fresh owner-billed issue, 15
 * minutes apart, until it catches up. A daily beat two months behind would
 * generate ~60 issues over ~15 hours. Missed sends are missed: the reader wants
 * this slot's news once, not sixty re-runs of today's headlines. So we fire
 * once and resync to the present by skipping the rest of the backlog.
 *
 * Returns null when the schedule can never fire again (custom with no days).
 */
export function nextSlotAfterNow(schedule: Schedule, firedSlotMs: number, nowMs: number): number | null {
  let next = computeNextSendAt(schedule, firedSlotMs)
  // Every pass advances at least a day (computeNextSendAt is strictly after its
  // reference), so even a years-long backlog settles in a few hundred passes.
  // The bound just keeps a pathological schedule from spinning. A null from any
  // pass ends the loop on its own and is returned as the never-fires signal.
  for (let guard = 0; next != null && next <= nowMs && guard < 4000; guard++) {
    next = computeNextSendAt(schedule, next)
  }
  return next
}
