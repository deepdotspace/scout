/**
 * Field set: the light inputs of the paper world. Input, Textarea, a labelled
 * Field wrapper, and Label. Inputs sit on --surface with no border and a soft
 * shadow; focus shows a 2px accent ring (DESIGN_V2.md section 6). The accent stays
 * rationed (ring on focus only).
 *
 * For Select, reuse the scaffold's Radix Select (../ui); this file covers the
 * text inputs Scout's forms need.
 */

import { forwardRef, type ReactNode } from 'react'
import { cn } from '../ui/utils'

const BASE =
  'sct-input w-full rounded-[11px] px-3.5 outline-none transition-shadow ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, style, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(BASE, 'h-11 text-sm', className)}
        style={{ background: 'var(--surface)', color: 'var(--ink)', boxShadow: 'var(--shadow-card)', ...style }}
        {...props}
      />
    )
  },
)

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, style, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(BASE, 'min-h-[88px] py-3 text-sm leading-relaxed', className)}
        style={{ background: 'var(--surface)', color: 'var(--ink)', boxShadow: 'var(--shadow-card)', ...style }}
        {...props}
      />
    )
  },
)

export function Label({ className, children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('font-sans text-xs font-medium', className)}
      style={{ color: 'var(--ink2)' }}
      {...props}
    >
      {children}
    </label>
  )
}

/** A labelled control with optional hint text below. */
export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string
  hint?: string
  htmlFor?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && (
        <p className="text-xs" style={{ color: 'var(--ink3)' }}>
          {hint}
        </p>
      )}
    </div>
  )
}
