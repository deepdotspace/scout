/**
 * Scout landing page (route `/welcome`). The press-wire marketing page, built
 * from docs/design/LANDING_SPEC.md sections 1-9 in the same design language as the
 * studio (DESIGN_V2.md tokens / fonts / accent system / the radar).
 *
 * It is SHELL-LESS and PUBLIC: it renders OUTSIDE the studio AppShell and OUTSIDE
 * the SDK AuthGate (the split lives in src/pages/_app.tsx), so a logged-out visitor
 * sees the page with no sign-in wall. It has its own sticky nav. The rest of the
 * app stays owner-gated.
 *
 * "Open the studio" goes straight to the desk when signed in, and triggers the SDK
 * sign-in overlay when not (then the desk). The brand wordmark in the studio
 * sidebar navigates here; the "Open the studio" CTAs are the way back, so this is
 * never a dead end.
 *
 * Naming rule (REDESIGN_PLAN.md): Scout = the masthead / brand; Laila = the
 * correspondent (the sample byline + the chat reply reference Laila). No em dashes.
 */

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, AuthOverlay } from 'deepspace'
import { ArrowRight, ArrowDown, Mail, Server, Lock, Coins } from 'lucide-react'
import { ScoutMark } from '../components/scout/Logo'
import { EyebrowLabel } from '../components/scout/Eyebrow'
import { SourceChip } from '../components/scout/SourceChip'
import { useAccentMode, ACCENTS } from '../theme/accent'
import { FieldRadar } from '../components/field/FieldRadar'
import { useReducedMotion } from '../components/scout/motion'
import { LANDING_EDITION } from '../data/landing-edition'

export default function WelcomePage() {
  const navigate = useNavigate()
  const { isSignedIn } = useAuth()
  // When the visitor is signed out, "Open the studio" opens the SDK sign-in overlay
  // (closeable). On success the session flips and we route to the desk.
  const [signInOpen, setSignInOpen] = useState(false)
  const prevSignedIn = useRef(isSignedIn)

  useEffect(() => {
    if (!prevSignedIn.current && isSignedIn && signInOpen) {
      setSignInOpen(false)
      navigate('/')
    }
    prevSignedIn.current = isSignedIn
  }, [isSignedIn, signInOpen, navigate])

  /** Signed in -> straight to the desk. Signed out -> the SDK sign-in flow first. */
  const openStudio = () => {
    if (isSignedIn) {
      navigate('/')
    } else {
      setSignInOpen(true)
    }
  }

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
      <LandingNav onOpenStudio={openStudio} onJump={scrollTo} />
      <main>
        <Hero onOpenStudio={openStudio} onSeeDispatch={() => scrollTo('a-dispatch')} />
        <HowItWorks />
        <SampleDispatch />
        <Voices />
        <Trust />
        <FinalCta onOpenStudio={openStudio} />
      </main>
      <Footer />

      {signInOpen && <AuthOverlay onClose={() => setSignInOpen(false)} />}
    </div>
  )
}

/* ------------------------------------------------------------------ 1. NAV */

