/**
 * SourceChip: a small source attribution chip. --s2 fill, mono label, an
 * external-link glyph; hover tints to the accent over the soft wash. Renders as
 * a link when `href` is set, else a static span (DESIGN_V2.md section 6).
 */

import type { ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'
import { cn } from '../ui/utils'

export function SourceChip({
  children,
  href,
  className,
}: {
  children: ReactNode
  href?: string
  className?: string
}) {
  const cls = cn(
    'sct-source inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-[7px] px-2 py-1',
    'font-mono transition-colors duration-150',
    className,
  )
  const style = {
    fontSize: '11px',
    background: 'var(--s2)',
    color: 'var(--ink3)',
  } as const
  const inner = (
    <>
      <span className="truncate">{children}</span>
      <ExternalLink className="size-3 shrink-0" />
    </>
  )

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer noopener" className={cls} style={style}>
        {inner}
      </a>
    )
  }
  return (
    <span className={cls} style={style}>
      {inner}
    </span>
  )
}
