import { describe, it, expect } from 'vitest'
import { computeNextSendAt, nextSlotAfterNow, type Schedule } from '../../src/lib/schedule'

// The function returns an epoch ms; we assert by reading that instant back in the
// schedule's OWN timezone (so the test is timezone-of-the-runner independent) and
// checking the wall-clock time, the weekday, and that it is strictly future.

function wallClock(ms: number, tz: string) {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(ms))
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? ''
  let hour = get('hour')
  if (hour === '24') hour = '00'
  return { weekday: get('weekday').toLowerCase(), hm: `${hour}:${get('minute')}` }
}

function sched(over: Partial<Schedule>): Schedule {
  return { frequency: 'daily', days: [], time: '07:00', timezone: 'UTC', ...over }
}

describe('computeNextSendAt', () => {
  it('daily: next 07:00 UTC is strictly in the future at the right wall-clock', () => {
    // Reference: 2026-06-18 05:00 UTC. Same-day 07:00 has not passed yet.
    const from = Date.parse('2026-06-18T05:00:00Z')
    const next = computeNextSendAt(sched({ frequency: 'daily', time: '07:00', timezone: 'UTC' }), from)!
    expect(next).toBeGreaterThan(from)
    const w = wallClock(next, 'UTC')
    expect(w.hm).toBe('07:00')
    // Same calendar day.
    expect(new Date(next).toISOString().slice(0, 10)).toBe('2026-06-18')
  })

  it('daily: same-day slot already passed rolls to the NEXT day (boundary)', () => {
    // Reference 09:00 UTC, slot is 07:00 -> must be tomorrow, not today.
    const from = Date.parse('2026-06-18T09:00:00Z')
    const next = computeNextSendAt(sched({ frequency: 'daily', time: '07:00', timezone: 'UTC' }), from)!
    expect(wallClock(next, 'UTC').hm).toBe('07:00')
    expect(new Date(next).toISOString().slice(0, 10)).toBe('2026-06-19')
  })

  it('daily: a slot exactly equal to the reference instant advances (never re-fires same slot)', () => {
    const from = Date.parse('2026-06-18T07:00:00Z')
    const next = computeNextSendAt(sched({ frequency: 'daily', time: '07:00', timezone: 'UTC' }), from)!
    expect(next).toBeGreaterThan(from)
    expect(new Date(next).toISOString().slice(0, 10)).toBe('2026-06-19')
  })

  it('weekdays: Friday evening skips the weekend to Monday', () => {
    // 2026-06-19 is a Friday. After Friday 09:00, next weekday slot is Monday 06-22.
    const from = Date.parse('2026-06-19T10:00:00Z')
    const next = computeNextSendAt(sched({ frequency: 'weekdays', time: '08:00', timezone: 'UTC' }), from)!
    const w = wallClock(next, 'UTC')
    expect(w.weekday).toBe('mon')
    expect(w.hm).toBe('08:00')
    expect(new Date(next).toISOString().slice(0, 10)).toBe('2026-06-22')
  })

  it('weekly on Monday: from a Wednesday lands on the following Monday', () => {
    // 2026-06-17 is a Wednesday. Weekly Monday -> 2026-06-22.
    const from = Date.parse('2026-06-17T12:00:00Z')
    const next = computeNextSendAt(
      sched({ frequency: 'weekly', days: ['mon'], time: '09:00', timezone: 'UTC' }),
      from,
    )!
    expect(wallClock(next, 'UTC').weekday).toBe('mon')
    expect(new Date(next).toISOString().slice(0, 10)).toBe('2026-06-22')
  })

  it('weekly with no day picked defaults to Monday', () => {
    const from = Date.parse('2026-06-17T12:00:00Z')
    const next = computeNextSendAt(sched({ frequency: 'weekly', days: [], time: '09:00', timezone: 'UTC' }), from)!
    expect(wallClock(next, 'UTC').weekday).toBe('mon')
  })

  it('custom days: picks the nearest of Tue/Thu after the reference', () => {
    // 2026-06-17 Wed -> nearest of {tue,thu} is Thu 2026-06-18.
    const from = Date.parse('2026-06-17T12:00:00Z')
    const next = computeNextSendAt(
      sched({ frequency: 'custom', days: ['tue', 'thu'], time: '07:30', timezone: 'UTC' }),
      from,
    )!
    expect(wallClock(next, 'UTC').weekday).toBe('thu')
    expect(wallClock(next, 'UTC').hm).toBe('07:30')
    expect(new Date(next).toISOString().slice(0, 10)).toBe('2026-06-18')
  })

  it('custom with no days never fires (returns null)', () => {
    const from = Date.parse('2026-06-17T12:00:00Z')
    expect(computeNextSendAt(sched({ frequency: 'custom', days: [], timezone: 'UTC' }), from)).toBeNull()
  })

  it('non-UTC timezone: 08:00 America/New_York is correct in local wall-clock', () => {
    // EDT in June is UTC-4, so 08:00 New York == 12:00 UTC. Reference is before that.
    const from = Date.parse('2026-06-18T05:00:00Z')
    const next = computeNextSendAt(
      sched({ frequency: 'daily', time: '08:00', timezone: 'America/New_York' }),
      from,
    )!
    expect(next).toBeGreaterThan(from)
    expect(wallClock(next, 'America/New_York').hm).toBe('08:00')
    // 08:00 EDT == 12:00 UTC.
    expect(new Date(next).toISOString()).toBe('2026-06-18T12:00:00.000Z')
  })

  it('non-UTC timezone east of UTC: 09:00 Asia/Kolkata (UTC+5:30) maps correctly', () => {
    // 09:00 Kolkata == 03:30 UTC. Reference 02:00 UTC -> same-day 03:30 UTC.
    const from = Date.parse('2026-06-18T02:00:00Z')
    const next = computeNextSendAt(
      sched({ frequency: 'daily', time: '09:00', timezone: 'Asia/Kolkata' }),
      from,
    )!
    expect(wallClock(next, 'Asia/Kolkata').hm).toBe('09:00')
    expect(new Date(next).toISOString()).toBe('2026-06-18T03:30:00.000Z')
  })

  it('crosses a DST spring-forward boundary and still lands at the local wall-clock', () => {
    // US DST began 2026-03-08. A weekly Monday at 08:00 New York scheduled from
    // the prior week must still read 08:00 local on the post-DST Monday 03-09.
    const from = Date.parse('2026-03-04T12:00:00Z') // Wed before the change
    const next = computeNextSendAt(
      sched({ frequency: 'weekly', days: ['mon'], time: '08:00', timezone: 'America/New_York' }),
      from,
    )!
    expect(wallClock(next, 'America/New_York').weekday).toBe('mon')
    expect(wallClock(next, 'America/New_York').hm).toBe('08:00')
    // 2026-03-09 is after the spring-forward, so EDT (UTC-4): 08:00 -> 12:00 UTC.
    expect(new Date(next).toISOString()).toBe('2026-03-09T12:00:00.000Z')
  })
})

