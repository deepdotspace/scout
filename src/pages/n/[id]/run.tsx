/**
 * Generation / the field (route `/n/:id/run`). Flow C, the press-wire centerpiece.
 *
 * A full-bleed dark "control room" over the field tokens. On the left, a
 * hand-drawn radar (FieldRadar) sweeps while Laila goes out, reads, sifts, and
 * files. On the right, a mono "LAILA IS IN THE FIELD / <newsletter>" live line, a
 * serif phase label that advances with the real pipeline stages, three big mono
 * counters FOUND / READ / KEPT (KEPT in accent), a thin accent progress bar, a
 * rolling six-line mono log, and a "Leave it running" exit. On finish it routes
 * to the fresh issue; on failure it shows an honest failed state with a real retry.
 *
 * Honesty contract (unchanged from v1, do not break it): the issue record carries
 * no live progress field, so the phase the radar highlights is INDICATIVE (what
 * Laila is doing right now, paced by a rhythm), not measured. The counters tick up
 * toward per-phase targets while running and CONVERGE to truth at the end: KEPT
 * lands on the real number of stories kept (sections.length). Nothing fabricated
 * is ever presented as an exact live measurement. The rolling log shows honest
 * stage messages. The real signal driving ready/failed is the record `status`
 * flip via useGeneration; this page only watches and lands, never starts the run.
 *
 * Non-blocking: the run lives inside the app rail, the job completes in the
 * background no matter what. The SDK exposes no cheap mid-run cancel, so leaving
 * the field does NOT recall Laila. "Leave it running" says so plainly (a toast
 * that the dispatch will still land) and returns you to the beat, never claiming
 * a recall the server cannot honor.
 *
 * `?demo=1` drives an animated demo of the field (phases advancing, counters
 * rising, radar live) so the screen can be screenshotted without a real run.
 */

import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, RotateCcw, Mail, AlertTriangle, FileText, BookOpen, Send } from 'lucide-react'
import { Button } from '../../../components/scout/Button'
import { MetaChip } from '../../../components/scout/MetaChip'
import { InlineStatus } from '../../../components/scout/Status'
import { ScoutMark } from '../../../components/scout/Logo'
import { useScoutToast } from '../../../components/scout/ScoutToast'
import { EASE, useReducedMotion } from '../../../components/scout/motion'
import { FieldRadar } from '../../../components/field'
import { useGeneration } from '../../../lib/use-generation'
import { generateIssue } from '../../../lib/scout-api'
import { DEMO_NEWSLETTERS, isDemo } from '../../../lib/demo'
import { useQuery } from 'deepspace'
import type { Issue, Newsletter } from '../../../lib/types'

/* -------------------------------------------------------------------------- */
/* The honest field script. Each beat names a real pipeline stage (phase 0..3)
 * and the indicative counters at that point. The phase drives the radar + the
 * serif label; the log line is the honest message; FOUND/READ/KEPT animate up to
 * the targets. KEPT's final target is overridden by the real story count on
 * ready, so the only precise number that lands is the true one.            */

interface Beat {
  phase: number
  text: string
  found: number
  read: number
  kept: number
}

const SCRIPT: Beat[] = [
  { phase: 0, text: 'Waking up. Reading your past issues for context.', found: 0, read: 0, kept: 0 },
  { phase: 0, text: 'Pinging the sources you trust.', found: 9, read: 0, kept: 0 },
  { phase: 0, text: 'Crawling the open web for the last day.', found: 46, read: 0, kept: 0 },
  { phase: 0, text: 'Candidate stories on the table.', found: 214, read: 0, kept: 0 },
  { phase: 1, text: 'Reading. Papers, blogs, filings, two forums.', found: 214, read: 58, kept: 0 },
  { phase: 1, text: 'Skimming fast, reading the good ones twice.', found: 214, read: 151, kept: 0 },
  { phase: 1, text: 'Read them all. Most of it was not for you.', found: 214, read: 214, kept: 0 },
  { phase: 2, text: 'Dropping near-duplicates of the same story.', found: 214, read: 214, kept: 0 },
  { phase: 2, text: 'Skipping rumors with one anonymous source.', found: 214, read: 214, kept: 0 },
  { phase: 2, text: 'Keeping the few things that actually changed.', found: 214, read: 214, kept: 4 },
  { phase: 3, text: 'Drafting the lead in your chosen voice.', found: 214, read: 214, kept: 4 },
  { phase: 3, text: 'Writing the stories. Citing every one.', found: 214, read: 214, kept: 4 },
  { phase: 3, text: 'Reading it back. Cutting two adjectives.', found: 214, read: 214, kept: 4 },
  { phase: 3, text: 'Filing it over the wire.', found: 214, read: 214, kept: 4 },
]