function LandingNav({
  onOpenStudio,
  onJump,
}: {
  onOpenStudio: () => void
  onJump: (id: string) => void
}) {
  const { accent, mode, setAccent } = useAccentMode()
  const reduced = useReducedMotion()
  return (
    <header
      className="sticky top-0 z-30"
      style={{
        background: 'var(--bg-trans)',
        borderBottom: '1px solid var(--line)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div className="mx-auto flex h-16 max-w-[1160px] items-center gap-4 px-5 md:px-8">
        <a href="#top" className="flex items-center gap-2.5">
          <span
            className="grid place-items-center"
            style={reduced ? undefined : { animation: 'sct-orbit 26s linear infinite', transformOrigin: 'center' }}
          >
            <ScoutMark size={24} />
          </span>
          <span className="font-serif font-semibold" style={{ fontSize: '22px', color: 'var(--ink)' }}>
            Scout
          </span>
        </a>

        <nav className="ml-auto hidden items-center gap-6 md:flex">
          <NavLink onClick={() => onJump('how-it-works')}>How it works</NavLink>
          <NavLink onClick={() => onJump('a-dispatch')}>A dispatch</NavLink>
          <NavLink onClick={() => onJump('voices')}>Voices</NavLink>
        </nav>

        {/* The four accent swatches recolor the whole landing live. */}
        <div className="ml-auto flex items-center gap-2 md:ml-4">
          {ACCENTS.map((a) => {
            const selected = a.key === accent
            return (
              <button
                key={a.key}
                onClick={() => setAccent(a.key)}
                aria-label={`${a.label} accent`}
                aria-pressed={selected}
                className="size-[18px] rounded-full transition-transform hover:scale-110"
                style={{
                  background: mode === 'night' ? a.night : a.day,
                  boxShadow: selected
                    ? `0 0 0 2px var(--bg), 0 0 0 4px ${mode === 'night' ? a.night : a.day}`
                    : 'none',
                }}
              />
            )
          })}
        </div>

        <button onClick={onOpenStudio} className="sct-btn-primary ml-2 inline-flex h-10 items-center gap-1.5 rounded-[11px] px-4 text-[13.5px] font-semibold">
          Open the studio
          <ArrowRight className="size-4" />
        </button>
      </div>
    </header>
  )
}

function NavLink({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-[13.5px] font-medium transition-colors"
      style={{ color: 'var(--ink2)' }}
      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink2)')}
    >
      {children}
    </button>
  )
}

/* ----------------------------------------------------------------- 2. HERO */

function Hero({ onOpenStudio, onSeeDispatch }: { onOpenStudio: () => void; onSeeDispatch: () => void }) {
  const count = useCountUp(12418, 1600)
  return (
    <section id="top" className="mx-auto max-w-[1160px] px-5 pb-10 pt-14 md:px-8 md:pb-20 md:pt-24">
      <div className="grid items-center gap-12 md:grid-cols-2 md:gap-10">
        {/* LEFT */}
        <div style={{ animation: 'sct-up .5s ease both' }}>
          <span className="inline-flex items-center gap-2">
            <span
              className="size-1.5 rounded-full"
              style={{ background: 'var(--accent)', animation: 'sct-blink 1.4s infinite' }}
            />
            <EyebrowLabel accent>Your correspondent on the wire</EyebrowLabel>
          </span>
          <h1
            className="mt-5 font-serif"
            style={{
              fontSize: 'clamp(40px, 7vw, 66px)',
              fontWeight: 400,
              letterSpacing: '-0.02em',
              lineHeight: 1.04,
              color: 'var(--ink)',
              textWrap: 'pretty',
            }}
          >
            Send a scout into the noise.
          </h1>
          <p
            className="mt-6 max-w-[30rem] font-serif"
            style={{ fontSize: '20px', fontWeight: 300, lineHeight: 1.55, color: 'var(--ink2)' }}
          >
            It reads the live web so you don't have to, and files a sharp, sourced brief in a voice you pick.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button onClick={onOpenStudio} className="sct-btn-primary inline-flex h-[52px] items-center gap-2 rounded-[13px] px-6 text-[15px] font-semibold">
              Open the studio
              <ArrowRight className="size-[18px]" />
            </button>
            <button
              onClick={onSeeDispatch}
              className="sct-btn-ghost inline-flex h-[52px] items-center gap-2 rounded-[13px] px-6 text-[15px] font-medium"
            >
              See a dispatch
              <ArrowDown className="size-4" />
            </button>
          </div>

          <div className="mt-9 flex items-center gap-2.5">
            <span className="size-2 rounded-full" style={{ background: 'var(--live)', animation: 'sct-blink 1.6s infinite' }} />
            <span className="tnum font-mono text-[13px]" style={{ color: 'var(--ink2)' }}>
              {count.toLocaleString()} sources swept this week
            </span>
          </div>
        </div>

        {/* RIGHT: the radar in its control-room field, two floating cards over it. */}
        <div className="relative mx-auto w-full max-w-[460px]" style={{ animation: 'sct-in .7s ease both' }}>
          <div
            className="relative grid aspect-square place-items-center overflow-hidden rounded-[24px]"
            style={{
              background: 'var(--field-bg)',
              boxShadow: '0 30px 70px -30px rgba(20,12,2,.5)',
            }}
          >
            {/* The accent radial glow behind the radar. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ background: 'radial-gradient(circle at 50% 46%, var(--field-glow), transparent 62%)' }}
            />
            <FieldRadar phase={3} found={214} read={214} size={360} />
          </div>

          <FloatCard className="right-1 -top-4 md:-right-6">
            <EyebrowLabel accent className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
              Dispatch filed
            </EyebrowLabel>
            <p className="mt-1.5 font-serif text-[15px]" style={{ color: 'var(--ink)' }}>
              The New Space Race, just now
            </p>
          </FloatCard>

          <FloatCard className="-bottom-5 -left-3 md:-left-6">
            <p className="font-mono text-[11px] font-semibold tracking-wider" style={{ color: 'var(--ink3)' }}>
              READ 214 &middot; KEPT <span style={{ color: 'var(--accent)' }}>4</span>
            </p>
            <p className="mt-1.5 font-serif italic text-[14px]" style={{ color: 'var(--ink2)' }}>
              Most of it wasn't for you.
            </p>
          </FloatCard>
        </div>
      </div>
    </section>
  )
}

function FloatCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`absolute z-10 rounded-[14px] px-4 py-3 ${className || ''}`}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        boxShadow: '0 18px 44px -22px rgba(20,12,2,.4)',
      }}
    >
      {children}
    </div>
  )
}

/* --------------------------------------------------------- 4. HOW IT WORKS */

function HowItWorks() {
  return (
    <Section id="how-it-works">
      <SectionHead eyebrow="How it works" title="Three moves. Then it runs itself." />
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        <HowCard step="01 / Brief it" title="Say it in plain words" body="Even vague input. Scout proposes a sharper scope you can tweak." header={<BriefHeader />} />
        <HowCard step="02 / It scouts" title="Sweeps the live web" body="Reads hundreds of sources, drops the noise, keeps what changed." header={<ScoutHeader />} />
        <HowCard step="03 / It files" title="A real edition lands" body="Short lead, sourced stories, and you can talk to it." header={<FileHeader />} />
      </div>
    </Section>
  )
}

function HowCard({
  step,
  title,
  body,
  header,
}: {
  step: string
  title: string
  body: string
  header: React.ReactNode
}) {
  return (
    <div
      className="flex flex-col rounded-[20px] p-2"
      style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
    >
      <div
        className="grid h-[130px] place-items-center overflow-hidden rounded-[14px]"
        style={{ background: 'var(--s2)' }}
      >
        {header}
      </div>
      <div className="px-5 pb-5 pt-5">
        <EyebrowLabel accent>{step}</EyebrowLabel>
        <h3 className="mt-2.5 font-serif" style={{ fontSize: '21px', fontWeight: 500, color: 'var(--ink)' }}>
          {title}
        </h3>
        <p className="mt-2 text-[14px]" style={{ lineHeight: 1.55, color: 'var(--ink2)' }}>
          {body}
        </p>
      </div>
    </div>
  )
}

function BriefHeader() {
  return (
    <div className="relative w-[78%]">
      <div
        className="flex items-center gap-1 rounded-[10px] px-3 py-2.5"
        style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
      >
        <span className="font-mono text-[12.5px]" style={{ color: 'var(--ink2)' }}>
          ai agents, no hype
        </span>
        <span className="ml-0.5 inline-block h-3.5 w-[2px]" style={{ background: 'var(--accent)', animation: 'sct-blink 1.1s step-end infinite' }} />
      </div>
      <span
        className="absolute -bottom-3 right-1 rounded-full px-2.5 py-1 font-mono text-[9.5px] font-semibold uppercase tracking-wider"
        style={{ background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-line)', animation: 'sct-up 2.4s ease-in-out infinite alternate' }}
      >
        scope sharpened
      </span>
    </div>
  )
}

function ScoutHeader() {
  const reduced = useReducedMotion()
  return (
    <div
      className="relative grid h-full w-full place-items-center"
      style={{ background: 'var(--field-bg)' }}
    >
      <span
        className="size-14 rounded-full"
        style={{
          background: 'conic-gradient(from 0deg, transparent, var(--accent))',
          mask: 'radial-gradient(farthest-side, transparent calc(100% - 5px), #000 0)',
          WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 5px), #000 0)',
          animation: reduced ? undefined : 'sct-spin 2.4s linear infinite',
        }}
      />
      <span className="absolute size-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
      <span className="absolute left-5 top-5 size-1 rounded-full" style={{ background: 'rgba(255,255,255,.4)' }} />
      <span className="absolute bottom-6 right-6 size-1 rounded-full" style={{ background: 'rgba(255,255,255,.3)' }} />
    </div>
  )
}

function FileHeader() {
  return (
    <div
      className="w-[72%] rounded-[10px] px-4 py-3.5"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        boxShadow: '0 14px 34px -18px rgba(20,12,2,.3)',
        animation: 'sct-up 3s ease-in-out infinite alternate',
      }}
    >
      <p className="text-center font-mono text-[8.5px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--ink3)' }}>
        Received over the wire
      </p>
      <p className="mt-1 text-center font-serif font-semibold" style={{ fontSize: '15px', color: 'var(--ink)' }}>
        The New Space Race
      </p>
      <div className="mx-auto mt-2 h-px w-full" style={{ background: 'var(--line)' }} />
      <div className="mt-2 space-y-1.5">
        <div className="h-1.5 w-full rounded" style={{ background: 'var(--s2)' }} />
        <div className="h-1.5 w-4/5 rounded" style={{ background: 'var(--s2)' }} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------- 5. SAMPLE DISPATCH */

function SampleDispatch() {
  const edition = LANDING_EDITION
  // The fixture summaries run 4 to 5 sentences. On the landing we show a tight
  // excerpt (the first one to two sentences) so the card reads as a real, dense
  // edition without becoming a wall of text. We show five stories and drop the
  // most niche one (the Chang'e-6 geology paper) to keep the card balanced.
  const stories = edition.stories.slice(0, 5)
  return (
    <Section id="a-dispatch">
      <SectionHead eyebrow="What lands in your inbox" title="A real edition. Not a wall of links." />
      <div className="mt-12 grid gap-8 lg:grid-cols-[1.3fr_0.9fr]">
        {/* LEFT: the elevated edition. */}
        <article
          className="rounded-[18px] px-6 py-9 md:px-10"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            boxShadow: 'var(--shadow-featured)',
          }}
        >
          {/* Letterhead */}
          <div className="text-center">
            <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--ink3)' }}>
              Received over the wire
            </p>
            <h3 className="mt-2 font-serif" style={{ fontSize: '27px', fontWeight: 600, lineHeight: 1.15, color: 'var(--ink)', textWrap: 'balance' }}>
              {edition.title}
            </h3>
            <p className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.12em]" style={{ color: 'var(--ink3)' }}>
              Dispatch {edition.dispatchNo} / {edition.dateLabel} / filed by Laila, {edition.voiceLabel} voice
            </p>
            <div className="mx-auto mt-5 h-0.5 w-full" style={{ background: 'var(--ink)' }} />
          </div>

          {/* Lead */}
          <p
            className="mt-7 font-serif"
            style={{ fontSize: '23px', fontWeight: 400, letterSpacing: '-0.01em', lineHeight: 1.52, color: 'var(--ink)', textWrap: 'pretty' }}
          >
            {edition.lead}
          </p>

          {/* Stories */}
          <div className="mt-9 space-y-8">
            {stories.map((story, i) => (
              <Story key={story.sourceUrl} n={String(i + 1).padStart(2, '0')} story={story} />
            ))}
          </div>
        </article>

        {/* RIGHT (sticky): wire back + stats. */}
        <div className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
          <WireBackCard />
          <StatsCard />
        </div>
      </div>
    </Section>
  )
}

