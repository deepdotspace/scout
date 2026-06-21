/**
 * Cron tasks: registered into AppCronRoom (worker.ts) at construction time.
 *
 * Scout runs ONE scanner, every 15 minutes, in owner context. Each tick scans
 * the owner's active newsletters whose computed nextSendAt has arrived, kicks off
 * a generate-issue job for each (a draft issue first, so the UI can watch it go
 * ready over live records), and advances nextSendAt to the next slot in the
 * reader's timezone. One scanner handles all newsletters, all frequencies, all
 * timezones, and custom days. No per-newsletter cron registration.
 *
 * Owner-billing note: this is a single-user app, so the owner is the only user
 * and owner-billed scanning/generation is correct. If Scout ever onboards other
 * users, the per-user debit pattern (debit the row's own user, skip the owner)
 * must be wired in.
 */

import type { CronTask } from 'deepspace/worker'
import { buildCronContext, enqueueJob } from 'deepspace/worker'
import type { Env } from '../worker'
import { computeNextSendAt, type Schedule } from './lib/schedule'

export const tasks: CronTask[] = [{ name: 'scan-due', intervalMinutes: 15 }]

// An issue stuck in 'draft' past this is a crashed/aborted Job (a live Job
// finishes well under 15 min); sweep it to a terminal 'failed' so the UI moves on.
const STALE_DRAFT_MS = 15 * 60 * 1000

type Envelope = { recordId: string; data: Record<string, unknown>; createdAt?: string }

/** Read the cadence fields a schedule needs off a newsletter row. */
function toSchedule(data: Record<string, unknown>): Schedule {
  const freq = data.frequency
  return {
    frequency:
      freq === 'daily' || freq === 'weekdays' || freq === 'weekly' || freq === 'custom' ? freq : 'weekly',
    days: Array.isArray(data.days) ? data.days.filter((d): d is string => typeof d === 'string') : [],
    time: typeof data.time === 'string' && data.time.trim() ? data.time : '09:00',
    timezone: typeof data.timezone === 'string' && data.timezone.trim() ? data.timezone : 'UTC',
  }
}

/**
 * Scan active newsletters whose slot has arrived; for each, create a draft
 * issue, enqueue generate-issue, and advance nextSendAt so the same slot is not
 * re-scanned on the next tick, nextSendAt is advanced from the OLD slot (not from
 * `now`) so a late scan does not drift the cadence forward.
 */
export async function scanDue(env: Env, now: number): Promise<void> {
  const ctx = buildCronContext(env, env.OWNER_USER_ID, `app:${env.APP_NAME}`)
  const newsletters = (await ctx.records.query('newsletters', {})) as Envelope[]

  for (const n of newsletters) {
    const data = n.data
    if (data.status !== 'active') continue
    const due = typeof data.nextSendAt === 'number' ? data.nextSendAt : null
    if (due == null || due > now) continue

    // Advance from the slot we are firing, not from `now`, so the next slot is
    // grounded in the cadence even if the scan ran late.
    const next = computeNextSendAt(toSchedule(data), due)

    // A schedule that can never fire again (custom with no days picked) would
    // otherwise leave nextSendAt unchanged and re-fire every tick, billing the
    // owner forever. Pause it with an honest reason instead.
    if (next == null) {
      await ctx.records.update('newsletters', n.recordId, {
        status: 'paused',
        lastRunStatus: 'idle',
        lastRunError: 'Paused: this custom schedule has no send days selected.',
      })
      continue
    }

    // Number the issue from the count of existing issues for this newsletter.
    const issues = (await ctx.records.query('issues', {})) as Envelope[]
    const number = issues.filter((i) => i.data.newsletterId === n.recordId).length + 1

    const created = await ctx.records.create('issues', {
      newsletterId: n.recordId,
      number,
      status: 'draft',
      emailStatus: 'pending',
      version: 1,
      ownerUserId: env.OWNER_USER_ID,
    })

    await ctx.records.update('newsletters', n.recordId, {
      lastRunStatus: 'running',
      lastRunError: '',
      nextSendAt: next,
    })

    await enqueueJob(
      env.JOB_ROOMS,
      `app:${env.APP_NAME}`,
      'generate-issue',
      { newsletterId: n.recordId, issueId: created.recordId, trigger: 'cron' },
      { maxAttempts: 1, enqueuedBy: env.OWNER_USER_ID },
    )
  }

  // Sweep stuck drafts: a mid-Job isolate crash (maxAttempts:1) or a throw in
  // the scan above can leave an issue 'draft' forever. Any draft older than
  // STALE_DRAFT_MS is a dead Job; mark it 'failed' with the same fields the
  // compose-failure path sets (jobs.ts failIssue), so it reaches a terminal
  // state. Idempotent (only draft -> failed); a live Job finishes well under
  // the window, so this never races one. One failure must not abort the tick.
  const issues = (await ctx.records.query('issues', { where: { status: 'draft' } })) as Envelope[]
  for (const issue of issues) {
    if (issue.data.status !== 'draft') continue
    const createdAt = issue.createdAt ? Date.parse(issue.createdAt) : NaN
    if (!Number.isFinite(createdAt) || now - createdAt < STALE_DRAFT_MS) continue
    try {
      await ctx.records.update('issues', issue.recordId, {
        status: 'failed',
        runError: 'Generation did not finish (the run was interrupted).',
      })
    } catch {
      // Best-effort: one bad row must not stop the rest of the sweep.
    }
  }
}

export async function runTask(name: string, env: Env): Promise<void> {
  if (name === 'scan-due') await scanDue(env, Date.now())
}
