/**
 * Pill / Chip: the rounded option control (cadence buttons, "More like this",
 * seed prompts). 1px hairline border, 20px radius; hover tints to the accent.
 * `selected` fills it with the accent wash + accent text (DESIGN_V2.md section 6).
 */

import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '../ui/utils'

export interface PillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean
}

export const Pill = forwardRef<HTMLButtonElement, PillProps>(function Pill(
  { selected = false, className, children, style, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      data-selected={selected || undefined}
      className={cn(
        'sct-pill inline-flex items-center gap-1.5 rounded-[20px] px-3.5 py-1.5',
        'font-sans font-semibold transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2',
        className,
      )}
      style={{
        fontSize: '12.5px',
        border: '1px solid',
        borderColor: selected ? 'var(--accent-line)' : 'var(--line)',
        background: selected ? 'var(--accent-soft)' : 'transparent',
        color: selected ? 'var(--accent)' : 'var(--ink2)',
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  )
})