/**
 * A tight landing excerpt: the first sentence, plus a second only if the first
 * is short, so each story reads as a real, substantive lead without becoming a
 * wall of text.
 */
function excerpt(summary: string): string {
  const parts = summary.match(/[^.]+\./g)?.map((s) => s.trim())
  if (!parts || parts.length === 0) return summary
  const take = parts[0].length > 150 ? 1 : Math.min(2, parts.length)
  return parts.slice(0, take).join(' ')
}

function Story({ n, story }: { n: string; story: (typeof LANDING_EDITION)['stories'][number] }) {
  return (
    <div className="flex gap-4">
      <span
        className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full font-mono text-[11px] font-semibold"
        style={{ border: '1px solid var(--accent-line)', color: 'var(--accent)' }}
      >
        {n}
      </span>
      <div className="min-w-0">
        <h4 className="font-serif" style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.3, color: 'var(--ink)' }}>
          {story.headline}
        </h4>
        <p className="mt-2 font-serif" style={{ fontSize: '17px', fontWeight: 300, lineHeight: 1.6, color: 'var(--ink2)' }}>
          {excerpt(story.summary)}
        </p>
        <div className="mt-3">
          <SourceChip href={story.sourceUrl}>{story.sourceName}</SourceChip>
        </div>
      </div>
    </div>
  )
}

