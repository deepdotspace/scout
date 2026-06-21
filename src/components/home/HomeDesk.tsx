/**
 * HomeDesk: the editor's desk, the signature screen (DESIGN_V2.md section 5,
 * shots 01-home / 27-home-night). Max-width ~880 in the main content area (the
 * shell owns the sidebar). Hierarchy comes from type, space, and one timeline
 * hairline, never boxed grids.
 *
 * Top: a time-aware serif greeting + today's date in mono, then an italic serif
 * subtitle counting unread dispatches + live newsletters. Then "OVER THE WIRE"
 * and the featured dispatch (the only elevation). Then "YOUR DESK" with a count
 * line and the timeline-spine desk list.
 */

import { EyebrowLabel } from '../scout/Eyebrow'
import { FeaturedDispatch } from './FeaturedDispatch'
import { DeskList } from './DeskList'
import { greeting, today } from './dateline'
import type { Issue, Newsletter } from '../../lib/types'

/** "1 fresh dispatch" / "3 fresh dispatches". */
function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

type Row = { recordId: string; data: Newsletter; latestIssue?: { recordId: string; data: Issue } }

export function HomeDesk({
  newsletters,
  issues,
}: {
  newsletters: { recordId: string; data: Newsletter }[]
  issues: { recordId: string; data: Issue }[]
}) {
  // The latest non-archived issue per newsletter, and the single newest overall
  // (the featured dispatch). Newest wins by generatedAt.
  const latestByNl = new Map<string, { recordId: string; data: Issue }>()
  let featured: { recordId: string; data: Issue } | undefined
  for (const i of issues) {
    if (i.data.archived || i.data.status === 'draft') continue
    const cur = latestByNl.get(i.data.newsletterId)
    if (!cur || (i.data.generatedAt ?? 0) > (cur.data.generatedAt ?? 0)) latestByNl.set(i.data.newsletterId, i)
    if (!featured || (i.data.generatedAt ?? 0) > (featured.data.generatedAt ?? 0)) featured = i
  }
  const featuredNl = featured ? newsletters.find((n) => n.recordId === featured!.data.newsletterId) : undefined

  const liveCount = newsletters.filter((n) => n.data.status === 'active').length
  // "Fresh" = a filed dispatch the owner has not opened yet. The reader stamps
  // readAt on open, so !readAt is the real unread signal (same flag the library
  // and the reader use). Drafts and failed runs are not dispatches, so they do
  // not count as fresh.
  const freshCount = issues.filter(
    (i) => !i.data.archived && !i.data.readAt && i.data.status !== 'draft' && i.data.status !== 'failed',
  ).length

  const rows: Row[] = newsletters.map((n) => ({
    recordId: n.recordId,
    data: n.data,
    latestIssue: latestByNl.get(n.recordId),
  }))

  return (
    <div className="mx-auto w-full max-w-[880px] px-6 py-10 md:px-10 md:py-14">
      {/* Greeting + date */}
      <header className="flex items-start justify-between gap-6">
        <h1 className="font-serif" style={{ fontSize: '40px', fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
          {greeting()}
        </h1>
        <span className="mt-2 shrink-0 font-mono text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--ink3)' }}>
          {today()}
        </span>
      </header>
      <p className="mt-2 max-w-[60ch] font-serif italic" style={{ fontSize: '19px', fontWeight: 300, lineHeight: 1.5, color: 'var(--ink2)' }}>
        {freshCount > 0
          ? `You have ${plural(freshCount, 'fresh dispatch', 'fresh dispatches')} waiting, and ${plural(liveCount, 'newsletter', 'newsletters')} out in the field.`
          : `Nothing fresh just yet. You have ${plural(liveCount, 'newsletter', 'newsletters')} out in the field.`}
      </p>

      {/* OVER THE WIRE: the featured dispatch */}
      {featured && featuredNl && (
        <section className="mt-12">
          <EyebrowLabel>Over the wire</EyebrowLabel>
          <div className="mt-4">
            <FeaturedDispatch
              newsletterId={featuredNl.recordId}
              newsletter={featuredNl.data}
              issueId={featured.recordId}
              issue={featured.data}
            />
          </div>
        </section>
      )}

      {/* YOUR DESK: the timeline-spine list */}
      <section className="mt-14">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <EyebrowLabel>Your desk</EyebrowLabel>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.14em]" style={{ color: 'var(--ink3)' }}>
            {plural(newsletters.length, 'newsletter', 'newsletters')} &middot; {liveCount} live
          </span>
        </div>
        <DeskList rows={rows} />
      </section>
    </div>
  )
}
