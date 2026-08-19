/**
 * Step 4, Boundaries (shot 15-create-boundaries). Three optional inputs: tie it to
 * a place, sources to favor, sources to block. All blank means Scout reads the
 * whole open web. The two source fields are comma-separated; the flow parses them
 * into domain lists on submit (the real wiring, unchanged).
 */

import { ArrowRight } from 'lucide-react'
import { Button } from '../scout/Button'
import { Input } from '../scout/Field'
import { StepKicker, StepHeading, StepLede, StepFooter } from './StepChrome'

function BoundedField({
  label,
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  ariaLabel: string
}) {
  return (
    <div>
      <p
        className="mb-2.5 font-mono font-semibold uppercase"
        style={{ fontSize: '10px', letterSpacing: '0.16em', color: 'var(--ink3)' }}
      >
        {label}
      </p>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="h-12"
      />
    </div>
  )
}

export function StepBoundaries({
  total,
  stepNumber,
  location,
  onLocation,
  preferredDomains,
  onPreferredDomains,
  blockedDomains,
  onBlockedDomains,
  onBack,
  onNext,
  nextLabel,
}: {
  total: number
  stepNumber: number
  location: string
  onLocation: (v: string) => void
  preferredDomains: string
  onPreferredDomains: (v: string) => void
  blockedDomains: string
  onBlockedDomains: (v: string) => void
  onBack: () => void
  onNext: () => void
  nextLabel: string
}) {
  return (
    <div>
      <StepKicker n={stepNumber} total={total} label="Boundaries" />
      <StepHeading muted="Optional.">Any boundaries?</StepHeading>
      <StepLede>Leave these blank and I will read the whole open web. Or steer me.</StepLede>

      <div className="mt-7 flex flex-col gap-6">
        <BoundedField
          label="Tie it to a place"
          value={location}
          onChange={onLocation}
          placeholder="e.g. Lisbon, Portugal"
          ariaLabel="Location"
        />
        <BoundedField
          label="Sources to favor"
          value={preferredDomains}
          onChange={onPreferredDomains}
          placeholder="Full domains, e.g. arxiv.org, x.com, openai.com"
          ariaLabel="Sources to favor"
        />
        <BoundedField
          label="Sources to block"
          value={blockedDomains}
          onChange={onBlockedDomains}
          placeholder="Full domains, e.g. reddit.com, medium.com"
          ariaLabel="Sources to block"
        />
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