function WireBackCard() {
  return (
    <div
      className="rounded-[16px] p-5"
      style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
    >
      <EyebrowLabel accent className="flex items-center gap-1.5">
        <span className="size-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
        Then wire back to Laila
      </EyebrowLabel>

      {/* User bubble */}
      <div className="mt-4">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink3)' }}>
          You
        </p>
        <p className="mt-1 text-[14px] font-medium" style={{ lineHeight: 1.5, color: 'var(--ink2)' }}>
          So Artemis III is not the Moon landing anymore?
        </p>
      </div>

      {/* Laila reply on an accent wash */}
      <div className="mt-4 rounded-[12px] p-3.5" style={{ background: 'var(--accent-soft)' }}>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
          Laila
        </p>
        <p className="mt-1 font-serif" style={{ fontSize: '15.5px', lineHeight: 1.6, color: 'var(--ink)' }}>
          Right. It flies in low Earth orbit in 2027 to test docking with the landers. The first crewed landing slips to Artemis IV in 2028.
        </p>
      </div>
    </div>
  )
}

function StatsCard() {
  return (
    <div
      className="grid grid-cols-3 rounded-[16px] py-5"
      style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
    >
      <Stat value="214" label="Read" />
      <Stat value="4" label="Kept" accent />
      <Stat value="~$0.04" label="Cost" />
    </div>
  )
}

