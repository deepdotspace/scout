/**
 * Reader type preferences: the chosen reading font and text size for the issue
 * reader. A single-owner reading preference, so localStorage is the right tool
 * (no backend), mirroring src/theme/accent.tsx. Read on mount, validated against
 * the known options, persisted on every change, and applied across every issue.
 *
 * The choice is applied by the reader route as two CSS variables on the reader
 * container ONLY: --reader-font (a font-family stack) and --reader-size (the body
 * rem). ReaderColumn derives its heading sizes off --reader-size with calc() so
 * the whole dispatch scales proportionally from one body anchor. App chrome
 * (Hanken Grotesk UI, Newsreader brand headings elsewhere) is never touched.
 *
 * Defaults on first run: Newsreader + Default (18px), per docs/research/READER_FONTS.md.
 */

import { useCallback, useState } from 'react'

/** A reading face. `stack` is the full CSS font-family value applied to body text.
 *  `sans` flags the two non-serif options so the picker can group them. */
export interface ReaderFont {
  key: string
  label: string
  stack: string
  sans?: boolean
}

/** The ship shortlist (docs/research/READER_FONTS.md section 2). Order is canonical;
 *  Newsreader stays the default. The six Google Fonts load via the <link> in
 *  index.html; Georgia is a pure system stack with no network cost. Each stack
 *  ends in a generic family so it renders safely before its web font swaps in. */
export const READER_FONTS: ReadonlyArray<ReaderFont> = [
  { key: 'newsreader', label: 'Newsreader', stack: "'Newsreader', Georgia, 'Times New Roman', serif" },
  { key: 'source-serif', label: 'Source Serif 4', stack: "'Source Serif 4', Georgia, 'Times New Roman', serif" },
  { key: 'lora', label: 'Lora', stack: "'Lora', Georgia, 'Times New Roman', serif" },
  { key: 'literata', label: 'Literata', stack: "'Literata', Georgia, 'Times New Roman', serif" },
  { key: 'georgia', label: 'Georgia', stack: "'Iowan Old Style', 'Charter', 'Georgia', Cambria, 'Times New Roman', serif" },
  { key: 'inter', label: 'Inter', stack: "'Inter', -apple-system, 'Segoe UI', Roboto, sans-serif", sans: true },
  { key: 'atkinson', label: 'Atkinson Hyperlegible', stack: "'Atkinson Hyperlegible', -apple-system, 'Segoe UI', sans-serif", sans: true },
]

/** Four named size steps (docs/research/READER_FONTS.md section 3). `rem` is the
 *  body anchor; headings scale off it via calc(). Order is the stepper order. */
export interface ReaderSize {
  key: string
  label: string
  rem: string
}

export const READER_SIZES: ReadonlyArray<ReaderSize> = [
  { key: 'small', label: 'Small', rem: '1rem' }, // 16px
  { key: 'default', label: 'Default', rem: '1.125rem' }, // 18px
  { key: 'large', label: 'Large', rem: '1.25rem' }, // 20px
  { key: 'xlarge', label: 'X-Large', rem: '1.4375rem' }, // 23px
]

const FONT_KEY = 'scout.reader.font'
const SIZE_KEY = 'scout.reader.size'
const DEFAULT_FONT = READER_FONTS[0] // Newsreader
const DEFAULT_SIZE = READER_SIZES[1] // Default (18px)

function readStored<T extends { key: string }>(
  storageKey: string,
  options: ReadonlyArray<T>,
  fallback: T,
): T {
  if (typeof window === 'undefined') return fallback
  const k = window.localStorage.getItem(storageKey)
  return options.find((o) => o.key === k) ?? fallback
}

export interface ReaderPrefs {
  font: ReaderFont
  size: ReaderSize
  setFont: (key: string) => void
  /** Step the size up (+1) or down (-1), clamped to the ends of the scale. */
  stepSize: (direction: 1 | -1) => void
  canStepUp: boolean
  canStepDown: boolean
}

export function useReaderPrefs(): ReaderPrefs {
  const [font, setFontState] = useState<ReaderFont>(() => readStored(FONT_KEY, READER_FONTS, DEFAULT_FONT))
  const [size, setSizeState] = useState<ReaderSize>(() => readStored(SIZE_KEY, READER_SIZES, DEFAULT_SIZE))

  const setFont = useCallback((key: string) => {
    const next = READER_FONTS.find((f) => f.key === key)
    if (!next) return
    setFontState(next)
    window.localStorage.setItem(FONT_KEY, next.key)
  }, [])

  const stepSize = useCallback((direction: 1 | -1) => {
    setSizeState((prev) => {
      const i = READER_SIZES.findIndex((s) => s.key === prev.key)
      const next = READER_SIZES[Math.min(READER_SIZES.length - 1, Math.max(0, i + direction))]
      window.localStorage.setItem(SIZE_KEY, next.key)
      return next
    })
  }, [])

  const idx = READER_SIZES.findIndex((s) => s.key === size.key)
  return {
    font,
    size,
    setFont,
    stepSize,
    canStepUp: idx < READER_SIZES.length - 1,
    canStepDown: idx > 0,
  }
}