// nextSlotAfterNow is what scanDue actually calls. It keeps computeNextSendAt's
// "advance from the fired slot, not from now" behaviour for a normal tick, and
// only diverges after an outage, where advancing one slot at a time would
// replay every missed slot as its own owner-billed issue.
describe('nextSlotAfterNow (catch up once, never replay a backlog)', () => {
  it('is identical to a one-step advance when the scan is only minutes late', () => {
    const due = Date.parse('2026-06-18T07:00:00Z')
    const now = due + 4 * 60_000 // scanned 4 minutes after the slot
    const s = sched({ frequency: 'daily', time: '07:00', timezone: 'UTC' })
    expect(nextSlotAfterNow(s, due, now)).toBe(computeNextSendAt(s, due))
  })

  it('does not drift the cadence forward when a tick runs late', () => {
    // The slot is 07:00. Scanning at 07:14 must still land tomorrow at 07:00,
    // not 07:14 tomorrow — this is why we advance from `due`, not from `now`.
    const due = Date.parse('2026-06-18T07:00:00Z')
    const next = nextSlotAfterNow(
      sched({ frequency: 'daily', time: '07:00', timezone: 'UTC' }),
      due,
      due + 14 * 60_000,
    )!
    expect(new Date(next).toISOString()).toBe('2026-06-19T07:00:00.000Z')
  })

  it('skips a two-month daily backlog to the next future slot in ONE step', () => {
    // The production shape: a daily beat stuck at 2026-06-21 while now is
    // 2026-08-20. A one-step advance would return 06-22 and re-fire ~60 times.
    const due = Date.parse('2026-06-21T07:00:00Z')
    const now = Date.parse('2026-08-20T03:10:00Z')
    const next = nextSlotAfterNow(sched({ frequency: 'daily', time: '07:00', timezone: 'UTC' }), due, now)!
    expect(next).toBeGreaterThan(now)
    expect(new Date(next).toISOString()).toBe('2026-08-20T07:00:00.000Z')
    expect(wallClock(next, 'UTC').hm).toBe('07:00')
  })

  it('skips a weekly backlog and still lands on the right weekday', () => {
    const due = Date.parse('2026-06-22T08:00:00Z') // a Monday
    const now = Date.parse('2026-08-20T03:10:00Z')
    const next = nextSlotAfterNow(
      sched({ frequency: 'weekly', days: ['mon'], time: '08:00', timezone: 'UTC' }),
      due,
      now,
    )!
    expect(next).toBeGreaterThan(now)
    expect(wallClock(next, 'UTC').weekday).toBe('mon')
    expect(wallClock(next, 'UTC').hm).toBe('08:00')
  })

  it('always returns an instant strictly in the future', () => {
    const now = Date.parse('2026-08-20T03:10:00Z')
    for (const daysBack of [0, 1, 7, 30, 200]) {
      const due = now - daysBack * 86_400_000
      const next = nextSlotAfterNow(sched({ frequency: 'weekdays', time: '09:00', timezone: 'UTC' }), due, now)!
      expect(next).toBeGreaterThan(now)
    }
  })

  it('preserves the never-fires signal so scanDue can pause the newsletter', () => {
    const now = Date.parse('2026-08-20T03:10:00Z')
    expect(nextSlotAfterNow(sched({ frequency: 'custom', days: [] }), now - 86_400_000, now)).toBeNull()
  })
})