function Stat({ value, label, accent = false }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <span className="tnum font-mono" style={{ fontSize: '26px', fontWeight: 500, letterSpacing: '-0.02em', color: accent ? 'var(--accent)' : 'var(--ink)' }}>
        {value}
      </span>
      <span className="mt-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--ink3)' }}>
        {label}
      </span>
    </div>
  )
}

/* --------------------------------------------------------------- 6. VOICES */

const VOICES: { name: string; quote: string }[] = [
  { name: 'Sharp Analyst', quote: 'The headline is the off-switch, not the nine-hour run. That distinction is the whole story.' },
  { name: 'Executive Brief', quote: 'Bottom line: pricing moved 18% against us. Two infra hires in Berlin. Act on pricing this week.' },
  { name: 'Warm Companion', quote: 'Quietly excellent week. The big news is small, and Saturday looks perfect for a miradouro.' },
  { name: 'Precise Academic', quote: 'Encouraging results, though likely contaminated in two of three evals; treat as preliminary.' },
  { name: 'Storyteller', quote: 'Two labs shipped agents this week, and both buried the same quiet confession in the footnotes.' },
]
const VOICE_INTERVAL = 3200

function Voices() {
  const [active, setActive] = useState(0)
  // Manual selection resets the auto-cycle so a click is honored, not overridden.
  const [tick, setTick] = useState(0)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return
    const id = setInterval(() => setActive((a) => (a + 1) % VOICES.length), VOICE_INTERVAL)
    return () => clearInterval(id)
  }, [reduced, tick])

  const select = (i: number) => {
    setActive(i)
    setTick((t) => t + 1)
  }

  const voice = VOICES[active]
  return (
    <Section id="voices">
      <SectionHead eyebrow="A voice for the desk" title="Same news. Your voice." />
      <div className="mt-12 flex flex-col items-center text-center">
        <blockquote
          key={active}
          className="min-h-[7.5rem] max-w-[44rem] font-serif italic"
          style={{ fontSize: 'clamp(22px, 3.4vw, 30px)', fontWeight: 400, lineHeight: 1.42, color: 'var(--ink)', animation: 'sct-in .5s ease both', textWrap: 'pretty' }}
        >
          "{voice.quote}"
        </blockquote>
        <p className="mt-5 font-mono text-[12px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--accent)' }}>
          {voice.name}
        </p>

        {/* Progress bar that refills each cycle. */}
        <div className="mt-6 h-0.5 w-40 overflow-hidden rounded-full" style={{ background: 'var(--line)' }}>
          {!reduced && (
            <span
              key={`${active}-${tick}`}
              className="block h-full"
              style={{ background: 'var(--accent)', animation: `sct-progress ${VOICE_INTERVAL}ms linear` }}
            />
          )}
        </div>

        {/* Clickable voice pills. */}
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          {VOICES.map((v, i) => {
            const selected = i === active
            return (
              <button
                key={v.name}
                onClick={() => select(i)}
                className="rounded-[20px] px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors"
                style={{
                  border: '1px solid',
                  borderColor: selected ? 'var(--accent-line)' : 'var(--line)',
                  background: selected ? 'var(--accent-soft)' : 'transparent',
                  color: selected ? 'var(--accent)' : 'var(--ink2)',
                }}
              >
                {v.name}
              </button>
            )
          })}
        </div>
      </div>
    </Section>
  )
}

/* ---------------------------------------------------------------- 7. TRUST */