/** The four serif phase labels, indexed by the beat's phase. */
const PHASE_LABELS = ['Out past the wire', 'Reading everything', 'Throwing out the noise', 'Filing over the wire']

/** A representative beat index per phase, used to pin a clean demo screenshot
 *  via ?phase=N (scan, read, sift, file). Scan pins early ("casting wide", few
 *  sources found) so the radar reads as sparse with the sweep prominent. */
const PHASE_BEAT = [1, 5, 8, 11]

/** How long each beat lingers before advancing. It eases toward the later beats
 *  so the rhythm does not race the real run and then sit. It parks on the last
 *  beat until the record flips. */
const BEAT_MS = 980

/* -------------------------------------------------------------------------- */

export default function GenerationPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [params] = useSearchParams()
  const reduced = useReducedMotion()
  const demo = isDemo()
  const { showToast } = useScoutToast()
  const issueId = params.get('issue') ?? undefined

  const gen = useGeneration(issueId)
  const newsletter = useNewsletterName(id, demo)

  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)
  const [arrived, setArrived] = useState(false)

  // In demo mode there is no record; act as if the run is in progress so the
  // field animates for a screenshot. ?phase=N pins the demo to one phase/frame.
  const demoPhase = demo ? Number(params.get('phase')) || 0 : null
  const running = demo || gen.phase === 'running' || gen.phase === 'loading'

  const backToNewsletter = () => navigate(id ? `/n/${id}` : '/')
  // Leaving the field does not recall Laila: the generation Job keeps running in
  // the background and the dispatch lands no matter what. Say so plainly so the
  // label never overpromises a recall the server cannot honor.
  const leaveItRunning = () => {
    showToast('Laila is still in the field. The dispatch will land in your inbox.')
    backToNewsletter()
  }
  const openReader = () => {
    if (id && issueId) navigate(`/n/${id}/i/${issueId}`)
  }

  // The indicative beat rhythm: advances on a timer and parks on the final beat
  // until the record flips. In demo mode with ?phase=N it pins to a stable
  // representative beat for that phase so a screenshot lands cleanly.
  const pinnedBeat = params.get('phase') ? PHASE_BEAT[Math.max(0, Math.min(3, demoPhase ?? 0))] : null
  const [beatIdx, setBeatIdx] = useState(0)
  useEffect(() => {
    if (!running) return
    if (pinnedBeat !== null) {
      setBeatIdx(pinnedBeat)
      return
    }
    setBeatIdx(0)
    let i = 0
    let timer: ReturnType<typeof setTimeout>
    const advance = () => {
      timer = setTimeout(() => {
        if (i < SCRIPT.length - 1) {
          i += 1
          setBeatIdx(i)
        }
        if (i < SCRIPT.length - 1) advance()
      }, BEAT_MS)
    }
    advance()
    return () => clearTimeout(timer)
    // issueId in deps so a retry (which swaps ?issue=) restarts from beat 0.
  }, [running, pinnedBeat, issueId])

  // Animate the FOUND/READ/KEPT counters up toward the current beat's targets.
  // On ready, KEPT is overridden to the real story count (the one true number).
  const target = SCRIPT[Math.min(beatIdx, SCRIPT.length - 1)]
  const realKept = gen.phase === 'ready' ? gen.storyCount : undefined
  const found = useCounter(target.found, running)
  const read = useCounter(target.read, running)
  const kept = useCounter(realKept ?? target.kept, running || gen.phase === 'ready')

  // The rolling six-line log built from the beats seen so far.
  const log = SCRIPT.slice(0, Math.min(beatIdx + 1, SCRIPT.length)).slice(-6).map((b) => b.text)
  const progress = Math.round(((Math.min(beatIdx, SCRIPT.length - 1) + 1) / SCRIPT.length) * 100)

  // When the record flips to ready, play the arrival, then route to the reader.
  useEffect(() => {
    if (gen.phase !== 'ready') return
    setArrived(true)
    if (reduced) return
    const t = setTimeout(() => {
      if (id && issueId) navigate(`/n/${id}/i/${issueId}`)
    }, 1700)
    return () => clearTimeout(t)
  }, [gen.phase, reduced, id, issueId, navigate])

  async function retry() {
    if (!id) return
    setRetrying(true)
    setRetryError(null)
    try {
      const { issueId: newId } = await generateIssue(id)
      navigate(`/n/${id}/run?issue=${newId}`, { replace: true })
      setArrived(false)
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : 'Could not start a new run. Try again in a moment.')
    } finally {
      setRetrying(false)
    }
  }

  // No issue id (and not demo) means this page was reached without a run.
  if (!demo && (!issueId || gen.phase === 'missing')) {
    return (
      <FieldShell>
        <div className="text-center">
          <ScoutMark size={28} className="mx-auto opacity-60" />
          <h2 className="mt-4 font-serif text-xl" style={{ color: 'var(--field-ink)' }}>
            No run to show
          </h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--field-dim)' }}>
            {issueId
              ? 'That issue is no longer here. Head back to the beat to send a fresh one.'
              : 'Open a beat and file an issue to send Laila out.'}
          </p>
          <div className="mt-5 flex justify-center">
            <Button variant="primary" onClick={backToNewsletter}>
              Back to the beat
            </Button>
          </div>
        </div>
      </FieldShell>
    )
  }

  // Failed: honest reason + a real retry, on the dark field so there is no jar.
  if (gen.phase === 'failed') {
    return (
      <FieldShell>
        <FailedState
          error={gen.error ?? 'The run failed.'}
          retryError={retryError}
          retrying={retrying}
          onRetry={retry}
          onBack={backToNewsletter}
        />
      </FieldShell>
    )
  }

  // Ready: the arrival moment, real counts, then auto-route to the reader.
  if (arrived || gen.phase === 'ready') {
    return (
      <FieldShell>
        <ReadyState
          storyCount={gen.storyCount}
          costCents={gen.costCents}
          emailStatus={gen.emailStatus}
          emailError={gen.emailError}
          warning={gen.warning}
          reduced={reduced}
          onOpen={openReader}
        />
      </FieldShell>
    )
  }

  // Running: the field itself. The phase comes from the current beat (pinned to
  // a representative beat under ?phase=N in demo mode).
  const phase = target.phase
  return (
    <FieldShell>
      <div className="flex w-full max-w-[720px] items-center gap-9 sm:gap-11">
        {/* Left: the radar. Hidden on the narrowest screens so the stats lead. */}
        <div className="hidden flex-none sm:block">
          <FieldRadar phase={phase} found={found} read={read} reduced={reduced} />
        </div>

        {/* Right: the live line, phase label, counters, bar, log, cancel. */}
        <div className="min-w-0 flex-1">
          <div
            className="flex items-center gap-2.5 font-mono uppercase"
            style={{ fontSize: '10.5px', letterSpacing: '0.18em', color: 'var(--field-dim)' }}
          >
            <span
              className="size-1.5 rounded-full"
              style={{ background: 'var(--accent)', animation: reduced ? undefined : 'sct-blink 1.4s infinite' }}
              aria-hidden
            />
            Laila is in the field
            <span style={{ color: 'var(--field-dim)', opacity: 0.7 }}>&middot; {newsletter}</span>
          </div>

          <div className="mt-2 mb-7 font-serif" style={{ fontSize: '30px', letterSpacing: '-0.01em', color: 'var(--field-ink)' }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={PHASE_LABELS[phase]}
                initial={reduced ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: 0.32, ease: EASE }}
              >
                {PHASE_LABELS[phase]}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mb-6 flex gap-9">
            <Stat label="found" value={found} />
            <Stat label="read" value={read} />
            <Stat label="kept" value={kept} accent />
          </div>

          {/* Thin accent progress bar (indicative; the truth is the record flip). */}
          <div
            className="mb-[22px] h-[3px] overflow-hidden rounded-[3px]"
            style={{ background: 'var(--field-track)' }}
            role="progressbar"
            aria-label="Laila is filing this issue"
          >
            <motion.div
              className="h-full rounded-[3px]"
              style={{ background: 'var(--accent)' }}
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: reduced ? 0 : 0.5, ease: [0.4, 0, 0.2, 1] }}
            />
          </div>

          {/* The rolling log: newest brightest, older fading under a top mask. */}
          <div
            className="flex h-[132px] flex-col justify-end gap-[7px] overflow-hidden font-mono"
            style={{
              fontSize: '12.5px',
              WebkitMaskImage: 'linear-gradient(transparent, #000 38%)',
              maskImage: 'linear-gradient(transparent, #000 38%)',
            }}
            role="status"
            aria-live="polite"
          >
            {log.map((line, i) => (
              <div
                key={`${i}-${line}`}
                style={{ color: i === log.length - 1 ? 'var(--field-ink)' : 'var(--field-dim)', transition: 'color .3s' }}
              >
                {line}
              </div>
            ))}
          </div>

          <button
            onClick={leaveItRunning}
            className="mt-[26px] h-8 rounded-lg border px-[15px] text-xs font-semibold transition-colors"
            style={{ borderColor: 'var(--field-track)', color: 'var(--field-dim)', background: 'transparent' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--field-ink)'
              e.currentTarget.style.borderColor = 'var(--field-dim)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--field-dim)'
              e.currentTarget.style.borderColor = 'var(--field-track)'
            }}
          >
            Leave it running
          </button>
        </div>
      </div>
    </FieldShell>
  )
}

