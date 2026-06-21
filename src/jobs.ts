/**
 * Background-job handler. Invoked by AppJobRoom (worker.ts) for every job picked
 * up from the queue. Dispatch on `job.type`; return the result value or throw to
 * fail. Long jobs checkpoint with `ctx.continue(state)` and resume on the next
 * alarm with `job.resumeFrom = state`.
 *
 * The 'generate-issue' job runs Scout's generation pipeline as the app owner:
 *   stage init     -> Haiku turns the scope into search queries
 *   stage discover -> Exa + Firecrawl per query, deduped (chunked, ~8/tick)
 *   stage sift     -> Haiku batch relevance + dedupe, keep top N (chunked, ~24/tick)
 *   stage compose  -> Sonnet writes the issue, parsed/validated, status -> ready
 *   stage deliver  -> render the email, send to the owner, advance the schedule
 *
 * Two contexts are in play: `jobCtx` (the JobContext, 2nd arg) gives
 * progress/continue/signal; `ctx` (a fresh owner CronContext built here) gives
 * records + owner-billed integrations.
 *
 * Idempotency: a draft issue row is created before the job is enqueued, so the
 * issueId is the natural key. The first tick only proceeds when the issue is
 * still 'draft'; a re-run that finds it 'ready'/'failed' no-ops. The owner is
 * the only (unmetered) user, so there is no credit ledger to debit.
 */

import type { Job, JobContext } from 'deepspace/worker'
import { buildCronContext } from 'deepspace/worker'
import type { Env } from '../worker'
import { MODELS, FUNNEL } from './config'
import { estimateIssueModelCents } from './lib/config-health'
import { generateQueries } from './lib/ai'
import {
  composeIssue,
  dedupeByUrl,
  discoverForQuery,
  siftCandidates,
  type NewsletterConfig,
} from './lib/pipeline'
import type { SourceItem } from './lib/sources'
import { errMsg } from './lib/sources'
import { deliverIssue, ownerEmailFrom } from './lib/delivery'
import type { IssueSection } from './lib/report-shape'

type Envelope<T> = { recordId: string; data: T }

export interface GenerateIssuePayload {
  newsletterId: string
  issueId: string
  trigger: 'manual' | 'cron'
}

/** JSON-serializable state carried across alarm ticks (no Set/Map). */
interface GenerateState {
  stage: 'discover' | 'sift' | 'compose'
  queries: string[]
  cursor: number // next query index to discover
  candidates: SourceItem[]
  errors: string[]
}

type CronCtx = ReturnType<typeof buildCronContext>

/** Read the subset of a newsletter row the pipeline needs. */
export function toConfig(data: Record<string, unknown>): NewsletterConfig {
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [])
  return {
    scope: typeof data.scope === 'string' && data.scope.trim() ? data.scope : String(data.topicRaw ?? ''),
    angle: typeof data.angle === 'string' ? data.angle : undefined,
    voicePreset: typeof data.voicePreset === 'string' ? data.voicePreset : undefined,
    voiceCustomPrompt: typeof data.voiceCustomPrompt === 'string' ? data.voiceCustomPrompt : undefined,
    recencyWindow: typeof data.recencyWindow === 'string' ? data.recencyWindow : '7d',
    location: typeof data.location === 'string' ? data.location : undefined,
    preferredDomains: arr(data.preferredDomains),
    blockedDomains: arr(data.blockedDomains),
    preferences: arr(data.preferences),
  }
}

async function failIssue(
  ctx: CronCtx,
  newsletterId: string,
  issueId: string,
  message: string,
): Promise<{ ok: false; error: string }> {
  await ctx.records.update('issues', issueId, { status: 'failed', runError: message })
  await ctx.records.update('newsletters', newsletterId, {
    lastRunStatus: 'failed',
    lastRunError: message,
  })
  return { ok: false, error: message }
}

