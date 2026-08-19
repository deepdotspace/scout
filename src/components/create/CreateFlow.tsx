/**
 * CreateFlow: the 6-step single-column stepper shared by New and Edit.
 *
 * Create mode runs all six steps (Describe, Scope, Voice, Rhythm, Boundaries,
 * Review). Edit mode reuses the middle four (Scope, Voice, Rhythm, Boundaries),
 * prefilled from the record, and the last step saves in place. This component
 * owns ALL the real wiring that v1's SetupForm owned: the /api/scouts-read scope
 * sharpening, the create/put mutation, the schedule math (computeNextSendAt), and
 * the send-now kickoff (generateIssue). Only the UI changed.
 *
 * Under ?demo=1 the scope step shows a canned sharpened scope and the create CTAs
 * are no-ops that toast, so the flow screenshots with no auth or DB.
 */

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutations } from 'deepspace'
import { StepChrome } from './StepChrome'
import { useDebouncedValue } from './useDebouncedValue'
import { StepDescribe } from './StepDescribe'
import { StepScope } from './StepScope'
import { StepVoice } from './StepVoice'
import { StepRhythm } from './StepRhythm'
import { StepBoundaries } from './StepBoundaries'
import { StepReview, type ReviewState } from './StepReview'
import { useScoutToast } from '../scout/ScoutToast'
import { DEFAULT_VOICE_PRESET } from '../../personas'
import type { VoicePreset } from '../../personas'
import { scoutsRead, generateIssue } from '../../lib/scout-api'
import { computeNextSendAt } from '../../lib/schedule'
import { parseDomainList } from '../../lib/domains'
import { isDemo } from '../../lib/demo'
import type { ScoutsRead } from '../../lib/ai'
import type { Frequency, Newsletter, RecencyWindow } from '../../lib/types'

const TOTAL = 6

/** A canned read for ?demo=1, matching the design's scope screen (shot 12). */
const DEMO_READ: ScoutsRead = {
  scope:
    'New releases and primary sources, the announcement, the paper, the filing itself, not the recap of it. The one or two things that genuinely changed, with a clear reason they matter to you.',
  angle: 'Signal over noise, what actually shipped',
  exampleSources: ['the labs own posts', 'arXiv', 'the filings'],
  assumptions: [],
}

/** The detected IANA zone, with a UTC fallback for the rare engine that hides it. */
function detectedTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/**
 * A short, friendly default name from a topic. Drops common lead-ins and caps to
 * a few words at a word boundary, so the rail and email subject stay short.
 */
