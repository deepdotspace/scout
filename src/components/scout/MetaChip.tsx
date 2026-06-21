/**
 * MetaChip: a dense mono chip for schedule / next-send / counts. Spline Sans Mono
 * with tabular numerals so columns of times and counts line up. Tones map to
 * status, never decoration; `flare` is the only accented variant, used sparingly
 * (e.g. the next-send the user cares about). Tone names kept stable for v1 callers.
 */

import type { ReactNode } from 'react'
import { cn } from '../ui/utils'
import type { CSSProperties } from 'react'

type Tone = 'neutral' | 'flare' | 'success' | 'warning' | 'danger'

const TONES: Record<Tone, CSSProperties> = {
  neutral: { background: 'var(--s2)', color: 'var(--ink2)', borderColor: 'var(--line)' },
  flare: { background: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'var(--accent-line)' },
  success: { background: 'var(--color-success-muted)', color: 'var(--color-success)', borderColor: 'var(--color-success-border)' },
  warning: { background: 'var(--color-warning-muted)', color: 'var(--color-warning)', borderColor: 'var(--color-warning-border)' },
  danger: { background: 'var(--color-danger-muted)', color: 'var(--color-danger)', borderColor: 'var(--color-danger-border)' },
}

export function MetaChip({
  icon,
  children,
  tone = 'neutral',
  className,
}: {
  icon?: ReactNode
  children: ReactNode
  tone?: Tone
  className?: string
}) {
  return (
    <span
      className={cn(
        'tnum font-mono inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        '[&_svg]:size-3.5 [&_svg]:shrink-0',
        className,
      )}
      style={{ borderStyle: 'solid', borderWidth: '1px', ...TONES[tone] }}
    >
      {icon}
      {children}
    </span>
  )
}