export async function runJob(job: Job, jobCtx: JobContext, env: Env): Promise<unknown | void> {
  if (job.type !== 'generate-issue') throw new Error('Unknown job type: ' + job.type)

  const { newsletterId, issueId } = job.payload as GenerateIssuePayload
  const ctx = buildCronContext(env, env.OWNER_USER_ID, `app:${env.APP_NAME}`)

  // Load the newsletter (owner context, RBAC-bypassed, returns all rows).
  const newsletters = (await ctx.records.query('newsletters', {})) as Envelope<Record<string, unknown>>[]
  const newsletter = newsletters.find((n) => n.recordId === newsletterId)
  if (!newsletter) return failIssue(ctx, newsletterId, issueId, 'newsletter not found')
  const cfg = toConfig(newsletter.data)

  let state = job.resumeFrom as GenerateState | undefined

  // ---- First tick: claim the draft, generate queries ----
  if (!state) {
    const issues = (await ctx.records.query('issues', {})) as Envelope<Record<string, unknown>>[]
    const issue = issues.find((i) => i.recordId === issueId)
    if (!issue) throw new Error('generate-issue: issue not found')
    // Idempotency: only a fresh draft proceeds. A re-run on a finished issue no-ops.
    if (issue.data.status !== 'draft') return { ok: true, skipped: true, status: issue.data.status }

    await ctx.records.update('newsletters', newsletterId, { lastRunStatus: 'running', lastRunError: '' })
    await ctx.records.update('issues', issueId, { modelUsed: MODELS.sonnet })

    let queries: string[]
    try {
      queries = await generateQueries(
        env,
        { scope: cfg.scope, angle: cfg.angle, recencyWindow: cfg.recencyWindow, location: cfg.location },
        FUNNEL.maxQueries,
      )
    } catch (err) {
      return failIssue(ctx, newsletterId, issueId, `query generation failed: ${errMsg(err)}`)
    }
    if (queries.length === 0) {
      return failIssue(ctx, newsletterId, issueId, 'no search queries were produced for this scope')
    }
    state = { stage: 'discover', queries, cursor: 0, candidates: [], errors: [] }
  }

  if (jobCtx.signal.aborted) return { ok: false, error: 'aborted' }

  // ---- discover (chunked) ----
  if (state.stage === 'discover') {
    let done = 0
    while (done < FUNNEL.searchesPerTick && state.cursor < state.queries.length) {
      if (state.candidates.length >= FUNNEL.maxCandidates) break
      const { items, errors } = await discoverForQuery(ctx.integrations.call, cfg, state.queries[state.cursor])
      state.candidates = dedupeByUrl([...state.candidates, ...items]).slice(0, FUNNEL.maxCandidates)
      state.errors.push(...errors)
      state.cursor++
      done++
    }
    jobCtx.progress(0.4 * (state.cursor / state.queries.length), `found ${state.candidates.length} sources`)

    if (state.cursor >= state.queries.length || state.candidates.length >= FUNNEL.maxCandidates) {
      state.stage = 'sift'
    }
    jobCtx.continue(state, { afterMs: 0 })
    return
  }

  // ---- sift (one batched pass, then compose) ----
  if (state.stage === 'sift') {
    if (state.candidates.length === 0) {
      const why = state.errors.length ? ` (${state.errors.slice(0, 3).join('; ')})` : ''
      return failIssue(ctx, newsletterId, issueId, `no sources found for this scope${why}`)
    }
    let kept: SourceItem[]
    try {
      kept = await siftCandidates(env, cfg.scope, state.candidates)
    } catch (err) {
      return failIssue(ctx, newsletterId, issueId, `relevance judging failed: ${errMsg(err)}`)
    }
    if (kept.length === 0) {
      return failIssue(ctx, newsletterId, issueId, 'no sources cleared the relevance bar for this scope')
    }
    jobCtx.progress(0.7, `kept ${kept.length} stories`)
    // Carry the kept set forward as the candidate list for compose.
    state = { ...state, stage: 'compose', candidates: kept }
    jobCtx.continue(state, { afterMs: 0 })
    return
  }

  // ---- compose (one Sonnet call) ----
  jobCtx.progress(0.85, 'writing the issue')
  let issue
  try {
    const result = await composeIssue(env, cfg, state.candidates)
    issue = result.issue
  } catch (err) {
    return failIssue(ctx, newsletterId, issueId, `compose failed: ${errMsg(err)}`)
  }
  if (!issue) {
    return failIssue(ctx, newsletterId, issueId, 'the writer returned no usable issue (try regenerating)')
  }

  const thin = state.errors.length
    ? `Some sources could not be reached: ${state.errors.slice(0, 3).join('; ')}`
    : ''
  const generatedAt = Date.now()
  await ctx.records.update('issues', issueId, {
    title: issue.title,
    lead: issue.lead,
    sections: issue.sections,
    status: 'ready',
    generatedAt,
    costEstimate: estimateIssueModelCents(),
    runError: thin,
  })

  // ---- deliver: render + email the owner ----
  jobCtx.progress(0.95, 'sending the email')
  const data = newsletter.data
  const issueRows = (await ctx.records.query('issues', {})) as Envelope<Record<string, unknown>>[]
  const issueNumber = issueRows.find((i) => i.recordId === issueId)?.data.number
  const ownerEmail = ownerEmailFrom(
    (await ctx.records.query('users', {})) as { recordId: string; data: { email?: unknown } }[],
    env.OWNER_USER_ID,
  )
  const delivery = await deliverIssue(
    ctx.integrations.call,
    env,
    newsletterId,
    typeof data.title === 'string' ? data.title : 'Scout',
    {
      title: issue.title,
      lead: issue.lead,
      sections: issue.sections as IssueSection[],
      number: typeof issueNumber === 'number' ? issueNumber : undefined,
      generatedAt,
    },
    ownerEmail,
  )

  await ctx.records.update('issues', issueId, {
    emailStatus: delivery.status,
    emailError: delivery.error,
    ...(delivery.status === 'sent' ? { status: 'sent', sentAt: generatedAt } : {}),
  })

  // Record the run + the delivery time. The cron scanner owns the cadence
  // (nextSendAt) so the slot is advanced at scan time and never double-counted
  // here; a manual send must not move the schedule at all, lastSentAt is the
  // real delivery instant, which is only known here.
  await ctx.records.update('newsletters', newsletterId, {
    lastRunStatus: 'ok',
    lastRunError: '',
    lastSentAt: generatedAt,
  })

  jobCtx.progress(1, delivery.status === 'sent' ? 'sent' : 'ready')
  return { ok: true, sections: issue.sections.length, email: delivery.status }
}
