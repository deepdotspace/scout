/**
 * useGeneration: watch one draft issue go ready (or failed) over live records.
 *
 * The issue record carries no live progress-stage field; the only real signal
 * the worker emits is the `status` flip (draft -> ready/sent, or draft ->
 * failed) plus, once ready, the real post-run fields (sections, costEstimate,
 * emailStatus). So this hook reports the honest record state and leaves the
 * stage rhythm to the view. It never fabricates a count or a percentage.
 *
 * `phase` collapses the four statuses into what the view needs:
 *   running . the draft is still being written (status 'draft')
 *   ready   . written and reachable (status 'ready' or 'sent')
 *   failed  . the run failed before it could be written (status 'failed')
 *   missing . no such issue (deleted, or a bad id), distinct from loading
 */

import { useMemo } from 'react'
import { useQuery } from 'deepspace'
import type { Issue } from './types'

export type GenerationPhase = 'loading' | 'running' | 'ready' | 'failed' | 'missing'

export interface GenerationState {
  phase: GenerationPhase
  issue?: Issue
  /** Real stories kept, known only once ready. Never shown mid-run. */
  storyCount?: number
  /** Per-issue cost in cents, set by the job. Indicative until verified. */
  costCents?: number
  /** Honest hard-failure reason (status 'failed'); not the soft "thin" warning. */
  error?: string
  /** A soft warning on an otherwise-ready issue (some sources unreachable). */
  warning?: string
  /** The email outcome once delivered: pending | sent | failed | skipped. */
  emailStatus?: Issue['emailStatus']
  emailError?: string
}

export function useGeneration(issueId?: string): GenerationState {
  const q = useQuery<Issue>('issues')
  const rec = issueId ? q.records.find((r) => r.recordId === issueId) : undefined

  return useMemo<GenerationState>(() => {
    if (!issueId) return { phase: 'missing' }
    // No record yet: distinguish "still loading the layer" from "no such issue".
    if (!rec) {
      return { phase: q.status === 'loading' ? 'loading' : 'missing' }
    }
    const issue = rec.data
    if (issue.status === 'failed') {
      return {
        phase: 'failed',
        issue,
        error: issue.runError || 'The run failed before it could be written.',
      }
    }
    if (issue.status === 'ready' || issue.status === 'sent') {
      return {
        phase: 'ready',
        issue,
        storyCount: Array.isArray(issue.sections) ? issue.sections.length : undefined,
        costCents: typeof issue.costEstimate === 'number' ? issue.costEstimate : undefined,
        // On a ready issue, runError is the soft "some sources unreachable" note.
        warning: issue.runError || undefined,
        emailStatus: issue.emailStatus,
        emailError: issue.emailError,
      }
    }
    return { phase: 'running', issue }
  }, [issueId, rec, q.status])
}