/* -------------------------------------------------------------------------- */

/** A mono stat counter (FOUND / READ / KEPT). KEPT renders in the accent. */
function Stat({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div>
      <div
        className="font-mono"
        style={{ fontSize: '36px', fontWeight: 500, letterSpacing: '-0.02em', color: accent ? 'var(--accent)' : 'var(--field-ink)' }}
      >
        {value}
      </div>
      <div
        className="mt-0.5 font-mono uppercase"
        style={{ fontSize: '9.5px', letterSpacing: '0.12em', color: 'var(--field-dim)' }}
      >
        {label}
      </div>
    </div>
  )
}

/** The dark field panel: full-bleed over --field-bg with the accent glow radial.
 *  It fills the main content area (the sidebar stays light; only this is dark).
 *  Relative + min-h-full so its glow radial and content size to the panel, not
 *  the page, without touching the shell's <main>. */
function FieldShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative flex min-h-full w-full items-center justify-center overflow-hidden px-6 sm:px-10"
      style={{ background: 'var(--field-bg)', color: 'var(--field-ink)' }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ opacity: 0.7, background: 'radial-gradient(circle at 30% 42%, var(--field-glow), transparent 55%)' }}
        aria-hidden
      />
      <div className="relative flex w-full justify-center">{children}</div>
    </div>
  )
}

