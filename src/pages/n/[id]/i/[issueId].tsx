/**
 * Issue reader + docked Laila companion (route `/n/:id/i/:issueId`).
 * DESIGN_V2.md section 7 (the hard requirement) + shots 07 / 09 / 10 / 24 / 28 / 43.
 *
 * The reader body is a column: a sticky toolbar, then a flex ROW with two
 * children. ReaderColumn (flex:1, overflow-y:auto) holds the dispatch centered at
 * max-width 680. CompanionRail is the structural pane the reading reflows around
 * (flex:0 0 clamp(300px,34%,380px), a left hairline). The rail is ALWAYS rendered
 * beside the reading and the page genuinely reflows to it. It is NEVER an overlay.
 *
 * Below md the rail stops being a side column and becomes a docked bottom sheet
 * that still reflows the reader (it shrinks the reading region, never covers it).
 * The "Wire back" toolbar button focuses the composer (it opens / closes nothing);
 * on mobile it also expands the sheet so the focused field is in view.
 *
 * The chat is wired to the LOCKED /api/companion via useCompanionThread (the
 * request / response shape is unchanged). Threads key on the issue id. Opening a
 * ready issue marks it read (one put). `?demo=1` renders a fixture issue + a
 * Laila-voiced demo thread so the screens populate without live AI or auth; the
 * real replies + memory verify only against the deployed app.
 */

import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutations } from 'deepspace'
import { ChevronLeft, ChevronUp, ChevronDown } from 'lucide-react'
import { ReaderToolbar } from '../../../../components/reader/ReaderToolbar'
import { ReaderColumn } from '../../../../components/reader/ReaderColumn'
import { ReaderTypeControl } from '../../../../components/reader/ReaderTypeControl'
import { useReaderPrefs } from '../../../../components/reader/useReaderPrefs'
import { useRailWidth, clampRailWidth, DEFAULT_RAIL_WIDTH } from '../../../../components/reader/useRailWidth'
import { CompanionRail } from '../../../../components/reader/CompanionRail'
import { useCompanionThread } from '../../../../components/reader/useCompanionThread'
import { useIssueActions } from '../../../../components/reader/useIssueActions'
import { InlineStatus } from '../../../../components/scout/Status'
import { useScoutToast } from '../../../../components/scout/ScoutToast'
import { ScoutMark } from '../../../../components/scout/Logo'
import { EyebrowLabel } from '../../../../components/scout/Eyebrow'
import { DEMO_NEWSLETTERS, DEMO_ISSUES, isDemo } from '../../../../lib/demo'
import type { Issue, IssueSection, Newsletter } from '../../../../lib/types'

