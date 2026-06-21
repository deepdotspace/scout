/**
 * The Library (route `/issues`) and the Search view folded into it (DESIGN_V2.md
 * section 5, shots 04 / 05 / 05b / 06 / 06b). The sidebar links here with query
 * params: `?filter=starred` / `?filter=archive` pick the tab, `?view=search` (or
 * any `?q=`) opens the search view.
 *
 * One shared list shell, max 840: a back button + mono kicker + serif H1, then
 * the dispatch list. Library tabs are All dispatches / Starred / Archive, each
 * driven by `?filter=`. Search adds an elevated field with a live result count, a
 * teaching empty prompt, and the same row items, client-filtered over title,
 * excerpt, and newsletter name.
 *
 * Rows read straight from the live records layer, so a freshly starred or
 * archived dispatch moves between tabs without a refetch. Star toggles through
 * the existing issue-action path. `?demo=1` drives the populated preview off the
 * fixture with a read-only star (never touches the database).
 */

import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from 'deepspace'
import { ChevronLeft } from 'lucide-react'
import { LibraryRow } from '../components/library/LibraryRow'
import { SearchField } from '../components/library/SearchField'
import { EyebrowLabel } from '../components/scout/Eyebrow'
import { useIssueActions } from '../components/reader/useIssueActions'
import { DEMO_ISSUES, DEMO_NEWSLETTERS, isDemo } from '../lib/demo'
import type { Issue, Newsletter } from '../lib/types'

type Tab = 'all' | 'starred' | 'archive'

const TAB_TITLE: Record<Tab, string> = {
  all: 'All dispatches',
  starred: 'Starred',
  archive: 'Archive',
}

const TAB_EMPTY: Record<Tab, string> = {
  all: 'No dispatches yet. Your first issue lands here once a beat files.',
  starred: 'Nothing starred yet.',
  archive: 'Your archive is empty.',
}

export default function LibraryPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { toggleStar } = useIssueActions()
  const demo = isDemo()

  const liveIssues = useQuery<Issue>('issues', { orderBy: 'generatedAt', orderDir: 'desc' })
  const liveNl = useQuery<Newsletter>('newsletters')
  const issues = demo ? DEMO_ISSUES : liveIssues.records
  const newsletters = demo ? DEMO_NEWSLETTERS : liveNl.records

  const isSearch = params.get('view') === 'search' || params.has('q')
  const filterParam = params.get('filter')
  const tab: Tab = filterParam === 'starred' ? 'starred' : filterParam === 'archive' ? 'archive' : 'all'

  const [search, setSearch] = useState(params.get('q') ?? '')

  const titles = useMemo(
    () => Object.fromEntries(newsletters.map((r) => [r.recordId, r.data.title])),
    [newsletters],
  )

  // Search runs across every non-archived dispatch (title + excerpt + beat name).
  // Library tabs partition by state: All hides archived (archive is "set aside"),
  // Starred is starred and not archived, Archive is the archived set.
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return issues
      .filter((r) => {
        const d = r.data
        if (isSearch) {
          if (d.archived) return false
          if (!q) return false
          const name = titles[d.newsletterId] ?? ''
          return (
            d.title?.toLowerCase().includes(q) ||
            d.lead?.toLowerCase().includes(q) ||
            name.toLowerCase().includes(q)
          )
        }
        if (tab === 'starred') return d.starred && !d.archived
        if (tab === 'archive') return d.archived
        return !d.archived
      })
      .sort((a, b) => (b.data.generatedAt ?? 0) - (a.data.generatedAt ?? 0))
  }, [issues, isSearch, tab, search, titles])

  const openReader = (newsletterId: string, issueId: string) => navigate(`/n/${newsletterId}/i/${issueId}`)
  // Demo's fixture is read-only, like the desk: the star is a no-op there.
  const onToggleStar = demo ? () => {} : toggleStar

  const kicker = isSearch ? 'Search' : 'Library'
  const title = isSearch ? 'Search' : TAB_TITLE[tab]

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[840px] px-6 pb-24 pt-14 md:px-12">
        {/* Back + kicker */}
        <div className="mb-1 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="Back to the desk"
            className="sct-icon-btn grid size-[34px] place-items-center rounded-[9px]"
            style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink2)' }}
          >
            <ChevronLeft className="size-4" />
          </button>
          <EyebrowLabel>{kicker}</EyebrowLabel>
        </div>

        {/* Title */}
        <h1
          className="mb-2 font-serif"
          style={{ fontSize: '36px', fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--ink)' }}
        >
          {title}
        </h1>

        {/* Search field (search view only) */}
        {isSearch && (
          <div className="mb-[30px] mt-[18px]">
            <SearchField
              value={search}
              onChange={setSearch}
              count={search.trim() ? `${rows.length} ${rows.length === 1 ? 'result' : 'results'}` : undefined}
            />
          </div>
        )}

        {/* The list (or the right empty state) */}
        <div className="mt-[18px]">
          {isSearch && !search.trim() ? (
            <EmptyLine>Search across every issue Scout has ever filed.</EmptyLine>
          ) : rows.length === 0 ? (
            <EmptyLine>{isSearch ? 'Nothing matches that yet.' : TAB_EMPTY[tab]}</EmptyLine>
          ) : (
            rows.map((r) => (
              <LibraryRow
                key={r.recordId}
                issueId={r.recordId}
                newsletterId={r.data.newsletterId}
                data={r.data}
                newsletterName={titles[r.data.newsletterId] ?? 'Dispatch'}
                onOpen={openReader}
                onToggleStar={onToggleStar}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

/** A serif-italic teaching line, centered, for every empty state in the library. */
function EmptyLine({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="px-5 py-[70px] text-center font-serif italic"
      style={{ fontSize: '20px', color: 'var(--ink3)' }}
    >
      {children}
    </div>
  )
}
