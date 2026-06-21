/**
 * Step 2, Voice (shot 13-create-voice). Six voice cards from the mapping table.
 * Each shows the label and a one-line blurb; the selected card gets an accent
 * border, a soft accent wash, and a serif italic sample line behind an accent
 * left-rule so you can hear the voice. "Your own voice" reveals a textarea for a
 * custom voice. Labels and blurbs come from personas.ts (ids and fragments stay
 * stable so existing newsletters keep their voice).
 */

import { ArrowRight, Check } from 'lucide-react'
import { Button } from '../scout/Button'
import { Textarea } from '../scout/Field'
import { StepKicker, StepHeading, StepLede, StepFooter } from './StepChrome'
import { VOICE_OPTIONS } from '../../personas'
import type { VoicePreset } from '../../personas'

const CUSTOM = {
  label: 'Your own voice',
  blurb: 'Describe how you want Scout to write, in your own words.',
} as const

export function StepVoice({
  total,
  stepNumber,
  preset,
  onPreset,
  customPrompt,
  onCustomPrompt,
  onBack,
  onNext,
  nextLabel,
}: {
  total: number
  stepNumber: number
  preset: VoicePreset
  onPreset: (v: VoicePreset) => void
  customPrompt: string
  onCustomPrompt: (v: string) => void
  onBack: () => void
  onNext: () => void
  nextLabel: string
}) {
  return (
    <div>
      <StepKicker n={stepNumber} total={total} label="Voice" />
      <StepHeading>Who should write it?</StepHeading>
      <StepLede>Every voice reads the same news. They just tell it differently. Tap one to hear it.</StepLede>

      <div className="mt-6 flex flex-col gap-2.5">
        {VOICE_OPTIONS.map((v) => (
          <VoiceCard
            key={v.id}
            label={v.label}
            blurb={v.blurb}
            sample={v.sample}
            selected={preset === v.id}
            onSelect={() => onPreset(v.id)}
          />
        ))}
        <VoiceCard
          label={CUSTOM.label}
          blurb={CUSTOM.blurb}
          selected={preset === 'custom'}
          onSelect={() => onPreset('custom')}
        >
          {preset === 'custom' && (
            <Textarea
              value={customPrompt}
              onChange={(e) => onCustomPrompt(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder="e.g. Dry and a little wry. Short sentences. Skip the throat-clearing and get to the point."
              className="mt-3.5"
              aria-label="Your custom voice"
            />
          )}
        </VoiceCard>
      </div>

      <StepFooter>
        <Button variant="ghost" size="lg" onClick={onBack}>
          Back
        </Button>
        <Button variant="primary" size="lg" onClick={onNext} className="flex-1">
          {nextLabel}
          <ArrowRight />
        </Button>
      </StepFooter>
    </div>
  )
}

function VoiceCard({
  label,
  blurb,
  sample,
  selected,
  onSelect,
  children,
}: {
  label: string
  blurb: string
  sample?: string
  selected: boolean
  onSelect: () => void
  children?: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className="rounded-[14px] p-4 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2"
      style={{
        background: selected ? 'var(--accent-soft)' : 'var(--surface)',
        border: '1px solid',
        borderColor: selected ? 'var(--accent-line)' : 'var(--line)',
        boxShadow: selected ? 'none' : 'var(--shadow-card)',
        ['--tw-ring-color' as string]: 'var(--accent-soft)',
      }}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="flex flex-col gap-1">
          <span className="font-serif" style={{ fontSize: '19px', fontWeight: 500, color: 'var(--ink)' }}>
            {label}
          </span>
          <span style={{ fontSize: '13.5px', lineHeight: 1.5, color: 'var(--ink2)' }}>{blurb}</span>
        </span>
        {selected && <Check className="mt-1 size-[18px] shrink-0" style={{ color: 'var(--accent)' }} />}
      </span>

      {selected && sample && (
        <p
          className="mt-3 font-serif italic"
          style={{
            fontSize: '16px',
            lineHeight: 1.55,
            color: 'var(--ink2)',
            paddingLeft: '14px',
            borderLeft: '2px solid var(--accent)',
          }}
        >
          {sample}
        </p>
      )}

      {children}
    </button>
  )
}
