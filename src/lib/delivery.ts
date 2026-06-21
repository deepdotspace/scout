/**
 * Stage 4 delivery, render a ready issue and email it to the newsletter owner.
 *
 * Owner-billed (the integration call is signed with APP_OWNER_JWT inside the
 * cron/job context). The owner's recipient address comes from the SDK `users`
 * collection: the row whose recordId is OWNER_USER_ID carries the verified
 * `email`. Resend test mode only delivers to that verified owner address until a
 * sending domain is verified, so emailing the owner is exactly the right (and
 * only reliable) target until then.
 *
 * Honest failure: a Resend 403 / test-mode rejection hides its real reason in a
 * `message` field of the response. We pull that out, clean it to one plain line
 * (see cleanEmailError), and report a 'failed' status WITHOUT throwing, so the
 * issue is kept and the run still ends 'ok' (the issue exists, only the email
 * did not land).
 */

import { renderIssueEmail } from './email'
import type { IssueSection } from './report-shape'

/** Resend's always-valid test-mode sender. Override with env EMAIL_FROM once a domain is verified. */
const DEFAULT_FROM = 'Scout <onboarding@resend.dev>'

type IntegrationCall = (endpoint: string, params?: Record<string, unknown>) => Promise<unknown>

interface OwnerRecord {
  recordId: string
  data: { email?: unknown }
}

export interface DeliverEnv {
  OWNER_USER_ID: string
  APP_NAME: string
  APP_OWNER_JWT: string
  EMAIL_FROM?: string
  APP_URL?: string
}

export interface DeliverIssue {
  title: string
  lead: string
  sections: IssueSection[]
  number?: number
  generatedAt?: number
}

export interface DeliverResult {
  status: 'sent' | 'failed' | 'skipped'
  /** Honest reason on failure/skip, cleaned to one plain line for the UI. */
  error: string
  /** The rendered HTML, returned so a test harness can save / inspect it. */
  html: string
  /** The resolved recipient (empty when it could not be resolved). */
  to: string
}

/** The deployed origin for the manage link. Defaults to the .app.space subdomain. */
function appUrl(env: DeliverEnv): string {
  return (env.APP_URL || `https://${env.APP_NAME}.app.space`).replace(/\/+$/, '')
}

/** Find the owner's verified email from the users collection (recordId === OWNER_USER_ID). */
export function ownerEmailFrom(users: OwnerRecord[], ownerUserId: string): string {
  const row = users.find((u) => u.recordId === ownerUserId)
  const email = row?.data?.email
  return typeof email === 'string' ? email.trim() : ''
}

/** Pull the real reason out of a Resend/proxy response (it hides the 403 in `message`). */
function extractError(res: unknown): string {
  if (!res || typeof res !== 'object') return cleanEmailError('')
  const o = res as Record<string, unknown>
  const data = o.data as Record<string, unknown> | undefined
  for (const v of [o.message, o.error, data?.message, data?.error]) {
    if (typeof v === 'string' && v.trim()) return cleanEmailError(v.trim())
  }
  return cleanEmailError('')
}

/**
 * Turn a raw Resend/proxy error into one clean plain-language line for the UI.
 * Resend's verbose bodies (and the test-mode 403 in particular) read like a
 * stack of instructions; we map the cases we know to a short sentence and trim
 * anything else to its first sentence so the run view never shows a JSON blob.
 */
export function cleanEmailError(raw: string): string {
  const msg = raw.trim()
  if (!msg) return 'Email could not be sent. Check your email setup in Settings, then resend.'
  const low = msg.toLowerCase()
  if (low.includes('your own email address') || (low.includes('verify a domain') && low.includes('testing'))) {
    return 'Resend test mode only delivers to your own verified address. Verify a domain at resend.com and set EMAIL_FROM to send elsewhere.'
  }
  if (low.includes('not authorized') || low.includes('forbidden') || low.includes('403') || low.includes('api key')) {
    return 'Email was rejected (not authorized). Check your Resend API key and sending domain in Settings.'
  }
  if (low.includes('rate limit') || low.includes('too many')) {
    return 'Email was rate limited by Resend. Wait a moment, then resend.'
  }
  // Unknown reason: first sentence only, capped, so it stays one readable line.
  const firstSentence = msg.split(/(?<=[.!?])\s/)[0]
  const oneLine = firstSentence.replace(/\s+/g, ' ').trim()
  return oneLine.length > 160 ? `${oneLine.slice(0, 157)}...` : oneLine
}

/**
 * Render the issue and send it to the owner. Never throws on a delivery problem:
 * a missing recipient, a thrown integration call, or a success:false / message
 * envelope all resolve to a 'failed'/'skipped' result carrying the honest reason
 * and the rendered HTML.
 */
export async function deliverIssue(
  call: IntegrationCall,
  env: DeliverEnv,
  newsletterId: string,
  newsletterTitle: string,
  issue: DeliverIssue,
  ownerEmail: string,
): Promise<DeliverResult> {
  const manageLink = `${appUrl(env)}/n/${encodeURIComponent(newsletterId)}`
  const html = renderIssueEmail({
    issue,
    newsletterTitle,
    issueNumber: issue.number,
    generatedAt: issue.generatedAt,
    manageLink,
  })

  if (!ownerEmail) {
    return {
      status: 'skipped',
      error: 'No verified owner email found. Set the owner address (users row) before sending.',
      html,
      to: '',
    }
  }

  const subject = issue.title || newsletterTitle || 'Your Scout issue'
  let res: unknown
  try {
    res = await call('email/send', {
      from: env.EMAIL_FROM || DEFAULT_FROM,
      to: ownerEmail,
      subject,
      html,
    })
  } catch (err) {
    return {
      status: 'failed',
      error: cleanEmailError(err instanceof Error ? err.message : String(err)),
      html,
      to: ownerEmail,
    }
  }

  // ctx.integrations.call unwraps to `data` on success; a raw/proxy call may hand
  // back the { success, data, error } envelope instead. A send succeeded when we
  // have a Resend message id (unwrapped `{id}` or wrapped `{data:{id}}`) and the
  // envelope is not explicitly success:false. Only then is an error/message key a
  // real failure reason (a successful payload could legitimately carry neither).
  const o = (res ?? {}) as Record<string, unknown>
  const data = o.data as Record<string, unknown> | undefined
  const hasId = typeof o.id === 'string' || typeof data?.id === 'string'
  if (o.success !== false && hasId) return { status: 'sent', error: '', html, to: ownerEmail }
  if (o.success === false || typeof o.error === 'string' || typeof o.message === 'string') {
    return { status: 'failed', error: extractError(res), html, to: ownerEmail }
  }

  // No id and no explicit failure signal: treat as sent (owner-context call would
  // have thrown on a non-2xx; a 2xx with an opaque body is a success).
  return { status: 'sent', error: '', html, to: ownerEmail }
}
