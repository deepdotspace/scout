/**
 * SettingsCard: one settings section in the press-wire world (DESIGN_V2.md
 * section 5, shots 21 / 26). A mono section eyebrow over a soft-shadow --surface
 * card that groups its rows with hairline dividers, never per-row boxes.
 *
 * `Row` is the shared hairline-divided row: a label + detail on the left and a
 * trailing slot on the right. Rows lose their divider on the last child via the
 * `last:` selector so the card never shows a dangling rule.
 */

import type { ReactNode } from 'react'
import { cn } from '../ui/utils'

export function SettingsCard({
  eyebrow,
  className,
  bodyClassName,
  children,
}: {
  eyebrow: string
  className?: string
  bodyClassName?: string
  children: ReactNode
}) {
  return (
    <section className={cn('mb-10', className)}>
      <div
        className="mb-3.5 font-mono text-[10.5px] font-semibold uppercase"
        style={{ letterSpacing: '0.14em', color: 'var(--ink3)' }}
      >
        {eyebrow}
      </div>
      <div
        className={cn('rounded-[16px]', bodyClassName)}
        style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-card)' }}
      >
        {children}
      </div>
    </section>
  )
}

/** A hairline-divided row inside a SettingsCard: leading slot, body, trailing slot. */
export function Row({
  lead,
  label,
  detail,
  trailing,
}: {
  lead?: ReactNode
  label: ReactNode
  detail?: ReactNode
  trailing?: ReactNode
}) {
  return (
    <div
      className="flex items-center gap-3.5 border-b px-[22px] py-[15px] last:border-b-0"
      style={{ borderColor: 'var(--line)' }}
    >
      {lead}
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-medium" style={{ color: 'var(--ink)' }}>
          {label}
        </div>
        {detail && (
          <div className="mt-0.5 text-[13px]" style={{ color: 'var(--ink2)' }}>
            {detail}
          </div>
        )}
      </div>
      {trailing}
    </div>
  )
}