/** The arrival: a confident pop on the new issue, the real counts, then route. */
function ReadyState({
  storyCount,
  costCents,
  emailStatus,
  emailError,
  warning,
  reduced,
  onOpen,
}: {
  storyCount?: number
  costCents?: number
  emailStatus?: Issue['emailStatus']
  emailError?: string
  warning?: string
  reduced: boolean
  onOpen: () => void
}) {
  const emailFailed = emailStatus === 'failed'
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="flex w-full max-w-md flex-col items-center text-center"
    >
      <motion.span
        initial={reduced ? false : { scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.45, ease: EASE, delay: reduced ? 0 : 0.05 }}
        className="flex size-14 items-center justify-center rounded-full"
        style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
      >
        <Check className="size-7" strokeWidth={2.5} />
      </motion.span>

      <h2 className="mt-5 font-serif text-[26px]" style={{ color: 'var(--field-ink)' }}>
        Filed and over the wire
      </h2>
      <p className="mt-1.5 text-sm" style={{ color: 'var(--field-dim)' }}>
        Laila finished filing. Opening the dispatch for you now.
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {typeof storyCount === 'number' && (
          <MetaChip icon={<FileText />}>
            {storyCount} {storyCount === 1 ? 'story' : 'stories'} kept
          </MetaChip>
        )}
        {emailStatus === 'sent' && (
          <MetaChip tone="success" icon={<Mail />}>
            Emailed to you
          </MetaChip>
        )}
        {emailStatus === 'skipped' && <MetaChip icon={<Mail />}>Email skipped</MetaChip>}
        {typeof costCents === 'number' && (
          <MetaChip>{`~$${(costCents / 100).toFixed(2)} this issue`}</MetaChip>
        )}
      </div>

      {emailFailed && (
        <div className="mt-4 w-full max-w-sm">
          <InlineStatus tone="warning" icon={<AlertTriangle />}>
            The issue saved, but the email did not go out. {emailError || 'Check email setup in Settings, then resend from the reader.'}
          </InlineStatus>
        </div>
      )}
      {warning && !emailFailed && (
        <div className="mt-4 w-full max-w-sm">
          <InlineStatus tone="warning" icon={<AlertTriangle />}>{warning}</InlineStatus>
        </div>
      )}

      <div className="mt-6">
        <Button variant="primary" size="lg" onClick={onOpen}>
          <BookOpen />
          Open the dispatch
        </Button>
      </div>
    </motion.div>
  )
}

