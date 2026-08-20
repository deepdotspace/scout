import { describe, it, expect } from 'vitest'
import {
  ownerEmail,
  ownerCheck,
  emailCheck,
  probeReason,
  estimateIssueModelCents,
  modelCheck,
  schedulerCheck,
  storageCheck,
  countScheduled,
  countOverdue,
  OVERDUE_GRACE_MS,
} from '../../src/lib/config-health'

describe('ownerEmail', () => {
  it('reads the email off the row whose recordId is the owner id', () => {
    const rows = [
      { recordId: 'other', data: { email: 'nope@x.com' } },
      { recordId: 'owner-1', data: { email: '  me@scout.app  ' } },
    ]
    expect(ownerEmail(rows, 'owner-1')).toBe('me@scout.app')
  })
  it('returns empty when the owner row is missing or has no email', () => {
    expect(ownerEmail([], 'owner-1')).toBe('')
    expect(ownerEmail([{ recordId: 'owner-1', data: {} }], 'owner-1')).toBe('')
  })
})

describe('ownerCheck', () => {
  it('is set with an email, missing without, and always names what to do', () => {
    expect(ownerCheck('me@scout.app')).toMatchObject({ status: 'set', reason: '', email: 'me@scout.app' })
    const missing = ownerCheck('')
    expect(missing.status).toBe('missing')
    expect(missing.reason).toMatch(/sign in/i)
  })
})

describe('emailCheck (mirrors delivery.ts)', () => {
  it('is misconfigured when there is no owner address to send to', () => {
    expect(emailCheck('missing', 'Scout <hi@scout.app>').status).toBe('misconfigured')
  })
  it('delivers when a custom EMAIL_FROM is set and the owner is known', () => {
    const r = emailCheck('set', 'Scout <hi@scout.app>')
    expect(r.status).toBe('delivering')
    expect(r.from).toBe('Scout <hi@scout.app>')
  })
  it('is test mode (with the default sender) when EMAIL_FROM is unset', () => {
    const r = emailCheck('set', undefined)
    expect(r.status).toBe('testmode')
    expect(r.from).toMatch(/onboarding@resend\.dev/)
    expect(r.reason).toMatch(/EMAIL_FROM/)
  })
  it('treats a blank EMAIL_FROM as unset', () => {
    expect(emailCheck('set', '   ').status).toBe('testmode')
  })
})

describe('probeReason (unmasks the proxy)', () => {
  it('pulls the message out of a thrown error', () => {
    expect(probeReason(new Error('Integration call exa/search failed: 402'))).toMatch(/402/)
  })
  it('digs the reason out of a success:false / message envelope', () => {
    expect(probeReason({ success: false, error: 'Insufficient credits' })).toBe('Insufficient credits')
    expect(probeReason({ data: { message: 'upstream timeout' } })).toBe('upstream timeout')
  })
  it('falls back to an honest sentence when the proxy gives nothing', () => {
    expect(probeReason({})).toMatch(/did not respond/i)
  })
})

describe('estimateIssueModelCents', () => {
  it('produces a small, positive, labelled cents figure', () => {
    const cents = estimateIssueModelCents()
    expect(cents).toBeGreaterThan(0)
    expect(cents).toBeLessThan(100) // a single issue is cents, not dollars
  })
})

describe('modelCheck (no live ping; honest about wiring)', () => {
  it('is configured when the owner proxy credential is present', () => {
    expect(modelCheck(true)).toMatchObject({ status: 'configured', reason: '' })
  })
  it('is missing (not a faked green) when the credential is absent', () => {
    const r = modelCheck(false)
    expect(r.status).toBe('missing')
    expect(r.reason).toMatch(/APP_OWNER_JWT/)
  })
})

describe('schedulerCheck (missed slots, not just a binding)', () => {
  it('is down when the cron room is not bound', () => {
    const r = schedulerCheck(false, 3, 0)
    expect(r.status).toBe('down')
    expect(r.scheduled).toBe(0)
  })
  it('is running with a real queued count when bound and nothing was missed', () => {
    expect(schedulerCheck(true, 2, 0)).toMatchObject({ status: 'running', scheduled: 2, overdue: 0 })
  })
  it('is idle (not green) when bound but nothing is scheduled', () => {
    const r = schedulerCheck(true, 0, 0)
    expect(r.status).toBe('idle')
    expect(r.reason).toMatch(/no beats/i)
  })

  // The regression this check exists for: the scheduler reported healthy for
  // two months on binding-existence alone while no tick had ever fired.
  it('is DOWN when a beat sat past a slot that never fired, even with the room bound', () => {
    const r = schedulerCheck(true, 1, 3)
    expect(r.status).toBe('down')
    expect(r.overdue).toBe(3)
    expect(r.reason).toMatch(/not running/i)
  })
  it('lets a missed slot outrank a healthy queued count', () => {
    // Exactly the production shape: one future beat, three stalled ones.
    expect(schedulerCheck(true, 1, 3).status).not.toBe('running')
  })
  it('reads naturally for a single overdue beat', () => {
    expect(schedulerCheck(true, 0, 1).reason).toMatch(/1 active newsletter is/)
  })
})

describe('countOverdue (proof a tick did not run)', () => {
  const now = 1_800_000_000_000
  const row = (status: string, nextSendAt: unknown) => ({ data: { status, nextSendAt } })

  it('counts an active beat left well past its slot', () => {
    expect(countOverdue([row('active', now - 60 * 86_400_000)], now)).toBe(1)
  })
  it('ignores a beat queued for the future', () => {
    expect(countOverdue([row('active', now + 3_600_000)], now)).toBe(0)
  })
  it('does not cry wolf inside the grace window (a scan is allowed to be late)', () => {
    expect(countOverdue([row('active', now - (OVERDUE_GRACE_MS - 60_000))], now)).toBe(0)
  })
  it('flags a beat once it is past the grace window', () => {
    expect(countOverdue([row('active', now - (OVERDUE_GRACE_MS + 60_000))], now)).toBe(1)
  })
  it('ignores paused beats — a paused schedule is meant to sit still', () => {
    expect(countOverdue([row('paused', now - 60 * 86_400_000)], now)).toBe(0)
  })
  it('ignores rows with no usable nextSendAt', () => {
    expect(countOverdue([row('active', undefined), row('active', 'soon')], now)).toBe(0)
  })
})

describe('storageCheck (reachability proven by the request itself)', () => {
  it('is ok when the records read succeeded', () => {
    expect(storageCheck(true)).toMatchObject({ status: 'ok', reason: '' })
  })
  it('is down when the records read failed', () => {
    expect(storageCheck(false).status).toBe('down')
  })
})

describe('countScheduled', () => {
  const now = 1_000_000
  it('counts only active beats with a future nextSendAt', () => {
    const rows = [
      { data: { status: 'active', nextSendAt: now + 1000 } }, // counts
      { data: { status: 'active', nextSendAt: now - 1000 } }, // past, skip
      { data: { status: 'paused', nextSendAt: now + 1000 } }, // paused, skip
      { data: { status: 'active' } }, // no schedule, skip
      { data: {} }, // empty, skip
    ]
    expect(countScheduled(rows, now)).toBe(1)
  })
})
