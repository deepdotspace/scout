/**
 * BackIssues: the issue list on a newsletter detail (DESIGN_V2.md section 5,
 * shots 02-newsletter-detail / 25-newsletter-accent-moss). Each row carries the
 * date in mono, an unread dot, the serif title and a serif excerpt, and a star
 * toggle on the right. A row opens the reader. Hierarchy comes from spacing and a
 * single hairline between rows, never boxes.
 *
 * A still-generating draft and a failed run are shown honestly so a delivery or
 * run problem is never hidden. The star is reversible, so it acts immediately via
 * the records layer (onToggleStar) and the live re-read flips the icon.
 */

import { useNavigate } from 'react-router-dom'
import { Star, Loader2, AlertTriangle } from 'lucide-react'
import type { Issue } from '../../lib/types'

/** "Tue, Jun 17" from an epoch (the issue dateline). */
function dateline(ts?: number): string {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export function BackIssues({
  newsletterId,
  issues,
  onToggleStar,
}: {
  newsletterId: string
  issues: { recordId: string; data: Issue }[]
  onToggleStar: (issueId: string, current: boolean) => void
}) {
  return (
    <ul className="flex flex-col">
      {issues.map(({ recordId, data }, i) => (
        <IssueRow
          key={recordId}
          newsletterId={newsletterId}
          issueId={recordId}
          issue={data}
          first={i === 0}
          onToggleStar={onToggleStar}
        />
      ))}
    </ul>
  )
}

function IssueRow({
  newsletterId,
  issueId,
  issue,
  first,
  onToggleStar,
}: {
  newsletterId: string
  issueId: string
  issue: Issue
  first: boolean
  onToggleStar: (issueId: string, current: boolean) => void
}) {
  const navigate = useNavigate()
  const open = () => navigate(`/n/${newsletterId}/i/${issueId}`)

  const isDraft = issue.status === 'draft'
  const isFailed = issue.status === 'failed'
  // Unread = a filed dispatch the owner has not opened. The reader stamps readAt
  // on open, so !readAt is the real signal (same as the library and the desk).
  const unread = !isDraft && !isFailed && !issue.readAt

  return (
    <li
      className="grid grid-cols-[88px_1fr_auto] items-start gap-x-5 py-6"
      style={first ? undefined : { borderTop: '1px solid var(--line)' }}
    >
      {/* Date in mono, top-aligned with the title baseline. */}
      <span className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.08em]" style={{ color: 'var(--ink3)' }}>
        {dateline(issue.generatedAt)}
      </span>

      {/* Unread dot + serif title + serif excerpt; the whole block opens the reader. */}
      <button
        onClick={open}
        className="group min-w-0 text-left focus-visible:outline-none"
      >
        <div className="flex items-baseline gap-2.5">
          <span className="mt-2 inline-flex size-[7px] shrink-0 rounded-full" aria-hidden>
            {unread && <span className="size-full rounded-full" style={{ background: 'var(--accent)' }} />}
          </span>
          <h3
            className="font-serif transition-colors"
            style={{ fontSize: '20px', fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 1.3, color: 'var(--ink)' }}
          >
            {isDraft ? 'Laila is filing this issue' : issue.title || 'Untitled issue'}
          </h3>
        </div>

        {isDraft ? (
          <p className="mt-2 inline-flex items-center gap-1.5 pl-[17px] font-mono text-[11px]" style={{ color: 'var(--ink3)' }}>
            <Loader2 className="size-3.5 animate-spin" />
            Filing
          </p>
        ) : isFailed ? (
          <p className="mt-2 inline-flex items-center gap-1.5 pl-[17px] font-mono text-[11px]" style={{ color: 'var(--color-danger)' }}>
            <AlertTriangle className="size-3.5" />
            Did not finish
          </p>
        ) : (
          issue.lead && (
            <p className="mt-1.5 max-w-[64ch] pl-[17px] font-serif" style={{ fontSize: '15.5px', fontWeight: 300, lineHeight: 1.5, color: 'var(--ink2)' }}>
              {issue.lead}
            </p>
          )
        )}
      </button>

      {/* Star toggle. */}
      <button
        type="button"
        onClick={() => onToggleStar(issueId, !!issue.starred)}
        aria-label={issue.starred ? 'Remove star' : 'Star this issue'}
        title={issue.starred ? 'Starred' : 'Star'}
        className="mt-1 grid size-8 place-items-center rounded-[9px] transition-colors focus-visible:outline-none focus-visible:ring-2"
        style={{
          color: issue.starred ? 'var(--accent)' : 'var(--ink3)',
          ['--tw-ring-color' as string]: 'var(--accent-soft)',
        }}
      >
        <Star className="size-[17px]" style={issue.starred ? { fill: 'var(--accent)' } : undefined} />
      </button>
    </li>
  )
}