function Trust() {
  return (
    <Section>
      <div
        className="relative overflow-hidden rounded-[24px] px-6 py-14 md:px-16"
        style={{ background: 'var(--field-bg)' }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(circle at 50% 0%, var(--field-glow), transparent 60%)' }}
        />
        <div className="relative text-center">
          <h2 className="font-serif" style={{ fontSize: 'clamp(30px, 4.6vw, 42px)', fontWeight: 400, letterSpacing: '-0.01em', color: 'var(--field-ink)' }}>
            One reader. One inbox. Yours.
          </h2>
        </div>
        <div className="relative mx-auto mt-12 grid max-w-[820px] gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <TrustItem icon={<Mail />} title="Single-recipient" body="It files to one inbox, the one you own. No list, no audience." />
          <TrustItem icon={<Server />} title="Self-hosted" body="Redeploy Scout to your own account in three commands. You run it." />
          <TrustItem icon={<Lock />} title="Private" body="Your topics, your reading, and your chats stay on your deployment." />
          <TrustItem icon={<Coins />} title="~$0.04 / issue" body="Pass-through cost only. Scout takes nothing on top." />
        </div>
      </div>
    </Section>
  )
}

function TrustItem({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div>
      <span className="grid size-9 place-items-center rounded-[9px] [&_svg]:size-[18px]" style={{ background: 'rgba(255,255,255,.06)', color: 'var(--accent)' }}>
        {icon}
      </span>
      <h3 className="mt-3.5 font-serif" style={{ fontSize: '17px', fontWeight: 500, color: 'var(--field-ink)' }}>
        {title}
      </h3>
      <p className="mt-1.5 text-[13px]" style={{ lineHeight: 1.55, color: 'var(--field-dim)' }}>
        {body}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ 8. CTA */

function FinalCta({ onOpenStudio }: { onOpenStudio: () => void }) {
  const reduced = useReducedMotion()
  return (
    <Section>
      <div className="flex flex-col items-center py-6 text-center">
        <span
          className="grid place-items-center"
          style={reduced ? undefined : { animation: 'sct-orbit 18s linear infinite', transformOrigin: 'center' }}
        >
          <ScoutMark size={40} />
        </span>
        <h2 className="mt-7 font-serif" style={{ fontSize: 'clamp(34px, 5.4vw, 50px)', fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.06, color: 'var(--ink)' }}>
          Start your first beat.
        </h2>
        <p className="mt-4 max-w-[28rem] font-serif" style={{ fontSize: '18px', fontWeight: 300, lineHeight: 1.55, color: 'var(--ink2)' }}>
          One sentence in. Your first dispatch out in about a minute.
        </p>
        <button onClick={onOpenStudio} className="sct-btn-primary mt-8 inline-flex h-[52px] items-center gap-2 rounded-[13px] px-7 text-[15px] font-semibold">
          Open the studio
          <ArrowRight className="size-[18px]" />
        </button>
      </div>
    </Section>
  )
}

/* --------------------------------------------------------------- 9. FOOTER */

function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--line)' }}>
      <div className="mx-auto flex max-w-[1160px] flex-col items-center gap-3 px-5 py-8 text-center sm:flex-row sm:justify-between sm:text-left md:px-8">
        <div className="flex items-center gap-2.5">
          <ScoutMark size={20} />
          <span className="font-serif font-semibold" style={{ fontSize: '17px', color: 'var(--ink)' }}>
            Scout
          </span>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.14em]" style={{ color: 'var(--ink3)' }}>
            Filing for one
          </span>
        </div>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.14em]" style={{ color: 'var(--ink3)' }}>
          Self-hosted / Open source / MIT
        </p>
      </div>
    </footer>
  )
}

/* ------------------------------------------------------------- primitives */

function Section({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mx-auto max-w-[1160px] px-5 py-16 md:px-8 md:py-24">
      {children}
    </section>
  )
}

function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <EyebrowLabel accent>{eyebrow}</EyebrowLabel>
      <h2
        className="mt-3 font-serif"
        style={{ fontSize: 'clamp(30px, 4.4vw, 40px)', fontWeight: 400, letterSpacing: '-0.01em', lineHeight: 1.1, color: 'var(--ink)', textWrap: 'pretty' }}
      >
        {title}
      </h2>
    </div>
  )
}

/** A mono counter that animates from 0 to `target` once on mount (eases out). */
function useCountUp(target: number, duration: number): number {
  const [value, setValue] = useState(0)
  const reduced = useReducedMotion()
  useEffect(() => {
    if (reduced) {
      setValue(target)
      return
    }
    let raf = 0
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(target * eased))
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, reduced])
  return value
}
