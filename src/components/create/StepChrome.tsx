/**
 * StepChrome: the persistent frame for the create and edit steppers (DESIGN_V2.md
 * section 5, shots 11 to 16). A single centered column (max 660) with a header
 * holding a Cancel button on the left and the step-dots on the right, then a mono
 * kicker "STEP N OF M / <LABEL>" above each step's content.
 *
 * The dots are the only progress affordance: the active one elongates, completed
 * ones fill with the accent, upcoming ones stay on the hairline. Hierarchy is
 * type and space, never a boxed grid.
 */

import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from '../scout/Button'

export function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      {Array.from({ length: total }).map((_, i) => {
        const done = i < current
        const active = i === current
        return (
          <span
            key={i}
            className="h-[6px] rounded-full transition-all duration-300"
            style={{
              width: active ? '22px' : '6px',
              background: done || active ? 'var(--accent)' : 'var(--line)',
            }}
          />
        )
      })}
    </div>
  )
}

export function StepChrome({
  total,
  current,
  onCancel,
  children,
}: {
  total: number
  current: number
  onCancel: () => void
  children: ReactNode
}) {
  return (
    <div className="flex min-h-full w-full justify-center px-5 py-7 md:px-10 md:py-10">
      <div className="flex w-full max-w-[660px] flex-col">
        <header className="mb-9 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X />
            Cancel
          </Button>
          <StepDots total={total} current={current} />
        </header>
        {children}
      </div>
    </div>
  )
}

/** The mono kicker over each step's heading: "STEP N OF M / <LABEL>". */
export function StepKicker({ n, total, label }: { n: number; total: number; label: string }) {
  return (
    <p
      className="font-mono font-semibold uppercase"
      style={{ fontSize: '10.5px', letterSpacing: '0.16em', color: 'var(--accent)' }}
    >
      Step {n} of {total} <span style={{ color: 'var(--ink3)' }}>· {label}</span>
    </p>
  )
}

/** The serif step heading. An optional muted trailing word ("Optional."). */
export function StepHeading({ children, muted }: { children: ReactNode; muted?: string }) {
  return (
    <h1
      className="mt-3 font-serif"
      style={{ fontSize: '32px', fontWeight: 400, lineHeight: 1.22, letterSpacing: '-0.01em', color: 'var(--ink)' }}
    >
      {children}
      {muted && <span style={{ color: 'var(--ink3)' }}> {muted}</span>}
    </h1>
  )
}

/** A serif sub-line under a step heading (the correspondent's framing). */
export function StepLede({ children }: { children: ReactNode }) {
  return (
    <p
      className="mt-2.5 max-w-[52ch]"
      style={{ fontSize: '15px', lineHeight: 1.55, color: 'var(--ink2)' }}
    >
      {children}
    </p>
  )
}

/** The footer action row under a step: a ghost Back and a primary advance CTA. */
export function StepFooter({ children }: { children: ReactNode }) {
  return <div className="mt-9 flex items-center gap-2.5">{children}</div>
}
