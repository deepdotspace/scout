/**
 * The owner's chosen width (px) for the companion rail, persisted in localStorage
 * (single-owner preference, no backend), mirroring useReaderPrefs. Read on mount,
 * clamped to a readable range, persisted on every change, applied as a FIXED
 * pixel flex basis on the desktop rail.
 *
 * A fixed pixel basis (not a percentage clamp) is what keeps the rail edge from
 * jumping when a tool note renders: the rail is a constant width the owner chose,
 * so nothing inside it can move the boundary. Desktop only; below md the rail is
 * the docked bottom sheet and this is unused.
 */

import { useCallback, useState } from 'react'

const KEY = 'scout.railWidth'
export const DEFAULT_RAIL_WIDTH = 360
export const MIN_RAIL_WIDTH = 300
/** The reading column never collapses below a readable measure. */
export function maxRailWidth(): number {
  if (typeof window === 'undefined') return 560
  return Math.min(560, Math.round(window.innerWidth * 0.46))
}

/** Clamp a width to [min, max] for the current viewport. */
export function clampRailWidth(px: number): number {
  return Math.max(MIN_RAIL_WIDTH, Math.min(maxRailWidth(), Math.round(px)))
}

function readStored(): number {
  if (typeof window === 'undefined') return DEFAULT_RAIL_WIDTH
  const raw = Number(window.localStorage.getItem(KEY))
  return Number.isFinite(raw) && raw > 0 ? clampRailWidth(raw) : DEFAULT_RAIL_WIDTH
}

export interface RailWidth {
  width: number
  /** Set a new width (clamped + persisted). Used by the drag handle. */
  setWidth: (px: number) => void
}

export function useRailWidth(): RailWidth {
  const [width, setWidthState] = useState<number>(readStored)

  const setWidth = useCallback((px: number) => {
    const next = clampRailWidth(px)
    setWidthState(next)
    window.localStorage.setItem(KEY, String(next))
  }, [])

  return { width, setWidth }
}
