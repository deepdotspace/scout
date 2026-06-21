/**
 * StubPage: a clean placeholder for routes shipping in a later wave. It renders
 * inside the shell (never a blank or broken screen), states plainly what is
 * coming, and always offers a way back. No dead ends.
 */

import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from './Button'
import { ScoutMark } from './Logo'
import { MetaChip } from './MetaChip'

export function StubPage({
  title,
  summary,
  wave,
  backTo = '/',
  backLabel = 'Back to Home',
}: {
  title: string
  summary: string
  wave: string
  backTo?: string
  backLabel?: string
}) {
  const navigate = useNavigate()
  return (
    <div className="flex h-full flex-col px-5 py-6 md:px-12 md:py-10">
      <button
        onClick={() => navigate(backTo)}
        className="mb-8 inline-flex w-fit items-center gap-1.5 text-sm text-[var(--color-text-secondary)] transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {backLabel}
      </button>

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <ScoutMark size={32} className="mb-6 opacity-60" />
        <MetaChip tone="flare" className="mb-5">
          {wave}
        </MetaChip>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mt-3 max-w-md text-pretty text-sm leading-relaxed text-[var(--color-text-secondary)]">
          {summary}
        </p>
        <Button variant="ghost" className="mt-8" onClick={() => navigate(backTo)}>
          {backLabel}
        </Button>
      </div>
    </div>
  )
}
