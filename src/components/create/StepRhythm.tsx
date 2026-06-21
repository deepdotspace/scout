/**
 * Step 3, Rhythm (shot 14-create-rhythm). Cadence pills (Every day / Weekdays /
 * Once a week / Specific days, the last revealing day toggles), a time input with
 * the detected timezone shown beside it, and "how far back to look" pills. All
 * pills reuse the Pill primitive. The real schedule fields (frequency, days, time,
 * timezone, recencyWindow) are owned by the flow; this step just edits them.
 */

import { ArrowRight } from 'lucide-react'
import { Button } from '../scout/Button'
import { Input } from '../scout/Field'
import { Pill } from '../scout/Pill'
import { StepKicker, StepHeading, StepLede, StepFooter } from './StepChrome'
import type { Frequency, RecencyWindow } from '../../lib/types'

const CADENCE: ReadonlyArray<{ value: Frequency; label: string }> = [
  { value: 'daily', label: 'Every day' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekly', label: 'Once a week' },
  { value: 'custom', label: 'Specific days' },
]

const RECENCY: ReadonlyArray<{ value: RecencyWindow; label: string }> = [
  { value: '24h', label: 'Last 24 hours' },
  { value: '3d', label: 'Last few days' },
  { value: '7d', label: 'Last week' },
  { value: '30d', label: 'Last month' },
]

const WEEKDAYS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
]

/** The short tz label shown next to the timezone, e.g. "WET". Best-effort. */
function tzAbbrev(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'short' }).formatToParts(
      new Date(),
    )
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? ''
  } catch {
    return ''
  }
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-2.5 font-mono font-semibold uppercase"
      style={{ fontSize: '10px', letterSpacing: '0.16em', color: 'var(--ink3)' }}
    >
      {children}
    </p>
  )
}

export function StepRhythm({
  total,
  stepNumber,
  frequency,
  onFrequency,
  days,
  onToggleDay,
  time,
  onTime,
  timezone,
  recencyWindow,
  onRecency,
  onBack,
  onNext,
  nextLabel,
}: {
  total: number
  stepNumber: number
  frequency: Frequency
  onFrequency: (v: Frequency) => void
  days: string[]
  onToggleDay: (key: string) => void
  time: string
  onTime: (v: string) => void
  timezone: string
  recencyWindow: RecencyWindow
  onRecency: (v: RecencyWindow) => void
  onBack: () => void
  onNext: () => void
  nextLabel: string
}) {
  const abbrev = tzAbbrev(timezone)
  const customNoDays = frequency === 'custom' && days.length === 0

  return (
    <div>
      <StepKicker n={stepNumber} total={total} label="Rhythm" />
      <StepHeading>When should it land?</StepHeading>
      <StepLede>Pick a rhythm. You can always ask for one off-schedule.</StepLede>

      <div className="mt-7">
        <FieldLabel>How often</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {CADENCE.map((c) => (
            <Pill key={c.value} selected={frequency === c.value} onClick={() => onFrequency(c.value)}>
              {c.label}
            </Pill>
          ))}
        </div>
      </div>

      {frequency === 'custom' && (
        <div className="mt-5">
          <FieldLabel>Which days</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => (
              <Pill key={d.key} selected={days.includes(d.key)} onClick={() => onToggleDay(d.key)}>
                {d.label}
              </Pill>
            ))}
          </div>
          {customNoDays && (
            <p className="mt-2" style={{ fontSize: '12.5px', color: 'var(--accent)' }}>
              Pick at least one day.
            </p>
          )}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <FieldLabel>Time</FieldLabel>
          <Input
            type="time"
            value={time}
            onChange={(e) => onTime(e.target.value)}
            className="tnum"
            aria-label="Send time"
          />
        </div>
        <div>
          <FieldLabel>Timezone</FieldLabel>
          <div
            className="flex h-11 items-center rounded-[11px] px-3.5"
            style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-card)' }}
          >
            <span style={{ fontSize: '14px', color: 'var(--ink)' }}>{timezone}</span>
            {abbrev && (
              <span className="ml-2 font-mono" style={{ fontSize: '12px', color: 'var(--ink3)' }}>
                · {abbrev}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <FieldLabel>How far back to look each time</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {RECENCY.map((r) => (
            <Pill key={r.value} selected={recencyWindow === r.value} onClick={() => onRecency(r.value)}>
              {r.label}
            </Pill>
          ))}
        </div>
      </div>

      <StepFooter>
        <Button variant="ghost" size="lg" onClick={onBack}>
          Back
        </Button>
        <Button
          variant="primary"
          size="lg"
          onClick={onNext}
          disabled={customNoDays}
          disabledReason="Pick at least one day for a specific-days schedule."
          className="flex-1"
        >
          {nextLabel}
          <ArrowRight />
        </Button>
      </StepFooter>
    </div>
  )
}
