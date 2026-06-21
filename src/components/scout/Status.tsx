/**
 * Status surfaces: the config-health dot and an honest inline status line.
 *
 * ConfigHealthDot is the single green/amber/red signal (settings, the rail foot).
 * InlineStatus is the honest one-liner for a failed action or a flagged state: it
 * names what happened, never a blank toast.
 */

import type { CSSProperties, ReactNode } from 'react'
import { cn } from '../ui/utils'

export type Health = 'ok' | 'warn' | 'down' | 'unknown'

const DOT: Record<Health, string> = {
  ok: 'var(--color-success)',
  warn: 'var(--color-warning)',
  down: 'var(--color-danger)',
  unknown: 'var(--ink3)',
}

export function ConfigHealthDot({ health, className }: { health: Health; className?: string }) {
  return (
    <span className={cn('relative inline-flex size-2.5', className)} aria-hidden>
      <span className="inline-flex size-2.5 rounded-full" style={{ background: DOT[health] }} />
    </span>
  )
}

type Tone = 'info' | 'success' | 'warning' | 'danger'

const INLINE: Record<Tone, CSSProperties> = {
  info: { background: 'var(--s2)', color: 'var(--ink2)', borderColor: 'var(--line)' },
  success: { background: 'var(--color-success-muted)', color: 'var(--color-success)', borderColor: 'var(--color-success-border)' },
  warning: { background: 'var(--color-warning-muted)', color: 'var(--color-warning)', borderColor: 'var(--color-warning-border)' },
  danger: { background: 'var(--color-danger-muted)', color: 'var(--color-danger)', borderColor: 'var(--color-danger-border)' },
}

export function InlineStatus({
  tone = 'info',
  icon,
  children,
  className,
}: {
  tone?: Tone
  icon?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-2.5 rounded-[11px] border px-3 py-2.5 text-sm',
        '[&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0',
        className,
      )}
      style={{ borderStyle: 'solid', borderWidth: '1px', ...INLINE[tone] }}
    >
      {icon}
      <span className="text-pretty">{children}</span>
    </div>
  )
}
