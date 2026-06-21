/**
 * EmptyState: warm and teaching, not "nothing here". The serif carries the line
 * (the place personality is allowed); the accent lives only in the icon ring and
 * the optional primary action (DESIGN_V2.md: empty states are serif italic and
 * teach). No dead ends.
 */

import type { ReactNode } from 'react'
import { cn } from '../ui/utils'

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}>
      {icon && (
        <div
          className="mb-5 inline-flex size-14 items-center justify-center rounded-full [&_svg]:size-6"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-line)' }}
        >
          {icon}
        </div>
      )}
      <h3 className="font-serif text-[22px] font-normal" style={{ color: 'var(--ink)' }}>
        {title}
      </h3>
      {description && (
        <p
          className="mt-2 max-w-md font-serif text-[15.5px] leading-relaxed"
          style={{ color: 'var(--ink2)', fontStyle: 'italic' }}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
