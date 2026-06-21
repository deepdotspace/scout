/**
 * Config health - the honesty layer for a redeployer. Three cheap checks, each
 * resolved to a single status plus a plain-language reason on anything not ok.
 * Nothing here throws: a probe that fails is a status, not a crash, so the
 * Settings panel and the rail dot always render the truth.
 *
 * Checks:
 *  - owner:        the owner has a verified email on their users row.
 *  - email:        issues can actually be delivered, or are stuck in Resend
 *                  test mode (only the owner's own address) until a domain is
 *                  verified. Mirrors src/lib/delivery.ts exactly.
 *  - integrations: a cheap owner-billed probe of the search proxy. The proxy
 *                  masks provider failures to a generic 502, so we report the
 *                  surfaced reason verbatim and never pretend a down probe is ok.
 */

import { FUNNEL } from '../config'

export type OwnerStatus = 'set' | 'missing'
export type EmailStatus = 'delivering' | 'testmode' | 'misconfigured'
export type IntegrationStatus = 'ok' | 'down' | 'unknown'
export type ModelStatus = 'configured' | 'missing'
export type SchedulerStatus = 'running' | 'idle' | 'down'
export type StorageStatus = 'ok' | 'down'

export interface CheckResult<S> {
  status: S
  /** Empty when ok; a plain sentence on anything not ok. */
  reason: string
}

export interface ConfigHealth {
  owner: CheckResult<OwnerStatus> & { email: string }
  email: CheckResult<EmailStatus> & { from: string }
  integrations: CheckResult<IntegrationStatus>
  /** The owner-billed model proxy is wired (credential present). Not a live ping. */
  model: CheckResult<ModelStatus>
  /** The cron DO is bound and how many active beats are queued for a future run. */
  scheduler: CheckResult<SchedulerStatus> & { scheduled: number }
  /** The records store answered this very request, so it is reachable. */
  storage: CheckResult<StorageStatus>
}

/** Resend's always-valid test-mode sender, used until a domain is verified. Mirrors delivery.ts. */
export const DEFAULT_FROM = 'Scout <onboarding@resend.dev>'

/**
 * A grounded, labelled per-issue model-cost estimate in US cents. Derived from
 * the funnel caps in config.ts and Anthropic's published per-MTok pricing
 * (verified from the claude-api skill, 2026-06): Haiku 4.5 $1 in / $5 out,
 * Sonnet 4.6 $3 in / $15 out. This is the AI spend only. It does NOT include
 * Exa + Firecrawl search calls, whose per-search proxy price we have not been
 * able to verify, so the panel shows those as an unpriced addition. Everything
 * is owner-billed pass-through: the deployer pays their own DeepSpace account.
 */
const PRICE_PER_MTOK = {
  haikuIn: 1,
  haikuOut: 5,
  sonnetIn: 3,
  sonnetOut: 15,
} as const

export function estimateIssueModelCents(): number {
  // Haiku: one query-gen pass + one judge call per batch of candidates.
  const judgeCalls = Math.ceil(FUNNEL.maxCandidates / FUNNEL.judgeBatchSize)
  const haikuCalls = 1 + judgeCalls
  // Rough average tokens per Haiku call: a judge batch carries snippets in,
  // a small JSON verdict out. ~2k in / ~0.5k out is a fair central estimate.
  const haikuInTok = haikuCalls * 2000
  const haikuOutTok = haikuCalls * 500
  // Sonnet: one compose. Input is the kept stories' text; output a full issue.
  const sonnetInTok = FUNNEL.maxKept * FUNNEL.composeTextPerStory * 0.3 + 1000
  const sonnetOutTok = 2500
  const dollars =
    (haikuInTok * PRICE_PER_MTOK.haikuIn) / 1e6 +
    (haikuOutTok * PRICE_PER_MTOK.haikuOut) / 1e6 +
    (sonnetInTok * PRICE_PER_MTOK.sonnetIn) / 1e6 +
    (sonnetOutTok * PRICE_PER_MTOK.sonnetOut) / 1e6
  return Math.round(dollars * 100)
}

interface OwnerRow {
  recordId: string
  data: { email?: unknown }
}

/** The owner's verified email from the users row whose recordId is OWNER_USER_ID. */
export function ownerEmail(users: OwnerRow[], ownerUserId: string): string {
  const row = users.find((u) => u.recordId === ownerUserId)
  const email = row?.data?.email
  return typeof email === 'string' ? email.trim() : ''
}

