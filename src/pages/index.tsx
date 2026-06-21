/**
 * Home: the editor's desk (route `/`). DESIGN_V2.md section 5, shots 01-home /
 * 27-home-night / 22-home-toast.
 *
 * Reads the real newsletters + issues from the records layer. No newsletters yet
 * -> the warm first-run state (FirstRun). Populated -> the desk: a time-aware
 * greeting, the featured "over the wire" dispatch (the only elevation), and the
 * timeline-spine desk list. A loading skeleton and an honest error state cover
 * the in-between.
 *
 * `?demo=1` swaps in the visual fixture for screenshotting the populated layout.
 * It is never written to the database and never shown without the flag.
 */

import { useQuery } from 'deepspace'
import { FirstRun } from '../components/home/FirstRun'
import { HomeDesk } from '../components/home/HomeDesk'
import { InlineStatus } from '../components/scout'
import { ScoutMark } from '../components/scout/Logo'
import type { Issue, Newsletter } from '../lib/types'
import { DEMO_NEWSLETTERS, DEMO_ISSUES, isDemo } from '../lib/demo'

export default function HomePage() {
  const demo = isDemo()

  const nlQuery = useQuery<Newsletter>('newsletters', { orderBy: 'createdAt', orderDir: 'desc' })
  const issueQuery = useQuery<Issue>('issues', { orderBy: 'generatedAt', orderDir: 'desc' })

  const newsletters = demo ? DEMO_NEWSLETTERS : nlQuery.records
  const issues = demo ? DEMO_ISSUES : issueQuery.records

  const loading = !demo && (nlQuery.status === 'loading' || issueQuery.status === 'loading')
  const errored = !demo && (nlQuery.status === 'error' || issueQuery.status === 'error')

  if (loading) return <HomeSkeleton />

  if (errored) {
    return (
      <div className="mx-auto w-full max-w-[880px] px-6 py-14 md:px-10">
        <InlineStatus tone="danger">
          Could not load your desk. Check your connection and reload. If it persists,
          the records service may be down.
        </InlineStatus>
      </div>
    )
  }

  if (newsletters.length === 0) return <FirstRun />

  return <HomeDesk newsletters={newsletters} issues={issues} />
}

function HomeSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[880px] px-6 py-10 md:px-10 md:py-14" aria-busy>
      <div className="h-10 w-64 animate-pulse rounded-md" style={{ background: 'var(--s2)' }} />
      <div className="mt-3 h-5 w-96 max-w-full animate-pulse rounded-md" style={{ background: 'var(--s2)' }} />
      <div className="mt-12 h-52 animate-pulse rounded-[18px]" style={{ background: 'var(--s2)' }} />
      <div className="mt-14 flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-[11px]" style={{ background: 'var(--s2)' }} />
        ))}
      </div>
      <div className="mt-10 flex justify-center">
        <ScoutMark size={22} className="opacity-30" />
      </div>
    </div>
  )
}