export default function IssueReaderPage() {
  const navigate = useNavigate()
  const { id, issueId } = useParams()
  const demo = isDemo()
  const { showToast } = useScoutToast()
  const actions = useIssueActions()

  const issuesQ = useQuery<Issue>('issues')
  const nlQ = useQuery<Newsletter>('newsletters')
  const issues = useMutations<Issue>('issues')
  const newsletters = useMutations<Newsletter>('newsletters')

  const issueRec = demo
    ? DEMO_ISSUES.find((r) => r.recordId === issueId)
    : issuesQ.records.find((r) => r.recordId === issueId)
  const nlRec = demo ? DEMO_NEWSLETTERS.find((r) => r.recordId === id) : nlQ.records.find((r) => r.recordId === id)
  const issue = issueRec?.data
  const newsletter = nlRec?.data

  // Composer state lives at the route so a story's "Ask Laila about this" can seed
  // it and the toolbar's "Wire back" can focus it.
  const [draft, setDraft] = useState('')
  const composerRef = useRef<HTMLTextAreaElement>(null)
  // The docked sheet's expanded state (mobile only; on desktop the rail is the
  // always-open side column and this is ignored).
  const [sheetOpen, setSheetOpen] = useState(false)
  // Track the breakpoint so the rail renders in exactly ONE slot (the side column
  // on desktop, the docked bottom region on mobile). Rendering it twice would
  // duplicate the #scout-composer / #scout-chat-scroll ids that focus + the
  // grounded contract rely on, so we mount one rail, never both.
  const isDesktop = useMediaQuery('(min-width: 768px)')

  // The owner's reading font + text size (persisted in localStorage). Applied as
  // CSS vars on the reader container only, so the rest of the app's type is
  // untouched. The reader body reads --reader-font / --reader-size.
  const readerPrefs = useReaderPrefs()
  // The rail's owner-chosen width (px), persisted. A fixed pixel basis (not a
  // percentage clamp) keeps the rail edge from jumping when a tool note renders.
  const railW = useRailWidth()

  // ?demo=1&chat=empty shows the empty companion opener (for the empty shot).
  const demoEmpty =
    demo && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('chat') === 'empty'
  const thread = useCompanionThread(issueRec?.recordId, { demo, demoThread: demoEmpty ? [] : undefined })

  const back = () => navigate(id ? `/n/${id}` : '/')

  // Mark a ready dispatch read on open (one idempotent put, real mode only). The
  // effect re-keys on the issue id, so switching to another dispatch in place
  // marks that one too; the readAt guard makes a repeat put a no-op.
  useEffect(() => {
    if (demo || !issueRec || !issue) return
    const opened = issue.status === 'sent' || issue.status === 'ready'
    if (opened && !issue.readAt) {
      void issues.put(issueRec.recordId, { readAt: Date.now() }).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueRec?.recordId, issue?.status, issue?.readAt, demo])

  const loading = !demo && (issuesQ.status === 'loading' || nlQ.status === 'loading') && !issueRec
  const errored = !demo && (issuesQ.status === 'error' || nlQ.status === 'error')

  if (loading) return <ReaderSkeleton onBack={back} />

  if (errored) {
    return (
      <Frame onBack={back}>
        <InlineStatus tone="danger">
          Could not load this dispatch. Check your connection and reload. If it persists,
          the records service may be down.
        </InlineStatus>
      </Frame>
    )
  }

  if (!issueRec || !issue) {
    return (
      <Frame onBack={back}>
        <InlineStatus tone="warning">
          That dispatch does not exist, or it was deleted. Head back to the newsletter to
          pick another.
        </InlineStatus>
      </Frame>
    )
  }

  // A draft still being written shows an honest in-progress state, not a blank
  // body. The live record flips to ready underneath and this swaps to the issue.
  if (issue.status === 'draft') {
    return (
      <Frame onBack={back} newsletterTitle={newsletter?.title}>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <ScoutMark size={26} className="animate-pulse" />
          <h2 className="mt-4 font-serif" style={{ fontSize: '22px', fontWeight: 500, color: 'var(--ink)' }}>
            Laila is writing this dispatch
          </h2>
          <p className="mt-2 max-w-sm text-[14px]" style={{ lineHeight: 1.55, color: 'var(--ink2)' }}>
            Finding sources, sifting them, and composing. This page fills in the moment it is
            ready. You can leave and come back.
          </p>
        </div>
      </Frame>
    )
  }

  // A failed run keeps the record but explains what went wrong, never a blank page.
  if (issue.status === 'failed') {
    return (
      <Frame onBack={back} newsletterTitle={newsletter?.title}>
        <InlineStatus tone="danger">
          This dispatch did not finish. {issue.runError || 'The run failed before it could be written.'}{' '}
          Open the newsletter to try again.
        </InlineStatus>
      </Frame>
    )
  }

  /** Focus the composer (shared by the toolbar and a story's seed). On mobile,
   *  open the docked sheet first so the focused field is in view. */
  function focusComposer() {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
      setSheetOpen(true)
    }
    // Defer focus a tick so the field is mounted/visible when we focus it.
    requestAnimationFrame(() => document.getElementById('scout-composer')?.focus())
  }

  /** A story's "Ask Laila about this" seeds a concrete question into the composer. */
  function onAsk(section: IssueSection, index: number) {
    setDraft(`Go deeper on story ${index + 1}: ${section.headline}`)
    focusComposer()
  }

  /** An empty-state suggestion sends a first message straight away. */
  function onSeed(prompt: string) {
    if (demo) return
    thread.send(prompt)
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
      setSheetOpen(true)
    }
  }

  function onSend() {
    const text = draft.trim()
    if (!text) return
    thread.send(text)
    setDraft('')
  }

  /** "More / Less like this": feed the tuning signal to the owning newsletter. */
  async function onShape(direction: 'up' | 'down') {
    if (demo) {
      showToast(direction === 'up' ? 'Noted. More like this.' : 'Noted. Less like this.')
      return
    }
    if (!id) return
    await actions.sendFeedback({
      newsletterId: id,
      current: newsletter?.preferences ?? [],
      thumb: direction,
      note: '',
      issueNumber: issue!.number,
    })
  }

  const rail = (
    <CompanionRail
      messages={thread.messages}
      busy={thread.busy}
      error={thread.error}
      draft={draft}
      onDraftChange={setDraft}
      onSend={onSend}
      onSeed={onSeed}
      onClearError={thread.clearError}
      composerRef={composerRef}
      composerDisabled={demo}
    />
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ReaderToolbar
        newsletterTitle={newsletter?.title}
        starred={!!issue.starred}
        archived={!!issue.archived}
        onBack={back}
        onWireBack={focusComposer}
        onToggleStar={() =>
          demo
            ? showToast(issue.starred ? 'Unstarred.' : 'Starred.')
            : void actions.toggleStar(issueRec.recordId, !!issue.starred)
        }
        onToggleArchive={() =>
          demo
            ? showToast(issue.archived ? 'Moved back.' : 'Archived.')
            : void actions.toggleArchive(issueRec.recordId, !!issue.archived)
        }
        typeControl={<ReaderTypeControl prefs={readerPrefs} />}
      />

      {/* The two-pane row. The reading column always reflows to make room for the
          rail; the rail is structural, never an overlay. The reader's chosen font
          + body size flow in here as CSS vars scoped to this subtree only. */}
      <div
        className="flex min-h-0 flex-1"
        style={
          {
            '--reader-font': readerPrefs.font.stack,
            '--reader-size': readerPrefs.size.rem,
          } as React.CSSProperties
        }
      >
        <div className="min-h-0 flex-1 overflow-y-auto" style={{ minWidth: 0 }}>
          <ReaderColumn issue={issue} newsletter={newsletter} onAsk={onAsk} onShape={onShape} />
        </div>

        {/* Desktop rail: the structural side column the reading reflows around.
            A FIXED pixel basis (owner-resizable, not a percentage clamp) so the
            edge never moves when a tool note renders. */}
        {isDesktop && (
          <aside
            className="relative flex min-h-0 flex-col"
            style={{ flex: `0 0 ${railW.width}px`, minWidth: 0, borderLeft: '1px solid var(--line)' }}
          >
            <RailResizeHandle width={railW.width} onResize={railW.setWidth} />
            {rail}
          </aside>
        )}
      </div>

      {/* Mobile docked sheet: a non-blocking, reflowing bottom region. The reader
          above stays visible (it is not covered); tapping the bar expands the
          sheet to ~62vh, the collapsed bar is always reachable. Never a modal. */}
      {!isDesktop && (
        <div>
          <button
            onClick={() => setSheetOpen((v) => !v)}
            className="flex w-full items-center gap-2 px-4 py-3"
            style={{ background: 'var(--surface)', borderTop: '1px solid var(--line)' }}
            aria-expanded={sheetOpen}
          >
            <EyebrowLabel accent className="inline-flex items-center gap-1.5">
              <span aria-hidden>&bull;</span>
              Wire back to Laila
            </EyebrowLabel>
            {sheetOpen ? (
              <ChevronDown className="ml-auto size-4" style={{ color: 'var(--ink3)' }} />
            ) : (
              <ChevronUp className="ml-auto size-4" style={{ color: 'var(--ink3)' }} />
            )}
          </button>
          {sheetOpen && (
            <div style={{ height: '62vh', borderTop: '1px solid var(--line)' }}>{rail}</div>
          )}
        </div>
      )}
    </div>
  )
}

