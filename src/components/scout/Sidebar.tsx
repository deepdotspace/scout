/**
 * The studio Sidebar (persistent, every route). DESIGN_V2.md section 5 + the home
 * screenshots (01-home, 27-home-night, 23-home-accent-iris).
 *
 * Top to bottom:
 *  - Brand: the compass-star glyph in the accent, "Scout" serif 22/600, and a
 *    "FILING FOR ONE" mono eyebrow.
 *  - The full-width accent "New newsletter" CTA (links to /new).
 *  - YOUR BEATS: each active newsletter as a row (live/paused status dot, name,
 *    a mono next-run time); the active route gets the soft accent wash.
 *  - LIBRARY: All dispatches / Starred / Archive with counts, plus Search.
 *  - Footer: the four accent swatch buttons, a Day/Night pill toggle, Settings.
 *
 * Reads the real newsletters + issues via useQuery (the demo fixture drives it
 * under ?demo=1 so the populated preview is coherent). Width is owned by the
 * shell (the --sbw var on the wrapper) so the resize handle lives there.
 */

import { useMemo } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from 'deepspace'
import { Plus, Layers, Star, Archive, Search, Settings, Sun, Moon } from 'lucide-react'
import { ScoutMark } from './Logo'
import { EyebrowLabel } from './Eyebrow'
import { StatusDot } from './StatusDot'
import { useAccentMode, ACCENTS } from '../../theme/accent'
import type { Newsletter, Issue } from '../../lib/types'
import { DEMO_NEWSLETTERS, DEMO_ISSUES, isDemo } from '../../lib/demo'
import { cn } from '../ui/utils'