function titleFromTopic(topic: string): string {
  let t = topic.trim().replace(/\s+/g, ' ')
  if (!t) return ''
  t = t.replace(
    /^(what(?:'s| is)? (?:new|happening|going on)(?: in| with| on)?|the latest (?:on|in|from)|news (?:on|about|from)|updates? (?:on|about)|anything (?:new |about )?(?:on|in|with)?|keep me (?:up to date|posted|current) on|stay on top of|track|follow|about)\s+/i,
    '',
  )
  const words = t.split(' ').filter(Boolean)
  if (words.length > 5) t = words.slice(0, 5).join(' ')
  t = t.replace(/[.,;:\s]+$/, '')
  if (!t) return ''
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export function CreateFlow({
  mode,
  initialTopic = '',
  initial,
  recordId,
  onCancel,
}: {
  mode: 'create' | 'edit'
  initialTopic?: string
  initial?: Partial<Newsletter>
  recordId?: string
  onCancel: () => void
}) {
  const navigate = useNavigate()
  const { showToast } = useScoutToast()
  const isEdit = mode === 'edit'
  const demo = isDemo()
  const { create, put } = useMutations<Newsletter>('newsletters')

  // In edit mode the four middle steps map to indices 0..3. In create mode the
  // six steps map to indices 0..5. The step component shows the true 1..6 number.
  const [step, setStep] = useState(0)

  // Topic + scope ------------------------------------------------------------
  const [topic, setTopic] = useState(initial?.topicRaw || initialTopic)
  const [read, setRead] = useState<ScoutsRead | null>(
    isEdit && (initial?.scope || initial?.angle)
      ? { scope: initial?.scope || '', angle: initial?.angle || '', exampleSources: [], assumptions: [] }
      : null,
  )
  const [readStatus, setReadStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [readError, setReadError] = useState('')
  const [scope, setScope] = useState(initial?.scope || '')
  const [angle, setAngle] = useState(initial?.angle || '')
  const [title, setTitle] = useState(initial?.title || '')

  // The topic the current `read` was derived from. Seeded from the initial topic
  // so re-entering the Scope step with an unchanged topic never auto re-reads and
  // wipes a hand-edited scope. Updated whenever a read lands (sharpen or re-read).
  const lastReadTopic = useRef((initial?.topicRaw || initialTopic).trim())
  // Monotonic token so an out-of-order scout's-read can never overwrite a newer
  // one: each read captures its id and only applies if it is still the latest.
  const readSeq = useRef(0)

  // Voice --------------------------------------------------------------------
  const [voicePreset, setVoicePreset] = useState<VoicePreset>(
    (initial?.voicePreset as VoicePreset) || DEFAULT_VOICE_PRESET,
  )
  const [voiceCustomPrompt, setVoiceCustomPrompt] = useState(initial?.voiceCustomPrompt || '')

  // Schedule -----------------------------------------------------------------
  const [frequency, setFrequency] = useState<Frequency>(initial?.frequency || 'weekly')
  const [days, setDays] = useState<string[]>(initial?.days || ['mon'])
  const [time, setTime] = useState(initial?.time || '08:00')
  const [timezone] = useState(initial?.timezone || detectedTimezone())
  const [recencyWindow, setRecencyWindow] = useState<RecencyWindow>(initial?.recencyWindow || '7d')

  // Boundaries ---------------------------------------------------------------
  const [location, setLocation] = useState(initial?.location || '')
  const [preferredDomains, setPreferredDomains] = useState((initial?.preferredDomains || []).join(', '))
  const [blockedDomains, setBlockedDomains] = useState((initial?.blockedDomains || []).join(', '))

  // Submit -------------------------------------------------------------------
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  /** Adopt a fresh read for `sourceTopic`, remembering the topic it came from so
   *  the auto re-read knows the scope now belongs to this topic. The default title
   *  only fills when empty, so a title the user typed is never clobbered. */
  function applyRead(result: ScoutsRead, sourceTopic: string) {
    lastReadTopic.current = sourceTopic.trim()
    setRead(result)
    setScope(result.scope)
    setAngle(result.angle)
    if (!title) setTitle(titleFromTopic(sourceTopic) || titleFromTopic(result.scope))
  }

  /** Run Scout's read, then advance to the Scope step. The sharpen entry point. */
  async function sharpen() {
    const t = topic.trim()
    if (!t) return
    if (demo) {
      applyRead(DEMO_READ, topic)
      if (!title) setTitle('Keep Me Current')
      setStep(1)
      return
    }
    const seq = ++readSeq.current
    setReadStatus('loading')
    setReadError('')
    setStep(1)
    try {
      const result = await scoutsRead(t)
      if (seq !== readSeq.current) return
      applyRead(result, t)
      setReadStatus('idle')
    } catch (err) {
      if (seq !== readSeq.current) return
      setReadError(err instanceof Error ? err.message : 'Scout could not read that topic.')
      setReadStatus('error')
    }
  }

  /** Re-read the topic in place (no step change). Used on the Scope step by both
   *  the manual retry and the debounced auto re-read when the topic has changed.
   *  Replaces scope, angle, and the read: the old scope belonged to the old topic. */
  async function reread() {
    const t = topic.trim()
    if (!t) return
    if (demo) {
      applyRead(DEMO_READ, topic)
      return
    }
    const seq = ++readSeq.current
    setReadStatus('loading')
    setReadError('')
    try {
      const result = await scoutsRead(t)
      if (seq !== readSeq.current) return
      applyRead(result, t)
      setReadStatus('idle')
    } catch (err) {
      if (seq !== readSeq.current) return
      setReadError(err instanceof Error ? err.message : 'Scout could not read that topic.')
      setReadStatus('error')
    }
  }

  // Auto re-read when the topic settles on the Scope step. Fires ~800ms after the
  // last keystroke, and only when the topic actually differs from the one the
  // current read came from, so it never re-bills on an unchanged topic or wipes a
  // hand-edited scope. Demo stays inert (the canned read needs no call).
  const debouncedTopic = useDebouncedValue(topic, 800)
  useEffect(() => {
    if (demo) return
    const t = debouncedTopic.trim()
    if (!t || t === lastReadTopic.current) return
    void reread()
    // reread reads the latest topic + handles its own state; the trimmed
    // debounced topic and the last-read guard are the real dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedTopic, demo])

  function toggleDay(key: string) {
    setDays((prev) => (prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]))
  }

  function buildPayload(): Partial<Newsletter> {
    const cleanDays = frequency === 'custom' || frequency === 'weekly' ? days : []
    const nextSendAt = computeNextSendAt({ frequency, days: cleanDays, time, timezone }, Date.now()) ?? undefined
    return {
      title: title.trim() || titleFromTopic(scope) || 'Untitled newsletter',
      topicRaw: topic.trim(),
      scope: scope.trim(),
      angle: angle.trim(),
      voicePreset,
      voiceCustomPrompt: voicePreset === 'custom' ? voiceCustomPrompt.trim() : '',
      frequency,
      days: cleanDays,
      time,
      timezone,
      recencyWindow,
      location: location.trim(),
      preferredDomains: parseDomainList(preferredDomains),
      blockedDomains: parseDomainList(blockedDomains),
      nextSendAt,
    }
  }

  /** Save edits in place and return to the newsletter. */
  async function save() {
    if (!recordId || !scope.trim()) return
    if (demo) {
      showToast('Changes saved.')
      return
    }
    setSubmitting(true)
    setSubmitError('')
    try {
      await put(recordId, buildPayload())
      navigate(`/n/${recordId}`)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not save the newsletter.')
      setSubmitting(false)
    }
  }

  /** Create the newsletter. With sendNow, kick off the first issue and land on
   *  the field; otherwise return home. A failed kickoff still lands on the saved
   *  newsletter where the first issue can be sent again. */
  async function createNewsletter(sendNow: boolean) {
    if (!scope.trim()) return
    if (demo) {
      showToast(sendNow ? 'Laila is heading out now.' : 'Newsletter created.')
      return
    }
    setSubmitting(true)
    setSubmitError('')
    try {
      const id = await create({
        ...buildPayload(),
        status: 'active',
        preferences: [],
        lastRunStatus: 'idle',
      } as Newsletter)
      if (sendNow) {
        const issueId = await generateIssue(id).then((r) => r.issueId).catch(() => null)
        if (issueId) {
          navigate(`/n/${id}/run?issue=${issueId}`)
          return
        }
      }
      navigate(`/n/${id}`)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not save the newsletter.')
      setSubmitting(false)
    }
  }

  const reviewState: ReviewState = {
    title,
    scope,
    voicePreset,
    voiceCustomPrompt,
    frequency,
    days,
    time,
    timezone,
    recencyWindow,
    location,
    preferredDomains,
    blockedDomains,
  }

  // The dot index tracks the true position across both flows (so create shows 6
  // dots advancing 0..5, edit shows the same chrome but starts at the Scope dot).
  const dotIndex = isEdit ? step + 1 : step

  return (
    <StepChrome total={TOTAL} current={dotIndex} onCancel={onCancel}>
      {isEdit ? (
        <EditSteps
          step={step}
          setStep={setStep}
          read={read}
          readStatus={readStatus}
          readError={readError}
          onRetry={reread}
          topic={topic}
          setTopic={setTopic}
          title={title}
          setTitle={setTitle}
          scope={scope}
          setScope={setScope}
          voicePreset={voicePreset}
          setVoicePreset={setVoicePreset}
          voiceCustomPrompt={voiceCustomPrompt}
          setVoiceCustomPrompt={setVoiceCustomPrompt}
          frequency={frequency}
          setFrequency={setFrequency}
          days={days}
          toggleDay={toggleDay}
          time={time}
          setTime={setTime}
          timezone={timezone}
          recencyWindow={recencyWindow}
          setRecencyWindow={setRecencyWindow}
          location={location}
          setLocation={setLocation}
          preferredDomains={preferredDomains}
          setPreferredDomains={setPreferredDomains}
          blockedDomains={blockedDomains}
          setBlockedDomains={setBlockedDomains}
          submitting={submitting}
          onSave={save}
        />
      ) : (
        <>
          {step === 0 && (
            <StepDescribe
              total={TOTAL}
              topic={topic}
              onTopic={setTopic}
              onNext={sharpen}
              loading={readStatus === 'loading'}
            />
          )}
          {step === 1 && (
            <StepScope
              total={TOTAL}
              stepNumber={2}
              read={read}
              status={readStatus}
              error={readError}
              topic={topic}
              onTopic={setTopic}
              title={title}
              onTitle={setTitle}
              scope={scope}
              onScope={setScope}
              onRetry={reread}
              onBack={() => setStep(0)}
              onNext={() => setStep(2)}
              nextLabel="Looks right, pick a voice"
            />
          )}
          {step === 2 && (
            <StepVoice
              total={TOTAL}
              stepNumber={3}
              preset={voicePreset}
              onPreset={setVoicePreset}
              customPrompt={voiceCustomPrompt}
              onCustomPrompt={setVoiceCustomPrompt}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
              nextLabel="Set the rhythm"
            />
          )}
          {step === 3 && (
            <StepRhythm
              total={TOTAL}
              stepNumber={4}
              frequency={frequency}
              onFrequency={setFrequency}
              days={days}
              onToggleDay={toggleDay}
              time={time}
              onTime={setTime}
              timezone={timezone}
              recencyWindow={recencyWindow}
              onRecency={setRecencyWindow}
              onBack={() => setStep(2)}
              onNext={() => setStep(4)}
              nextLabel="Sources and place"
            />
          )}
          {step === 4 && (
            <StepBoundaries
              total={TOTAL}
              stepNumber={5}
              location={location}
              onLocation={setLocation}
              preferredDomains={preferredDomains}
              onPreferredDomains={setPreferredDomains}
              blockedDomains={blockedDomains}
              onBlockedDomains={setBlockedDomains}
              onBack={() => setStep(3)}
              onNext={() => setStep(5)}
              nextLabel="Review"
            />
          )}
          {step === 5 && (
            <StepReview
              total={TOTAL}
              state={reviewState}
              submitting={submitting}
              error={submitError}
              onBack={() => setStep(4)}
              onCreateAndSend={() => createNewsletter(true)}
              onCreateLater={() => createNewsletter(false)}
            />
          )}
        </>
      )}
    </StepChrome>
  )
}

/**
 * The edit flow reuses Scope, Voice, Rhythm, Boundaries (steps 0..3 here, shown
 * with their create-flow step numbers 2..5 so the chrome reads consistently). The
 * final Boundaries step saves rather than advancing to a Review.
 */
function EditSteps(props: {
  step: number
  setStep: (n: number) => void
  read: ScoutsRead | null
  readStatus: 'idle' | 'loading' | 'error'
  readError: string
  onRetry: () => void
  topic: string
  setTopic: (v: string) => void
  title: string
  setTitle: (v: string) => void
  scope: string
  setScope: (v: string) => void
  voicePreset: VoicePreset
  setVoicePreset: (v: VoicePreset) => void
  voiceCustomPrompt: string
  setVoiceCustomPrompt: (v: string) => void
  frequency: Frequency
  setFrequency: (v: Frequency) => void
  days: string[]
  toggleDay: (key: string) => void
  time: string
  setTime: (v: string) => void
  timezone: string
  recencyWindow: RecencyWindow
  setRecencyWindow: (v: RecencyWindow) => void
  location: string
  setLocation: (v: string) => void
  preferredDomains: string
  setPreferredDomains: (v: string) => void
  blockedDomains: string
  setBlockedDomains: (v: string) => void
  submitting: boolean
  onSave: () => void
}) {
  const { step, setStep } = props
  return (
    <>
      {step === 0 && (
        <StepScope
          total={TOTAL}
          stepNumber={2}
          read={props.read}
          status={props.readStatus}
          error={props.readError}
          topic={props.topic}
          onTopic={props.setTopic}
          title={props.title}
          onTitle={props.setTitle}
          scope={props.scope}
          onScope={props.setScope}
          onRetry={props.onRetry}
          onNext={() => setStep(1)}
          nextLabel="Voice"
        />
      )}
      {step === 1 && (
        <StepVoice
          total={TOTAL}
          stepNumber={3}
          preset={props.voicePreset}
          onPreset={props.setVoicePreset}
          customPrompt={props.voiceCustomPrompt}
          onCustomPrompt={props.setVoiceCustomPrompt}
          onBack={() => setStep(0)}
          onNext={() => setStep(2)}
          nextLabel="Rhythm"
        />
      )}
      {step === 2 && (
        <StepRhythm
          total={TOTAL}
          stepNumber={4}
          frequency={props.frequency}
          onFrequency={props.setFrequency}
          days={props.days}
          onToggleDay={props.toggleDay}
          time={props.time}
          onTime={props.setTime}
          timezone={props.timezone}
          recencyWindow={props.recencyWindow}
          onRecency={props.setRecencyWindow}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
          nextLabel="Boundaries"
        />
      )}
      {step === 3 && (
        <StepBoundaries
          total={TOTAL}
          stepNumber={5}
          location={props.location}
          onLocation={props.setLocation}
          preferredDomains={props.preferredDomains}
          onPreferredDomains={props.setPreferredDomains}
          blockedDomains={props.blockedDomains}
          onBlockedDomains={props.setBlockedDomains}
          onBack={() => setStep(2)}
          onNext={props.onSave}
          nextLabel={props.submitting ? 'Saving...' : 'Save changes'}
        />
      )}
    </>
  )
}
