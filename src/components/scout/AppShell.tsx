/**
 * AppShell: Scout's studio chrome. The persistent layout every route renders
 * inside (DESIGN_V2.md section 5). A fixed left Sidebar over --s2 + a main content
 * area on --bg. The Sidebar is resizable via a drag handle on its right edge
 * (248-440px, default 304, persisted), and Escape returns to home from any
 * sub-route.
 *
 * Main is full-bleed: no max-w, no mx-auto here. Pages own their content max-width
 * (the editorial 660 / 680 / 880) and their own padding.
 *
 * Mobile navigation (below md) is one coherent pattern on every route: a top bar
 * with a menu button + the brand, a persistent bottom tab bar (Home / Library /
 * New / Settings), and a slide-in drawer that holds the full Sidebar (Your beats,
 * the accent swatches, Day/Night, Settings) so nothing in the chrome is a dead
 * end. The reader route reuses this exact bottom bar; it adds its own docked
 * companion sheet above it, it does not introduce a second nav.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Home, Layers, Menu, Plus, Settings } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { TabItem } from './RailItem'
import { ScoutMark } from './Logo'

const SBW_KEY = 'scout.sbw'
const SBW_MIN = 248
const SBW_MAX = 440
const SBW_DEFAULT = 304

function readWidth(): number {
  if (typeof window === 'undefined') return SBW_DEFAULT
  const v = Number(window.localStorage.getItem(SBW_KEY))
  if (!v || Number.isNaN(v)) return SBW_DEFAULT
  return Math.min(SBW_MAX, Math.max(SBW_MIN, v))
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [width, setWidth] = useState(readWidth)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const dragging = useRef(false)

  // Close the mobile drawer whenever the route changes (a beat tap, a Library
  // link, the New CTA), so it never lingers over the page it just navigated to.
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  // Escape returns to home from any sub-route (not the home route itself, so a
  // dialog's own Escape still wins there). The mobile drawer's own Escape wins
  // first when it is open.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (e.defaultPrevented) return
      if (drawerOpen) {
        setDrawerOpen(false)
        return
      }
      // Never hijack Escape while typing or on the home route itself.
      if (pathname === '/') return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      navigate('/')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pathname, navigate, drawerOpen])

  // Lock background scroll while the drawer is open.
  useEffect(() => {
    if (!drawerOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [drawerOpen])

  // Drag-to-resize the sidebar.
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return
    const next = Math.min(SBW_MAX, Math.max(SBW_MIN, e.clientX))
    setWidth(next)
  }, [])

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return
      dragging.current = false
      e.currentTarget.releasePointerCapture(e.pointerId)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      window.localStorage.setItem(SBW_KEY, String(width))
    },
    [width],
  )

  return (
    <div data-testid="app-shell" className="flex h-full" style={{ background: 'var(--bg)' }}>
      {/* Desktop sidebar + resize handle */}
      <aside
        className="relative hidden shrink-0 md:block"
        style={{ width, borderRight: '1px solid var(--line)' }}
      >
        <Sidebar />
        {/* Drag handle on the right edge. */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="absolute inset-y-0 right-0 z-10 w-1.5 translate-x-1/2 cursor-col-resize"
        >
          <span className="sct-handle absolute inset-y-0 left-1/2 w-px -translate-x-1/2" />
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar: a menu button (opens the drawer) + the brand. */}
        <header
          className="flex h-14 items-center gap-1 px-3 md:hidden"
          style={{ borderBottom: '1px solid var(--line)' }}
        >
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            className="grid size-10 shrink-0 place-items-center rounded-[9px] transition-colors"
            style={{ color: 'var(--ink2)' }}
          >
            <Menu className="size-[22px]" />
          </button>
          <button onClick={() => navigate('/')} aria-label="Scout home" className="flex items-center gap-2">
            <ScoutMark size={22} />
            <span className="font-serif font-semibold" style={{ fontSize: '19px', color: 'var(--ink)' }}>
              Scout
            </span>
          </button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto pb-[68px] md:pb-0">{children}</main>

        {/* Mobile bottom tab bar */}
        <nav
          className="fixed inset-x-0 bottom-0 z-40 flex items-stretch md:hidden"
          style={{ background: 'var(--bg-trans)', borderTop: '1px solid var(--line)', backdropFilter: 'blur(10px)' }}
        >
          <TabItem to="/" end icon={<Home />} label="Home" />
          <TabItem to="/issues" icon={<Layers />} label="Library" />
          <button
            onClick={() => navigate('/new')}
            aria-label="New newsletter"
            className="flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium"
            style={{ color: 'var(--ink3)' }}
          >
            <span
              className="grid size-9 place-items-center rounded-full"
              style={{ background: 'var(--accent)', color: 'var(--aink)' }}
            >
              <Plus className="size-5" />
            </span>
            New
          </button>
          <TabItem to="/settings" icon={<Settings />} label="Settings" />
        </nav>
      </div>

      {/* Mobile drawer: the full Sidebar slides in from the left (Your beats, the
          accent swatches, Day/Night, Settings). Tap the scrim or Escape to close;
          it closes itself on any navigation. Desktop never renders it. */}
      <div className="md:hidden" aria-hidden={!drawerOpen}>
        <div
          onClick={() => setDrawerOpen(false)}
          className={`fixed inset-0 z-50 transition-opacity duration-200 ${
            drawerOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
          style={{ background: 'rgba(20,12,2,.38)' }}
        />
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-[min(86vw,320px)] transition-transform duration-200 ease-out ${
            drawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          style={{ borderRight: '1px solid var(--line)', boxShadow: '0 18px 50px -16px rgba(20,12,2,.45)' }}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <Sidebar onNavigate={() => setDrawerOpen(false)} />
        </aside>
      </div>
    </div>
  )
}

/** Re-export the mark for pages that want the brand glyph inline. */
export { ScoutMark }
