/**
 * Card: a --surface panel with a hairline border. `elevated` adds the soft warm
 * two-layer shadow used on the few real elevations (featured card, inputs); plain
 * cards lean on the --line hairline (DESIGN_V2.md section 2). `interactive` adds a
 * tactile press + pointer cursor for cards that are themselves a click target.
 */

import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../ui/utils'
import { EASE, PRESS, useReducedMotion } from './motion'

type NativeDivProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration'
>

export interface CardProps extends NativeDivProps {
  interactive?: boolean
  elevated?: boolean
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { interactive = false, elevated = false, className, children, style, ...props },
  ref,
) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      ref={ref}
      whileTap={interactive && !reduced ? PRESS : undefined}
      transition={{ duration: 0.12, ease: EASE }}
      className={cn(
        'rounded-[16px] transition-colors duration-200',
        interactive && 'cursor-pointer',
        className,
      )}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        boxShadow: elevated ? 'var(--shadow-card-hover)' : 'var(--shadow-card)',
        ...style,
      }}
      {...props}
    >
      {children}
    </motion.div>
  )
})