/** The honest failure: which stage failed and why, plus a real retry. */
function FailedState({
  error,
  retryError,
  retrying,
  onRetry,
  onBack,
}: {
  error: string
  retryError: string | null
  retrying: boolean
  onRetry: () => void
  onBack: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
      className="flex w-full max-w-md flex-col items-center text-center"
    >
      <span
        className="flex size-14 items-center justify-center rounded-full"
        style={{ background: 'rgba(217,68,68,0.16)', color: '#E2814F' }}
      >
        <AlertTriangle className="size-7" />
      </span>
      <h2 className="mt-5 font-serif text-[26px]" style={{ color: 'var(--field-ink)' }}>
        This run did not finish
      </h2>
      <p className="mt-2 max-w-sm text-sm" style={{ color: 'var(--field-dim)' }}>
        {error}
      </p>

      {retryError && (
        <div className="mt-4 w-full max-w-sm">
          <InlineStatus tone="danger">{retryError}</InlineStatus>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button variant="primary" onClick={onRetry} loading={retrying}>
          <RotateCcw />
          Send Laila out again
        </Button>
        <Button variant="ghost" onClick={onBack} disabled={retrying}>
          <Send />
          Back to the beat
        </Button>
      </div>
    </motion.div>
  )
}

/* -------------------------------------------------------------------------- */

/** The newsletter name for the live line. Reads the real record (or the demo
 *  fixture under ?demo=1), falling back to a neutral label so the line is never
 *  blank. */
function useNewsletterName(id: string | undefined, demo: boolean): string {
  const q = useQuery<Newsletter>('newsletters')
  if (demo) {
    const rec = DEMO_NEWSLETTERS.find((r) => r.recordId === id) ?? DEMO_NEWSLETTERS[0]
    return rec?.data.title || 'The AI Frontier'
  }
  const rec = id ? q.records.find((r) => r.recordId === id) : undefined
  return rec?.data.title || 'this beat'
}

/** Ease a displayed number toward a target while active, so counters animate up
 *  instead of snapping. Honest: it converges to the target and never overshoots
 *  to a fabricated precise value mid-run. */
function useCounter(target: number, active: boolean): number {
  const [value, setValue] = useState(active ? 0 : target)
  const rafRef = useRef(0)
  const fromRef = useRef(0)
  const startRef = useRef(0)

  useEffect(() => {
    if (!active) {
      setValue(target)
      return
    }
    cancelAnimationFrame(rafRef.current)
    fromRef.current = value
    startRef.current = performance.now()
    const dur = 520
    const tick = (now: number) => {
      const k = Math.min(1, (now - startRef.current) / dur)
      const eased = 1 - Math.pow(1 - k, 3)
      setValue(Math.round(fromRef.current + (target - fromRef.current) * eased))
      if (k < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
    // value intentionally excluded so a new target re-bases from the live value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, active])

  return value
}
