/**
 * Accent + mode state for the press-wire world.
 *
 * Holds the current accent (ember / iris / moss / ink) and mode (day / night),
 * persists both to localStorage (single-owner app), and applies them by setting
 * data attributes on <html>. The CSS in src/styles.css derives every accent
 * surface from the active --accent via color-mix in oklab, so a switch is instant
 * and global. Default = ember + night (dark desk on first load).
 *
 * A screen consumes this two ways:
 *   1. Read tokens directly in CSS: `style={{ background: 'var(--accent-soft)' }}`
 *      or any `var(--ink)` / `var(--surface)` / `var(--accent)` etc. No hook needed.
 *   2. Read/set the choices in React: `const { accent, mode, setAccent, toggleMode } = useAccentMode()`.
 *
 * Default = ember + night. Night is the default mode on first load (a visitor with
 * no saved choice opens the dark night desk); a user who picks day keeps day. The
 * index.html root is data-mode="night" to match, so there is no first-paint flash.
 */

import { createContext, useCallback, useContext, useLayoutEffect, useState, type ReactNode } from 'react'

export type Accent = 'ember' | 'iris' | 'moss' | 'ink'
export type Mode = 'day' | 'night'

/** The four accents, with their day + night hex for swatch rendering. Order is
 *  canonical (ember, ink, moss, iris) per DESIGN_V2.md section 2, so the footer
 *  swatches and the settings appearance cards read the same left to right. */
export const ACCENTS: ReadonlyArray<{ key: Accent; label: string; day: string; night: string }> = [
  { key: 'ember', label: 'Ember', day: '#C2603D', night: '#E2814F' },
  { key: 'ink', label: 'Ink', day: '#3E63C8', night: '#7C97EE' },
  { key: 'moss', label: 'Moss', day: '#4E8A57', night: '#76B383' },
  { key: 'iris', label: 'Iris', day: '#7C5BD0', night: '#A788EE' },
]

const ACCENT_KEY = 'scout.accent'
const MODE_KEY = 'scout.mode'
const DEFAULT_ACCENT: Accent = 'ember'
const DEFAULT_MODE: Mode = 'night'

interface AccentModeValue {
  accent: Accent
  mode: Mode
  setAccent: (a: Accent) => void
  setMode: (m: Mode) => void
  toggleMode: () => void
}

const Ctx = createContext<AccentModeValue | null>(null)

function readStored<T extends string>(key: string, valid: readonly T[], fallback: T): T {
  if (typeof window === 'undefined') return fallback
  const v = window.localStorage.getItem(key) as T | null
  return v && valid.includes(v) ? v : fallback
}

export function AccentModeProvider({ children }: { children: ReactNode }) {
  const [accent, setAccentState] = useState<Accent>(() =>
    readStored(ACCENT_KEY, ['ember', 'iris', 'moss', 'ink'], DEFAULT_ACCENT),
  )
  const [mode, setModeState] = useState<Mode>(() =>
    readStored(MODE_KEY, ['day', 'night'], DEFAULT_MODE),
  )

  // Apply to <html> so the CSS vars resolve. useLayoutEffect runs before paint,
  // so a persisted non-default choice never flashes the index.html defaults.
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-accent', accent)
  }, [accent])

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-mode', mode)
    // Keep the mobile browser chrome in sync with the page background.
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', mode === 'night' ? '#121419' : '#FAF6EF')
  }, [mode])

  const setAccent = useCallback((a: Accent) => {
    setAccentState(a)
    window.localStorage.setItem(ACCENT_KEY, a)
  }, [])

  const setMode = useCallback((m: Mode) => {
    setModeState(m)
    window.localStorage.setItem(MODE_KEY, m)
  }, [])

  const toggleMode = useCallback(() => {
    setModeState((prev) => {
      const next = prev === 'day' ? 'night' : 'day'
      window.localStorage.setItem(MODE_KEY, next)
      return next
    })
  }, [])

  return (
    <Ctx.Provider value={{ accent, mode, setAccent, setMode, toggleMode }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAccentMode(): AccentModeValue {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAccentMode must be used within AccentModeProvider')
  return ctx
}
