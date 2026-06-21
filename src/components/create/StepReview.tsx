/**
 * Step 5, Review (shot 16-create-review). One elevated summary card of label and
 * value rows (Name / Scope / Voice / Rhythm / Place / Sources), then two CTAs:
 * "Create and send Laila out now" (accent, creates and kicks off the first issue)
 * and "Create, I'll wait for the schedule" (creates and returns home). The values
 * are read from the flow's real state; no copy is invented.
 */

import { Play } from 'lucide-react'
import { Button } from '../scout/Button'
import { Card } from '../scout/Card'
import { InlineStatus } from '../scout/Status'
import { StepKicker, StepHeading } from './StepChrome'
import { voiceLabel } from '../../personas'
import type { VoicePreset } from '../../personas'
import type { Frequency, RecencyWindow } from '../../lib/types'

const FREQ_LABEL: Record<Frequency, string> = {
  daily: 'Every day',
  weekdays: 'Weekdays',
  weekly: 'Once a week',
  custom: 'Specific days',
}

const RECENCY_LABEL: Record<RecencyWindow, string> = {
  '24h': 'looks back last 24 hours',
  '3d': 'looks back last few days',
  '7d': 'looks back last week',
  '30d': 'looks back last month',
}

const DAY_LABEL: Record<string, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
}

export interface ReviewState {
  title: string
  scope: string
  voicePreset: VoicePreset
  voiceCustomPrompt: string
  frequency: Frequency
  days: string[]
  time: string
  timezone: string
  recencyWindow: RecencyWindow
  location: string
  preferredDomains: string
  blockedDomains: string
}

function rhythmLine(s: ReviewState): string {
  const parts: string[] = [FREQ_LABEL[s.frequency]]
  // Only "Specific days" exposes day toggles in the Rhythm step, so only it names
  // the days here. Weekly resolves to its default day silently in the schedule.
  if (s.frequency === 'custom' && s.days.length > 0) {
    parts.push(`on ${s.days.map((d) => DAY_LABEL[d] ?? d).join(', ')}`)
  }
  parts.push(`at ${s.time}`)
  parts.push(s.timezone)
  return `${parts.join(' · ')} · ${RECENCY_LABEL[s.recencyWindow]}`
}

function sourcesLine(s: ReviewState): string {
  const favor = s.preferredDomains.trim()
  const block = s.blockedDomains.trim()
  if (!favor && !block) return 'No preference, the whole open web'
  const bits: string[] = []
  if (favor) bits.push(`Favor ${favor}`)
  if (block) bits.push(`Block ${block}`)
  return bits.join(' · ')
}

export function StepReview({
  total,
  state,
  submitting,
  error,
  onBack,
  onCreateAndSend,
  onCreateLater,
}: {
  total: number
  state: ReviewState
  submitting: boolean
  error: string
  onBack: () => void
  onCreateAndSend: () => void
  onCreateLater: () => void
}) {
  const voice = state.voicePreset === 'custom' ? 'Your own voice' : voiceLabel(state.voicePreset)
  const place = state.location.trim() || 'No location, the whole open web'

  const rows: Array<{ label: string; value: string }> = [
    { label: 'Name', value: state.title.trim() || 'Untitled newsletter' },
    { label: 'Scope', value: state.scope.trim() },
    { label: 'Voice', value: voice },
    { label: 'Rhythm', value: rhythmLine(state) },
    { label: 'Place', value: place },
    { label: 'Sources', value: sourcesLine(state) },
  ]

  return (
    <div>
      <StepKicker n={total} total={total} label="Review" />
      <StepHeading>Ready when you are.</StepHeading>

      <Card elevated className="mt-6 overflow-hidden">
        {rows.map((r, i) => (
          <div
            key={r.label}
            className="grid grid-cols-[88px_1fr] gap-4 px-6 py-4"
            style={i > 0 ? { borderTop: '1px solid var(--line)' } : undefined}
          >
            <span
              className="font-mono font-semibold uppercase"
              style={{ fontSize: '10px', letterSpacing: '0.14em', color: 'var(--ink3)', paddingTop: '3px' }}
            >
              {r.label}
            </span>
            <span style={{ fontSize: '14.5px', lineHeight: 1.5, color: 'var(--ink)' }}>{r.value}</span>
          </div>
        ))}
      </Card>

      {error && (
        <div className="mt-5">
          <InlineStatus tone="danger">{error}</InlineStatus>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-2.5">
        <Button variant="primary" size="lg" onClick={onCreateAndSend} loading={submitting} className="w-full">
          {!submitting && <Play className="size-[14px]" style={{ fill: 'currentColor' }} />}
          Create and send Laila out now
        </Button>
        <Button variant="ghost" size="lg" onClick={onCreateLater} disabled={submitting} className="w-full">
          Create, I will wait for the schedule
        </Button>
      </div>

      <div className="mt-4">
        <Button variant="ghost" size="sm" onClick={onBack} disabled={submitting}>
          Back
        </Button>
      </div>
    </div>
  )
}
