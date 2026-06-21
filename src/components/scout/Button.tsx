/**
 * Button. Scout's CTA / secondary / action-pill / danger.
 *
 * - primary: the accent CTA. Accent fill, --aink text, soft accent shadow, hover
 *   brightens, active nudges down 1px (DESIGN_V2.md section 6).
 * - ghost: the quiet secondary. Hairline border, --ink2 text, hover wash.
 * - accent: the accent-tinted action pill ("File now", "Wire back"). Accent line
 *   border over the soft wash; hover inverts to a solid accent fill.
 * - danger: destructive intent only.
 *
 * `disabledReason` keeps a disabled button honest via a title so the user learns
 * why it is off. Press scales ~0.98 (collapses under reduced motion).
 *
 * Variant names primary/ghost/danger are kept for v1 callers; `accent` is new.
 */

import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../ui/utils'
import { EASE, PRESS, useReducedMotion } from './motion'

type Variant = 'primary' | 'ghost' | 'accent' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary: 'sct-btn-primary font-semibold',
  ghost: 'sct-btn-ghost',
  accent: 'sct-btn-accent font-semibold',
  danger: 'sct-btn-danger',
}

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-[13px] gap-1.5 rounded-[9px]',
  md: 'h-11 px-4 text-sm gap-2 rounded-[11px]',
  lg: 'h-[52px] px-6 text-[15px] gap-2 rounded-[13px]',
}

/** Drag/animation handlers conflict between native DOM and framer-motion; Scout
 *  buttons never use them, so we drop them rather than fight the union. */
type NativeButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration'
>

export interface ButtonProps extends NativeButtonProps {
  variant?: Variant
  size?: Size
  loading?: boolean
  /** Shown as a title when disabled so the off state is never mysterious. */
  disabledReason?: string
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'ghost', size = 'md', loading = false, disabled, disabledReason, className, children, title, ...props },
  ref,
) {
  const reduced = useReducedMotion()
  const isDisabled = disabled || loading

  return (
    <motion.button
      ref={ref}
      disabled={isDisabled}
      title={isDisabled && disabledReason ? disabledReason : title}
      whileTap={reduced || isDisabled ? undefined : PRESS}
      transition={{ duration: 0.12, ease: EASE }}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap font-medium transition-[background,color,box-shadow,border-color,filter] duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-60 [&_svg]:size-[1.05em] [&_svg]:shrink-0',
        SIZES[size],
        VARIANTS[variant],
        className,
      )}
      style={{ ['--tw-ring-color' as string]: 'var(--accent-soft)' }}
      {...props}
    >
      {loading && (
        <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </motion.button>
  )
})
