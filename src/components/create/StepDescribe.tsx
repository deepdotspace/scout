/**
 * Step 0, Describe (shot 11-create-topic). A serif H1 question, a large serif
 * textarea on an elevated surface, three seed-prompt pills that fill the box, and
 * the primary CTA that runs Scout's read. Errors from the read surface inline so
 * the step is never a dead end.
 */

import { ArrowRight } from 'lucide-react'
import { Button } from '../scout/Button'
import { Pill } from '../scout/Pill'
import { StepKicker, StepHeading, StepLede, StepFooter } from './StepChrome'

const SEEDS: ReadonlyArray<string> = [
  'AI agents, only what matters, no hype',
  'Everything my main competitor does',
  "What's happening in my city this week",
]

export function StepDescribe({
  total,
  topic,
  onTopic,
  onNext,
  loading,
}: {
  total: number
  topic: string
  onTopic: (v: string) => void
  onNext: () => void
  loading: boolean
}) {
  return (
    <div>
      <StepKicker n={1} total={total} label="Describe" />
      <StepHeading>What do you want to stay on top of?</StepHeading>
      <StepLede>
        Tell me in plain words. A field, a company you watch, your city, a hobby. Be as vague as you
        like. I will sharpen it.
      </StepLede>

      <textarea
        value={topic}
        onChange={(e) => onTopic(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && topic.trim()) {
            e.preventDefault()
            onNext()
          }
        }}
        placeholder="e.g. keep me current on what is happening in AI agents, but only the stuff that actually matters. No hype, no rumors."
        aria-label="What you want to follow"
        autoFocus
        className="sct-input mt-7 w-full rounded-[14px] px-5 py-4 font-serif outline-none transition-shadow"
        style={{
          background: 'var(--surface)',
          color: 'var(--ink)',
          boxShadow: 'var(--shadow-card-hover)',
          fontSize: '19px',
          lineHeight: 1.55,
          minHeight: '128px',
        }}
      />

      <div className="mt-3.5 flex flex-wrap gap-2">
        {SEEDS.map((s) => (
          <Pill key={s} onClick={() => onTopic(s)}>
            {s}
          </Pill>
        ))}
      </div>

      <StepFooter>
        <Button
          variant="primary"
          size="lg"
          onClick={onNext}
          loading={loading}
          disabled={!topic.trim()}
          disabledReason="Tell me what to follow first."
        >
          Let Scout sharpen this
          {!loading && <ArrowRight />}
        </Button>
      </StepFooter>
    </div>
  )
}