/** A minimal frame (toolbar + a centered slot) for the non-issue states. */
function Frame({
  children,
  onBack,
  newsletterTitle,
}: {
  children: React.ReactNode
  onBack: () => void
  newsletterTitle?: string
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className="flex shrink-0 items-center px-4 py-3 md:px-6"
        style={{ borderBottom: '1px solid var(--line)' }}
      >
        <button
          onClick={onBack}
          className="sct-btn-ghost inline-flex h-9 items-center gap-1.5 rounded-[9px] px-3 text-[13px] font-medium transition-colors"
          style={{ color: 'var(--ink2)' }}
        >
          <ChevronLeft className="size-4" />
          <span className="truncate">{newsletterTitle || 'The desk'}</span>
        </button>
      </div>
      <div className="mx-auto w-full max-w-[680px] px-6 py-12">{children}</div>
    </div>
  )
}

function ReaderSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex h-full min-h-0 flex-col" aria-busy>
      <div
        className="flex shrink-0 items-center px-4 py-3 md:px-6"
        style={{ borderBottom: '1px solid var(--line)' }}
      >
        <button
          onClick={onBack}
          className="inline-flex h-9 items-center gap-1.5 px-3 text-[13px]"
          style={{ color: 'var(--ink3)' }}
        >
          <ChevronLeft className="size-4" />
          The desk
        </button>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1 overflow-hidden">
          <div className="mx-auto w-full max-w-[680px] px-6 pt-12 md:px-10">
            <div className="mx-auto h-3 w-40 animate-pulse rounded" style={{ background: 'var(--s2)' }} />
            <div className="mx-auto mt-4 h-8 w-2/3 animate-pulse rounded" style={{ background: 'var(--s2)' }} />
            <div className="mt-10 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-4 w-full animate-pulse rounded" style={{ background: 'var(--s2)' }} />
              ))}
            </div>
          </div>
        </div>
        <aside
          className="hidden items-center justify-center md:flex"
          style={{ flex: `0 0 ${DEFAULT_RAIL_WIDTH}px`, borderLeft: '1px solid var(--line)' }}
        >
          <ScoutMark size={24} className="opacity-30" />
        </aside>
      </div>
    </div>
  )
}