/** A compact mono next-run stamp: "Tue 7:00" / "Mon 8:00" / a date for far out. */
function nextRunStamp(n: Newsletter): string {
  if (n.status === 'paused') return 'Paused'
  if (!n.nextSendAt) return n.time || '--'
  const d = new Date(n.nextSendAt)
  const day = d.toLocaleDateString(undefined, { weekday: 'short' })
  const time = (n.time || '').trim()
  return time ? `${day} ${time}` : day
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const { accent, mode, setAccent, toggleMode } = useAccentMode()

  // The Library rows live on one route (/issues) and differ only by the query
  // string, which a plain NavLink ignores, so all three would light up at once.
  // Derive the active row from the parsed query: All when no filter, Starred /
  // Archive on theirs, Search when ?view=search (a separate axis).
  const params = new URLSearchParams(search)
  const onIssues = pathname === '/issues'
  const filter = params.get('filter')
  const isSearch = onIssues && (params.get('view') === 'search' || params.has('q'))
  const lib = {
    all: onIssues && !isSearch && !filter,
    starred: onIssues && !isSearch && filter === 'starred',
    archive: onIssues && !isSearch && filter === 'archive',
    search: isSearch,
  }

  const { records: liveNl } = useQuery<Newsletter>('newsletters', { orderBy: 'createdAt', orderDir: 'desc' })
  const { records: liveIss } = useQuery<Issue>('issues', { orderBy: 'generatedAt', orderDir: 'desc' })
  const demo = isDemo()
  const newsletters = demo ? DEMO_NEWSLETTERS : liveNl
  const issues = demo ? DEMO_ISSUES : liveIss

  const counts = useMemo(() => {
    const all = issues.filter((i) => !i.data.archived).length
    const starred = issues.filter((i) => i.data.starred && !i.data.archived).length
    const archive = issues.filter((i) => i.data.archived).length
    return { all, starred, archive }
  }, [issues])

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--s2)' }}>
      {/* Brand: the wordmark + glyph open the press-wire landing page (the
          masthead). The "Open the studio" CTAs there return to the desk, and the
          beats / Library rows below keep the desk one click away, so this is not a
          dead end. */}
      <div className="px-5 pt-5 pb-4">
        <button
          onClick={() => {
            navigate('/welcome')
            onNavigate?.()
          }}
          className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
          aria-label="Scout landing page"
        >
          <ScoutMark size={24} />
          <span className="flex flex-col items-start leading-none">
            <span className="font-serif font-semibold" style={{ fontSize: '22px', color: 'var(--ink)' }}>
              Scout
            </span>
            <span className="mt-1">
              <EyebrowLabel>Filing for one</EyebrowLabel>
            </span>
          </span>
        </button>
      </div>

      {/* New newsletter CTA */}
      <div className="px-4 pb-4">
        <button
          onClick={() => {
            navigate('/new')
            onNavigate?.()
          }}
          className="sct-btn-primary flex h-11 w-full items-center justify-center gap-2 rounded-[11px] text-sm font-semibold"
          style={{ boxShadow: '0 2px 8px var(--accent-sh), 0 1px 0 rgba(255,255,255,.18) inset' }}
        >
          <Plus className="size-[18px]" />
          New newsletter
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
        {/* YOUR BEATS */}
        <SectionHeader>Your beats</SectionHeader>
        <nav className="mt-2 flex flex-col gap-0.5">
          {newsletters.length === 0 ? (
            <p className="px-3 py-2 text-xs leading-relaxed" style={{ color: 'var(--ink3)' }}>
              None yet. Your first beat shows up here.
            </p>
          ) : (
            newsletters.map((n) => {
              const active = pathname.startsWith(`/n/${n.recordId}`)
              const paused = n.data.status === 'paused'
              return (
                <button
                  key={n.recordId}
                  onClick={() => {
                    navigate(`/n/${n.recordId}`)
                    onNavigate?.()
                  }}
                  className={cn('sct-beat group flex min-h-[36px] w-full items-center gap-2.5 rounded-[9px] px-3 text-left transition-colors')}
                  style={active ? { background: 'var(--accent-soft)' } : undefined}
                  data-active={active || undefined}
                >
                  <StatusDot state={paused ? 'paused' : 'live'} ping={!paused} size={7} />
                  <span
                    className="min-w-0 flex-1 truncate text-[13.5px] font-medium"
                    style={{ color: active ? 'var(--accent)' : 'var(--ink)' }}
                  >
                    {n.data.title || 'Untitled beat'}
                  </span>
                  <span className="tnum font-mono shrink-0 text-[10.5px]" style={{ color: paused ? 'var(--ink3)' : 'var(--ink2)' }}>
                    {nextRunStamp(n.data)}
                  </span>
                </button>
              )
            })
          )}
        </nav>

        {/* LIBRARY */}
        <SectionHeader className="mt-6">Library</SectionHeader>
        <nav className="mt-2 flex flex-col gap-0.5">
          <LibraryRow to="/issues" active={lib.all} icon={<Layers />} label="All dispatches" count={counts.all} onNavigate={onNavigate} />
          <LibraryRow to="/issues?filter=starred" active={lib.starred} icon={<Star />} label="Starred" count={counts.starred} onNavigate={onNavigate} />
          <LibraryRow to="/issues?filter=archive" active={lib.archive} icon={<Archive />} label="Archive" count={counts.archive} onNavigate={onNavigate} />
          <LibraryRow to="/issues?view=search" active={lib.search} icon={<Search />} label="Search" onNavigate={onNavigate} />
        </nav>
      </div>

      {/* Footer: accent swatches, Day/Night pill, Settings */}
      <div className="px-4 pb-4 pt-3" style={{ borderTop: '1px solid var(--line)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {ACCENTS.map((a) => {
              const selected = a.key === accent
              return (
                <button
                  key={a.key}
                  onClick={() => setAccent(a.key)}
                  aria-label={`${a.label} accent`}
                  aria-pressed={selected}
                  className="size-[18px] rounded-full transition-transform hover:scale-110"
                  style={{
                    background: mode === 'night' ? a.night : a.day,
                    boxShadow: selected
                      ? `0 0 0 2px var(--s2), 0 0 0 4px ${mode === 'night' ? a.night : a.day}`
                      : 'none',
                  }}
                />
              )
            })}
          </div>
          <button
            onClick={toggleMode}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-colors"
            style={{ border: '1px solid var(--line)', color: 'var(--ink2)' }}
            aria-label={mode === 'day' ? 'Switch to night desk' : 'Switch to daylight'}
          >
            {mode === 'day' ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
            {mode === 'day' ? 'Night' : 'Day'}
          </button>
        </div>

        <button
          onClick={() => {
            navigate('/settings')
            onNavigate?.()
          }}
          className="sct-rail mt-3 flex min-h-[36px] w-full items-center gap-3 rounded-[9px] px-3 text-sm font-medium"
          data-active={pathname === '/settings' || undefined}
          style={pathname === '/settings' ? { background: 'var(--accent-soft)', color: 'var(--accent)' } : undefined}
        >
          <Settings className="size-[18px]" />
          <span>Settings</span>
        </button>
      </div>
    </div>
  )
}

function SectionHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('px-3', className)}>
      <EyebrowLabel>{children}</EyebrowLabel>
    </div>
  )
}

function LibraryRow({
  to,
  active,
  icon,
  label,
  count,
  onNavigate,
}: {
  to: string
  /** Computed by the parent from the parsed ?filter / ?view, since these rows
   *  differ only by query string (a NavLink would light all of them at once). */
  active: boolean
  icon: React.ReactNode
  label: string
  count?: number
  onNavigate?: () => void
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'sct-rail group flex min-h-[36px] items-center gap-3 rounded-[9px] px-3 text-[13.5px] font-medium transition-colors',
        '[&_svg]:size-[17px] [&_svg]:shrink-0',
        active && 'sct-rail-active',
      )}
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && (
        <span className="tnum font-mono text-[10.5px]" style={{ color: 'var(--ink3)' }}>
          {count}
        </span>
      )}
    </Link>
  )
}
