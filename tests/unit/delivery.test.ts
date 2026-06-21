import { describe, it, expect } from 'vitest'
import { deliverIssue, ownerEmailFrom, type DeliverEnv, type DeliverIssue } from '../../src/lib/delivery'

const ENV: DeliverEnv = {
  OWNER_USER_ID: 'owner-1',
  APP_NAME: 'scout',
  APP_OWNER_JWT: 'test-secret',
  APP_URL: 'https://scout.app.space',
}

const ISSUE: DeliverIssue = {
  title: 'Issue title',
  lead: 'Lead.',
  sections: [
    { headline: 'H', summary: 'S', sourceName: 'example.com', sourceUrl: 'https://example.com/a' },
  ],
}

function deliver(call: (ep: string, p?: Record<string, unknown>) => Promise<unknown>, ownerEmail: string) {
  return deliverIssue(call, ENV, 'nl-1', 'My Newsletter', ISSUE, ownerEmail)
}

describe('ownerEmailFrom', () => {
  it('returns the email of the row whose recordId is the owner', () => {
    const users = [
      { recordId: 'someone', data: { email: 'no@x.com' } },
      { recordId: 'owner-1', data: { email: ' owner@x.com ' } },
    ]
    expect(ownerEmailFrom(users, 'owner-1')).toBe('owner@x.com')
  })
  it('returns empty string when the owner row or email is missing', () => {
    expect(ownerEmailFrom([], 'owner-1')).toBe('')
    expect(ownerEmailFrom([{ recordId: 'owner-1', data: {} }], 'owner-1')).toBe('')
  })
})

describe('deliverIssue', () => {
  it('skips (does not call) when there is no recipient, still returns the html', async () => {
    let called = false
    const res = await deliver(async () => ((called = true), {}), '')
    expect(called).toBe(false)
    expect(res.status).toBe('skipped')
    expect(res.html).toContain('Issue title')
    expect(res.error).toMatch(/owner email/i)
  })

  it('reports sent on an unwrapped Resend payload { id }', async () => {
    const res = await deliver(async () => ({ id: 're_123' }), 'owner@x.com')
    expect(res.status).toBe('sent')
    expect(res.error).toBe('')
    expect(res.to).toBe('owner@x.com')
  })

  it('reports sent on a wrapped envelope { success:true, data:{ id } }', async () => {
    const res = await deliver(async () => ({ success: true, data: { id: 're_123' } }), 'owner@x.com')
    expect(res.status).toBe('sent')
  })

  it('cleans the Resend test-mode 403 (hidden in `message`) to one plain line', async () => {
    const raw =
      'Resend API error 403: You can only send testing emails to your own email address.'
    const res = await deliver(
      async () => ({ success: false, error: 'upstream_provider_error', message: raw }),
      'owner@x.com',
    )
    expect(res.status).toBe('failed')
    // The raw verbose body is mapped to a short, actionable line for the UI.
    expect(res.error).toBe(
      'Resend test mode only delivers to your own verified address. Verify a domain at resend.com and set EMAIL_FROM to send elsewhere.',
    )
    expect(res.error).not.toContain('403')
  })

  it('reports failed (not thrown) when the integration call throws', async () => {
    const res = await deliver(async () => {
      throw new Error('network down')
    }, 'owner@x.com')
    expect(res.status).toBe('failed')
    expect(res.error).toBe('network down')
  })

  it('renders the manage link into the footer with the deployed origin', async () => {
    const res = await deliver(async () => ({ id: 're_1' }), 'owner@x.com')
    // The owner is signed in on their own deploy, so the footer links plainly to
    // the newsletter page (no signed ?t= token, which nothing consumed).
    expect(res.html).toContain('https://scout.app.space/n/nl-1')
    expect(res.html).not.toContain('?t=')
  })
})
