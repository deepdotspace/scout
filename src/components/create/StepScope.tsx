/**
 * Step 1, Scope (shot 12-create-scope). Laila's first-person read of the topic.
 * A Name input, then one elevated card with two lists: "I'll bring you" (accent
 * checks, drawn from the real /api/scouts-read scope, angle, and example sources)
 * and "I'll throw out" (muted, the kinds of noise the pipeline filters). The scope
 * sentence stays editable behind a small refine toggle so the real wiring (the
 * user can tweak the sharpened scope) is preserved. Loading and error states keep
 * the step from ever dead-ending.
 */

import { useState } from 'react'
import { ArrowRight, Check, X, RotateCw } from 'lucide-react'
import { Button } from '../scout/Button'
import { Card } from '../scout/Card'
import { Input, Textarea, Field } from '../scout/Field'
import { InlineStatus } from '../scout/Status'
import { StepKicker, StepHeading, StepLede, StepFooter } from './StepChrome'
import type { ScoutsRead } from '../../lib/ai'

/** Split a scope (one or two sentences) into the "I'll bring you" bullet lines. */
function bringLines(read: ScoutsRead): string[] {
  const fromScope = read.scope
    .split(/(?<=\.)\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1)
  const lines = [...fromScope]
  if (read.angle.trim()) lines.push(`The angle: ${read.angle.trim().replace(/\.$/, '')}.`)
  if (read.exampleSources.length > 0) {
    lines.push(`Primary sources like ${read.exampleSources.slice(0, 3).join(', ')}.`)
  }
  return lines.length > 0 ? lines : [read.scope]
}

/** The kinds of noise Scout's relevance pass drops. Honest, not topic-invented. */
const THROW_OUT: ReadonlyArray<string> = [
  'Rumors and leaks resting on a single anonymous source.',
  'Re-runs of news you already saw, and pure engagement bait.',
  'Anything that does not actually move your scope above.',
]

export function StepScope({
  total,
  stepNumber,
  read,
  status,
  error,
  topic,
  onTopic,
  title,
  onTitle,
  scope,
  onScope,
  onRetry,
  onBack,
  onNext,
  nextLabel,
}: {
  total: number
  /** 1-indexed position in the current flow (2 in create, 1 in edit). */
  stepNumber: number
  read: ScoutsRead | null
  status: 'idle' | 'loading' | 'error'
  error: string
  topic: string
  onTopic: (v: string) => void
  title: string
  onTitle: (v: string) => void
  scope: string
  onScope: (v: string) => void
  onRetry: () => void
  onBack?: () => void
  onNext: () => void
  nextLabel: string
}) {
  const [refining, setRefining] = useState(false)

  return (
    <div>
      <StepKicker n={stepNumber} total={total} label="Scope" />
      <StepHeading>Here is how I read that.</StepHeading>
      <StepLede>
        Tweak the topic, the name, and the scope until it is exactly what you want. This is what I
        will go hunting for.
      </StepLede>

      <Field label="Name" className="mt-7">
        <Input
          value={title}
          onChange={(e) => onTitle(e.target.value)}
          placeholder="Name this beat"
          aria-label="Newsletter name"
        />
      </Field>

      <Field
        label="Topic"
        hint="Edit this and I will read it again."
        className="mt-5"
      >
        <Textarea
          value={topic}
          onChange={(e) => onTopic(e.target.value)}
          placeholder="What you want to stay on top of"
          aria-label="Topic"
          className="min-h-[64px]"
        />
      </Field>

      {status === 'loading' ? (
        <ScopeLoading />
      ) : status === 'error' ? (
        <div className="mt-6 flex flex-col gap-3">
          <InlineStatus tone="danger">{error}</InlineStatus>
          <div>
            <Button variant="ghost" size="sm" onClick={onRetry}>
              <RotateCw />
              Read it again
            </Button>
          </div>
        </div>
      ) : read ? (
        <Card elevated className="mt-5 p-6">
          <ListBlock
            kicker="I'll bring you"
            tone="accent"
            icon={<Check className="size-[15px]" style={{ color: 'var(--accent)' }} />}
            items={bringLines(read)}
          />
          <div className="my-5 h-px" style={{ background: 'var(--line)' }} />
          <ListBlock
            kicker="I'll throw out"
            tone="muted"
            icon={<X className="size-[15px]" style={{ color: 'var(--ink3)' }} />}
            items={THROW_OUT}
          />

          {refining ? (
            <Field label="Scope" hint="The concrete thing I watch for you." className="mt-6">
              <Textarea value={scope} onChange={(e) => onScope(e.target.value)} className="min-h-[72px]" />
            </Field>
          ) : (
            <button
              type="button"
              onClick={() => setRefining(true)}
              className="mt-5 font-sans text-[13px] font-medium transition-colors"
              style={{ color: 'var(--ink3)' }}
            >
              Refine the scope in your own words
            </button>
          )}
        </Card>
      ) : null}

      <StepFooter>
        {onBack && (
          <Button variant="ghost" size="lg" onClick={onBack}>
            Back
          </Button>
        )}
        <Button
          variant="primary"
          size="lg"
          onClick={onNext}
          disabled={!read || !scope.trim()}
          disabledReason="Let me finish reading the topic first."
          className="flex-1"
        >
          {nextLabel}
          <ArrowRight />
        </Button>
      </StepFooter>
    </div>
  )
}

function ListBlock({
  kicker,
  tone,
  icon,
  items,
}: {
  kicker: string
  tone: 'accent' | 'muted'
  icon: React.ReactNode
  items: ReadonlyArray<string>
}) {
  return (
    <div>
      <p
        className="font-mono font-semibold uppercase"
        style={{
          fontSize: '10px',
          letterSpacing: '0.16em',
          color: tone === 'accent' ? 'var(--accent)' : 'var(--ink3)',
        }}
      >
        {kicker}
      </p>
      <ul className="mt-3 flex flex-col gap-2.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className="mt-[3px] shrink-0">{icon}</span>
            <span
              style={{
                fontSize: '14.5px',
                lineHeight: 1.5,
                color: tone === 'accent' ? 'var(--ink)' : 'var(--ink2)',
              }}
            >
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ScopeLoading() {
  return (
    <div className="mt-6 flex flex-col gap-3" aria-busy>
      <p style={{ fontSize: '14px', color: 'var(--ink2)' }}>Reading your topic...</p>
      {[3, 2, 2.5].map((w, i) => (
        <div
          key={i}
          className="h-4 animate-pulse rounded"
          style={{ background: 'var(--s2)', width: `${(w / 3) * 100}%` }}
        />
      ))}
    </div>
  )
}