/** Owner check: do we have an address to deliver to at all. */
export function ownerCheck(email: string): CheckResult<OwnerStatus> & { email: string } {
  if (email) return { status: 'set', reason: '', email }
  return {
    status: 'missing',
    reason: 'No verified owner email found. Sign in once so your address is stored, then reload.',
    email: '',
  }
}

/**
 * Email check. With no owner address there is nowhere to send (misconfigured).
 * With a custom EMAIL_FROM set, a domain is assumed verified and issues deliver.
 * Otherwise Resend test mode is in effect: it only delivers to the owner's own
 * verified address, which is exactly our single recipient, so this is honest,
 * working, and the right default. We still flag it so a redeployer knows the
 * limit before they try to add other recipients.
 */
export function emailCheck(
  owner: OwnerStatus,
  emailFrom: string | undefined,
): CheckResult<EmailStatus> & { from: string } {
  const from = (emailFrom || '').trim() || DEFAULT_FROM
  if (owner === 'missing') {
    return {
      status: 'misconfigured',
      reason: 'No owner email to deliver to. Resolve the owner check first.',
      from,
    }
  }
  if ((emailFrom || '').trim()) {
    return { status: 'delivering', reason: '', from }
  }
  return {
    status: 'testmode',
    reason:
      'Resend test mode. Issues reach your own verified address only. ' +
      'To send anywhere else, verify a domain at resend.com and set EMAIL_FROM in .dev.vars.',
    from,
  }
}

/**
 * Read the honest reason out of a thrown probe error or a success:false / message
 * envelope. The integration proxy flattens provider failures to a generic 502 and
 * tucks the real cause in a message field, so we dig for it.
 */
export function probeReason(value: unknown): string {
  if (value instanceof Error && value.message.trim()) return value.message.trim()
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>
    const data = o.data as Record<string, unknown> | undefined
    for (const v of [o.message, o.error, data?.message, data?.error]) {
      if (typeof v === 'string' && v.trim()) return v.trim()
    }
  }
  return 'Search providers did not respond. The proxy masks the exact reason; retry, or check the integration.'
}

/**
 * Model access. A live model ping is owner-billed, so we do NOT spend on every
 * Settings open. The honest, free signal is whether the owner's proxy credential
 * is wired: model calls route through the DeepSpace proxy as the owner (the
 * APP_OWNER_JWT subject). Present -> 'configured' (wired, not pinged). Absent ->
 * 'missing'. We never report a green "healthy" for a connection we have not made.
 */
export function modelCheck(ownerJwtPresent: boolean): CheckResult<ModelStatus> {
  if (ownerJwtPresent) return { status: 'configured', reason: '' }
  return {
    status: 'missing',
    reason: 'No owner credential found for the model proxy. Redeploy so APP_OWNER_JWT is set.',
  }
}

/**
 * Scheduler. The cron DO must be bound (it is part of the deploy manifest), and
 * the cadence only runs beats that carry a future nextSendAt. So the real signal
 * is: cron bound AND a count of active newsletters queued for a run. Bound with
 * at least one queued beat -> 'running'. Bound with none -> 'idle' (honest:
 * nothing to file, not a failure). Unbound -> 'down'.
 */
export function schedulerCheck(
  cronBound: boolean,
  scheduled: number,
): CheckResult<SchedulerStatus> & { scheduled: number } {
  if (!cronBound) {
    return { status: 'down', reason: 'The cron room is not bound. Redeploy to restore the scheduler.', scheduled: 0 }
  }
  if (scheduled > 0) return { status: 'running', reason: '', scheduled }
  return {
    status: 'idle',
    reason: 'No beats are scheduled. Create or resume a newsletter to give the scheduler something to file.',
    scheduled: 0,
  }
}

/**
 * Storage. The config-health request itself reads the owner row from the records
 * store, so a successful read is direct proof the store is reachable. We pass
 * that result in rather than probing twice.
 */
export function storageCheck(recordsReachable: boolean): CheckResult<StorageStatus> {
  if (recordsReachable) return { status: 'ok', reason: '' }
  return { status: 'down', reason: 'Could not reach your records store. Reload; if it persists, redeploy.' }
}

/** Count active newsletters queued for a future run (a real scheduler signal). */
export function countScheduled(
  rows: { data?: { status?: unknown; nextSendAt?: unknown } }[],
  now: number,
): number {
  return rows.filter(
    (r) => r.data?.status === 'active' && typeof r.data?.nextSendAt === 'number' && r.data.nextSendAt > now,
  ).length
}
