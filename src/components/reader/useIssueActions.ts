/**
 * useIssueActions: the issue verbs (star, archive, feedback, delete), wired
 * through the SDK records layer (useMutations.put / remove). Single-owner app, so
 * the owner holds the admin role and may update/delete their own rows.
 *
 * Each mutation is fire-and-forget against the live records store: the UI re-reads
 * the record from useQuery and re-renders, so we do not keep a local optimistic
 * copy. On failure we surface an honest toast and let the live value stand (the
 * write simply did not land), never a silent swallow.
 *
 * Feedback writes the running tuning note to the OWNING NEWSLETTER's `preferences`
 * (per ARCHITECTURE: no separate feedback collection), and the up/down thumb is
 * recorded as a short prefixed line in that same list so the next compose prompt
 * sees the signal. The thumb is intentionally lightweight; there is no per-issue
 * thumb column in the schema, and one running preferences list is the lean design.
 */

import { useCallback, useRef } from 'react'
import { useMutations } from 'deepspace'
import { useToast } from '../ui'
import type { Issue, Newsletter } from '../../lib/types'

export type Thumb = 'up' | 'down'

export interface IssueActions {
  toggleStar: (issueId: string, current: boolean) => Promise<void>
  toggleArchive: (issueId: string, current: boolean) => Promise<void>
  remove: (issueId: string) => Promise<void>
  /**
   * Append one tuning line to the newsletter's running preferences. The caller
   * passes the CURRENT preferences (from its live useQuery record) so we append
   * rather than overwrite: put() merges field-for-field, so an array field is
   * replaced wholesale, not concatenated.
   */
  sendFeedback: (args: {
    newsletterId: string
    current: string[]
    thumb: Thumb
    note: string
    issueNumber?: number
  }) => Promise<void>
}

/** Build one tuning line from a thumb + optional note, e.g.
 *  "Issue 8: liked it. more on the tooling angle". Kept plain (no em dashes). */
function feedbackLine(thumb: Thumb, note: string, issueNumber?: number): string {
  const label = issueNumber ? `Issue ${issueNumber}: ` : ''
  const verdict = thumb === 'up' ? 'liked it' : 'wanted different'
  const trimmed = note.trim()
  return `${label}${verdict}${trimmed ? `. ${trimmed}` : ''}`
}

export function useIssueActions(): IssueActions {
  const issues = useMutations<Issue>('issues')
  const newsletters = useMutations<Newsletter>('newsletters')
  // The app's ToastProvider (components/ui) wraps the tree in _app.tsx.
  const toast = useToast()
  // Two fast feedback clicks each read-append-write the shared preferences array,
  // so the second clobbers the first (one note lost). Ignore a second feedback
  // write while one is in flight; reset in finally.
  const feedbackInFlight = useRef(false)

  const toggleStar = useCallback(
    async (issueId: string, current: boolean) => {
      try {
        await issues.put(issueId, { starred: !current })
      } catch {
        toast.error('Could not update the star', 'Check your connection and try again.')
      }
    },
    [issues, toast],
  )

  const toggleArchive = useCallback(
    async (issueId: string, current: boolean) => {
      try {
        await issues.put(issueId, { archived: !current })
        toast.success(current ? 'Moved back to your issues' : 'Archived')
      } catch {
        toast.error('Could not archive', 'Check your connection and try again.')
      }
    },
    [issues, toast],
  )

  const remove = useCallback(
    async (issueId: string) => {
      try {
        await issues.remove(issueId)
        toast.success('Issue deleted')
      } catch {
        toast.error('Could not delete the issue', 'Check your connection and try again.')
      }
    },
    [issues, toast],
  )

  const sendFeedback = useCallback<IssueActions['sendFeedback']>(
    async ({ newsletterId, current, thumb, note, issueNumber }) => {
      if (feedbackInFlight.current) return
      feedbackInFlight.current = true
      const line = feedbackLine(thumb, note, issueNumber)
      // Cap the running list so an old preference file never grows unbounded and
      // bloats the compose prompt. Newest last; keep the most recent 20.
      const next = [...current, line].slice(-20)
      try {
        await newsletters.put(newsletterId, { preferences: next })
        toast.success('Got it, I will adjust', 'Your note feeds into the next issue.')
      } catch {
        toast.error('Could not save your note', 'Check your connection and try again.')
      } finally {
        feedbackInFlight.current = false
      }
    },
    [newsletters, toast],
  )

  return { toggleStar, toggleArchive, remove, sendFeedback }
}
