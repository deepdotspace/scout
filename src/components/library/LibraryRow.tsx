/**
 * LibraryRow: one dispatch in the library / search list (DESIGN_V2.md section 5,
 * shots 04 / 05 / 06b). A hairline-separated row, no box: a left column with the
 * newsletter name in accent mono + a date in mono, the middle with an unread dot
 * + serif title + serif excerpt, and a star toggle on the right.
 *
 * Clicking the body opens the reader. The star is a real toggle wired through the
 * existing issue-action path (the parent passes the handler); in demo mode the
 * parent passes a no-op so the fixture stays read-only.
 */

import { Star } from 'lucide-react'
import type { Issue } from '../../lib/types'

/** "Tue, Jun 17" from an epoch, matching the desk + featured dateline. */
function dateline(ts?: number): string {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export function LibraryRow({
  issueId,
  newsletterId,
  data,
  newsletterName,
  onOpen,
  onToggleStar,
}: {
  issueId: string
  newsletterId: string
  data: Issue
  newsletterName: string
  onOpen: (newsletterId: string, issueId: string) => void
  onToggleStar: (issueId: string, current: boolean) => void
}) {
  const unread = !data.readAt
  const starred = !!data.starred

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(newsletterId, issueId)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(newsletterId, issueId)
        }
      }}
      className="sct-lib-row flex cursor-pointer items-start gap-[22px] rounded-[8px] px-1.5 py-[22px] transition-colors focus-visible:outline-none focus-visible:ring-2"
      style={{ borderBottom: '1px solid var(--line)', ['--tw-ring-color' as string]: 'var(--accent-soft)' }}
    >
      {/* Left: newsletter name (accent mono) + date (mono). */}
      <div className="w-24 shrink-0 pt-1">
        <div
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.04em]"
          style={{ color: 'var(--accent)' }}
        >
          {newsletterName}
        </div>
        <div className="mt-1.5 font-mono text-[10.5px]" style={{ color: 'var(--ink3)' }}>
          {dateline(data.generatedAt)}
        </div>
      </div>

      {/* Middle: unread dot + serif title + serif excerpt. */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2.5">
          {unread && (
            <span
              className="mt-2.5 inline-flex size-1.5 shrink-0 rounded-full"
              style={{ background: 'var(--accent)' }}
              aria-label="Unread"
            />
          )}
          <h3
            className="font-serif"
            style={{
              fontSize: '20px',
              fontWeight: 500,
              lineHeight: 1.25,
              letterSpacing: '-0.01em',
              color: 'var(--ink)',
              textWrap: 'pretty',
            }}
          >
            {data.title || 'Untitled dispatch'}
          </h3>
        </div>
        {data.lead && (
          <p
            className="mt-1.5 line-clamp-2 font-serif"
            style={{ fontSize: '16px', fontWeight: 300, lineHeight: 1.5, color: 'var(--ink2)', textWrap: 'pretty' }}
          >
            {data.lead}
          </p>
        )}
      </div>

      {/* Right: the star toggle. */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onToggleStar(issueId, starred)
        }}
        aria-label={starred ? 'Unstar this dispatch' : 'Star this dispatch'}
        aria-pressed={starred}
        className="sct-icon-btn -m-1 grid shrink-0 place-items-center rounded-[8px] p-1"
      >
        <Star
          className="size-4 transition-colors"
          style={
            starred
              ? { fill: 'var(--accent)', color: 'var(--accent)' }
              : { fill: 'none', color: 'var(--ink3)' }
          }
          strokeWidth={1.5}
        />
      </button>
    </article>
  )
}