/**
 * A subtle hairline grab strip on the rail's LEFT edge for resizing (desktop
 * only). It is absolutely positioned over the border, so it adds no width and
 * cannot shift the layout. Dragging left widens the rail (dx is negative as the
 * pointer moves left, so width = start - dx). Keyboard a11y: a vertical separator
 * with left/right arrow nudges for non-mouse users.
 */
function RailResizeHandle({ width, onResize }: { width: number; onResize: (px: number) => void }) {
  const drag = useRef<{ startX: number; startWidth: number } | null>(null)
  const [active, setActive] = useState(false)

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { startX: e.clientX, startWidth: width }
    setActive(true)
    e.currentTarget.setPointerCapture(e.pointerId)
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return
    const dx = e.clientX - drag.current.startX
    onResize(drag.current.startWidth - dx)
  }
  function endDrag(e: React.PointerEvent) {
    if (!drag.current) return
    drag.current = null
    setActive(false)
    e.currentTarget.releasePointerCapture(e.pointerId)
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  }
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      onResize(clampRailWidth(width + 8))
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      onResize(clampRailWidth(width - 8))
    }
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize the Laila rail"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => !drag.current && setActive(false)}
      className="group absolute inset-y-0 left-0 z-10 w-2 -translate-x-1/2 focus:outline-none"
      style={{ cursor: 'col-resize', touchAction: 'none' }}
    >
      {/* A hairline tint centered on the border; faint until hover / active /
          keyboard focus. No layout shift (it is an overlay strip, adds no width). */}
      <span
        className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 transition-all duration-150 group-focus-visible:opacity-100"
        style={{
          width: active ? 2 : 1,
          background: active ? 'var(--accent)' : 'var(--line)',
          opacity: active ? 1 : 0,
        }}
        aria-hidden
      />
    </div>
  )
}

/** True when the viewport matches `query`. Drives the single-mount rail switch so
 *  the companion renders in exactly one slot (the #scout-composer id stays unique). */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return matches
}
