/**
 * EyebrowLabel: a mono uppercase kicker (the wire-machine texture). Spline Sans
 * Mono, letter-spaced, --ink3 by default; pass `accent` when it labels an active
 * or accented thing (DESIGN_V2.md section 6).
 */

import type { ReactNode } from 'react'
import { cn } from '../ui/utils'

export function EyebrowLabel({
  children,
  accent = false,
  className,
}: {
  children: ReactNode
  accent?: boolean
  className?: string
}) {
  return (
    <span
      className={cn('font-mono font-semibold uppercase', className)}
      style={{
        fontSize: '10px',
        letterSpacing: '0.16em',
        color: accent ? 'var(--accent)' : 'var(--ink3)',
      }}
    >
      {children}
    </span>
  )
}
