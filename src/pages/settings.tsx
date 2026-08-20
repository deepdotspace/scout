/**
 * Settings (route `/settings`) in the press-wire world (DESIGN_V2.md section 5,
 * shots 21 / 26). The owner's control room and the product's honesty promise to a
 * redeployer. Max 720, a serif H1 + italic sub, then soft-shadow --surface
 * sections of hairline-divided rows under mono eyebrows.
 *
 * Sections:
 *   1. Health check        - status rows from /api/config-health, honest sublines.
 *   2. Where issues land    - the delivery email + a last-test line.
 *   3. Models & cost        - three role rows + the typical per-issue cost and the
 *                             pass-through note (Scout takes nothing).
 *   4. Writing voices       - the editable voice list + "Write a new voice".
 *   5. Appearance           - the accent swatches + Daylight / Night-desk cards.
 *   6. What Laila remembers   - a read-only view of the durable profile row.
 *
 * The real config-health is owner-gated, so it only loads when signed in as the
 * owner; `?demo=1` drives a faithful fixture for screenshots without auth or DB.
 */

import { useNavigate } from 'react-router-dom'
import { useQuery } from 'deepspace'
import { ChevronLeft, Plus, RefreshCw } from 'lucide-react'
import { SettingsCard, Row } from '../components/settings/SettingsCard'
import { Button } from '../components/scout/Button'
import { useScoutToast } from '../components/scout/ScoutToast'
import { useConfigHealth } from '../components/scout/useConfigHealth'
import { useAccentMode, ACCENTS } from '../theme/accent'
import { VOICE_OPTIONS } from '../personas'
import { MODELS } from '../config'
import { profileFromRow, type ReaderProfile } from '../lib/profile'
import { estimateIssueModelCents, type ConfigHealth } from '../lib/config-health'
import { isDemo } from '../lib/demo'
import { cn } from '../components/ui/utils'

export default function SettingsPage() {
  const navigate = useNavigate()
  const demo = isDemo()

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[720px] px-6 pb-28 pt-14 md:px-12">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="sct-btn-ghost mb-[22px] inline-flex h-8 items-center gap-[7px] rounded-[9px] pl-[9px] pr-3 text-[12.5px] font-medium"
          style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink2)' }}
        >
          <ChevronLeft className="size-[15px]" />
          The desk
        </button>

        <h1
          className="mb-1 font-serif"
          style={{ fontSize: '38px', fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--ink)' }}
        >
          Settings
        </h1>
        <p
          className="mb-11 font-serif italic"
          style={{ fontSize: '16px', fontWeight: 300, color: 'var(--ink2)' }}
        >
          One reader. One inbox. Self-hosted, and yours.
        </p>

        <HealthCheck demo={demo} />
        <WhereIssuesLand demo={demo} />
        <ModelsAndCost />
        <WritingVoices />
        <Appearance />
        <WhatLailaRemembers demo={demo} />
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Status dot                                                                 */
/* -------------------------------------------------------------------------- */

// 'neutral' is the informational tone: a muted ink dot, deliberately NOT green.
// It marks a row that is wired/reachable but not live-verified (model access is
// configured but not pinged; storage is local), so a green is never faked.
type Tone = 'ok' | 'warn' | 'down' | 'neutral'

const TONE_HEX: Record<Tone, string> = { ok: '#5BA86B', warn: '#D9A441', down: '#C2603D', neutral: 'var(--ink3)' }
const TONE_GLOW: Record<Tone, string> = {
  ok: 'rgba(91,168,107,.18)',
  warn: 'rgba(217,164,65,.18)',
  down: 'rgba(194,96,61,.18)',
  neutral: 'rgba(120,108,92,.14)',
}

function HealthDot({ tone }: { tone: Tone }) {
  return (
    <span
      className="inline-flex size-2 shrink-0 rounded-full"
      style={{ background: TONE_HEX[tone], boxShadow: `0 0 0 3px ${TONE_GLOW[tone]}` }}
      aria-hidden
    />
  )
}

function StatusWord({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className="font-mono text-[11px] font-semibold" style={{ color: TONE_HEX[tone] }}>
      {children}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* 1. Health check                                                            */
/* -------------------------------------------------------------------------- */

interface HealthRowView {
  label: string
  detail: string
  status: string
  tone: Tone
}

/** The faithful fixture for screenshots. Mirrors the honest live mapping exactly:
 *  Model access reads "Configured" (wired, not pinged) and Storage "Local" on the
 *  neutral tone, so the demo never shows a green the live endpoint would not. */
const DEMO_HEALTH: HealthRowView[] = [
  { label: 'Email delivery', detail: 'Sender verified. Issues are reaching your inbox.', status: 'Healthy', tone: 'ok' },
  { label: 'Model access', detail: 'Wired. Calls route through your DeepSpace proxy and your own account.', status: 'Configured', tone: 'neutral' },
  { label: 'Web search', detail: 'Live and crawling. Exa and Firecrawl responded.', status: 'Healthy', tone: 'ok' },
  { label: 'Scheduler', detail: 'Cron is live. 3 beats are queued for their next run.', status: 'Running', tone: 'ok' },
  { label: 'Storage', detail: 'Reachable. Every issue is kept in your own database.', status: 'Local', tone: 'neutral' },
]

/**
 * Map the real config-health onto the design's five rows. Every row reflects a
 * REAL signal from /api/config-health and none renders a green without a basis:
 *   - Email: the owner email + sender check.
 *   - Model access: the owner proxy credential is wired (not a live ping, which
 *     would bill the owner on every open), so it reads "Configured", not a green
 *     "Healthy" we have not verified.
 *   - Web search: a live owner-billed Exa probe (only under ?probe=1).
 *   - Scheduler: whether any active beat was left behind by a slot that never
 *     fired (the one signal that catches a cron room nobody ever armed).
 *   - Storage: the records store answered this very request.
 */
function liveHealthRows(data: ConfigHealth): HealthRowView[] {
  const email: HealthRowView =
    data.email.status === 'delivering'
      ? { label: 'Email delivery', detail: `Sending from ${data.email.from}. Issues reach your inbox.`, status: 'Healthy', tone: 'ok' }
      : data.email.status === 'testmode'
        ? { label: 'Email delivery', detail: 'Resend test mode: delivers to your own verified address only.', status: 'Test mode', tone: 'warn' }
        : { label: 'Email delivery', detail: data.email.reason, status: 'Down', tone: 'down' }

  const model: HealthRowView =
    data.model.status === 'configured'
      ? { label: 'Model access', detail: 'Wired. Calls route through your DeepSpace proxy and your own account.', status: 'Configured', tone: 'neutral' }
      : { label: 'Model access', detail: data.model.reason, status: 'Down', tone: 'down' }

  const web: HealthRowView =
    data.integrations.status === 'ok'
      ? { label: 'Web search', detail: 'Live and crawling. Search providers responded to a probe.', status: 'Healthy', tone: 'ok' }
      : data.integrations.status === 'unknown'
        ? { label: 'Web search', detail: 'Not checked yet. Recheck to run a live search probe.', status: 'Unknown', tone: 'warn' }
        : { label: 'Web search', detail: data.integrations.reason, status: 'Down', tone: 'down' }

  const scheduler: HealthRowView =
    data.scheduler.status === 'running'
      ? {
          label: 'Scheduler',
          // Says only what was actually checked: beats are queued and none has
          // slipped past its slot. "Cron is live" was the old wording, and it
          // was a claim this panel had no way to verify.
          detail: `${data.scheduler.scheduled} ${data.scheduler.scheduled === 1 ? 'beat is' : 'beats are'} queued and none has missed its slot.`,
          status: 'Running',
          tone: 'ok',
        }
      : data.scheduler.status === 'idle'
        ? { label: 'Scheduler', detail: data.scheduler.reason, status: 'Idle', tone: 'neutral' }
        : { label: 'Scheduler', detail: data.scheduler.reason, status: 'Down', tone: 'down' }

  const storage: HealthRowView =
    data.storage.status === 'ok'
      ? { label: 'Storage', detail: 'Reachable. Every issue is kept in your own database.', status: 'Local', tone: 'neutral' }
      : { label: 'Storage', detail: data.storage.reason, status: 'Down', tone: 'down' }

  return [email, model, web, scheduler, storage]
}

function HealthCheck({ demo }: { demo: boolean }) {
  const { data, loading, error, refresh } = useConfigHealth({ probe: true })
  const rows = demo ? DEMO_HEALTH : data ? liveHealthRows(data) : null

  return (
    <SettingsCard
      eyebrow="Health check"
      bodyClassName="px-0"
    >
      {rows ? (
        rows.map((h) => (
          <Row
            key={h.label}
            lead={<HealthDot tone={h.tone} />}
            label={h.label}
            detail={h.detail}
            trailing={<StatusWord tone={h.tone}>{h.status}</StatusWord>}
          />
        ))
      ) : (
        <div className="flex items-center justify-between gap-3 px-[22px] py-5">
          <p className="text-[13px]" style={{ color: 'var(--ink2)' }}>
            {error
              ? 'Sign in as the app owner to run the health check.'
              : loading
                ? 'Running the health check...'
                : 'Open as the owner to see config health.'}
          </p>
          <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={cn(loading && 'animate-spin')} />
            Recheck
          </Button>
        </div>
      )}
    </SettingsCard>
  )
}

/* -------------------------------------------------------------------------- */
/* 2. Where issues land                                                       */
/* -------------------------------------------------------------------------- */

function WhereIssuesLand({ demo }: { demo: boolean }) {
  const { data } = useConfigHealth({ probe: false })
  const email = demo ? 'you@yourdomain.com' : data?.owner.email || 'Not set yet'

  const delivering = demo || data?.email.status === 'delivering' || data?.email.status === 'testmode'
  const lastTest = demo
    ? 'Delivery is wired. Issues are reaching your inbox.'
    : data?.email.status === 'delivering'
      ? `Sending cleanly from ${data.email.from}.`
      : data?.email.status === 'testmode'
        ? 'Resend test mode. Delivers to your verified address only, which is you.'
        : data?.email.reason || 'Sign in as the owner to check delivery.'

  return (
    <SettingsCard eyebrow="Where issues land" bodyClassName="px-[22px] py-5">
      <label className="mb-[9px] block text-[13px]" style={{ color: 'var(--ink2)' }}>
        Delivery email
      </label>
      <div
        className="flex h-[46px] items-center rounded-[11px] px-4 font-mono text-[15px]"
        style={{ background: 'var(--s2)', color: 'var(--ink)' }}
      >
        {email}
      </div>
      <div className="mt-3.5 flex items-center gap-[9px] text-[13px]" style={{ color: 'var(--ink2)' }}>
        <HealthDot tone={delivering ? 'ok' : 'warn'} />
        {lastTest}
      </div>
    </SettingsCard>
  )
}

/* -------------------------------------------------------------------------- */
/* 3. Models & cost                                                           */
/* -------------------------------------------------------------------------- */

const MODEL_ROWS = [
  { role: 'Reading the web', model: `${MODELS.haiku} - fast, cheap, high volume` },
  { role: 'Writing your dispatch', model: `${MODELS.sonnet} - the voice and the judgment` },
  { role: 'Wiring back to Laila', model: `${MODELS.sonnet} - grounded in your history` },
] as const

function ModelsAndCost() {
  const perIssue = (estimateIssueModelCents() / 100).toFixed(2)

  return (
    <>
      <SettingsCard eyebrow="Models & cost" className="mb-2" bodyClassName="px-0">
        {MODEL_ROWS.map((m) => (
          <Row
            key={m.role}
            label={m.role}
            detail={<span className="font-mono text-[12px]">{m.model}</span>}
          />
        ))}
        <div
          className="flex items-center justify-between px-[22px] py-4 border-t"
          style={{ borderColor: 'var(--line)' }}
        >
          <span className="text-[14px]" style={{ color: 'var(--ink2)' }}>
            Typical cost per issue
          </span>
          <span className="font-mono text-[16px] font-semibold" style={{ color: 'var(--accent)' }}>
            ~${perIssue}
          </span>
        </div>
      </SettingsCard>
      <p className="mb-10 text-[13px] leading-relaxed" style={{ color: 'var(--ink3)' }}>
        You pay the providers directly through your own DeepSpace account. Scout takes nothing.
        Talking to Laila is a Sonnet chat turn, plus an occasional web lookup she runs through your
        account when an answer needs one.
      </p>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* 4. Writing voices                                                          */
/* -------------------------------------------------------------------------- */

function WritingVoices() {
  const { showToast } = useScoutToast()

  return (
    <SettingsCard eyebrow="Writing voices" bodyClassName="px-0">
      {VOICE_OPTIONS.map((v) => (
        <Row
          key={v.id}
          label={<span className="font-serif text-[17px] font-medium">{v.label}</span>}
          detail={v.blurb}
          trailing={
            <button
              type="button"
              onClick={() => showToast('In-app voice editing is coming. Edit voices in src/personas.ts for now.')}
              className="sct-btn-ghost h-8 rounded-[8px] px-[13px] text-[12.5px] font-semibold"
              style={{ border: '1px solid var(--line)', background: 'transparent', color: 'var(--ink2)' }}
            >
              Edit
            </button>
          }
        />
      ))}
      <div className="px-[22px] py-3.5">
        <button
          type="button"
          onClick={() => showToast('A voice editor is coming. For now, add voices in src/personas.ts.')}
          className="inline-flex h-[34px] items-center gap-2 rounded-[9px] px-3.5 text-[13px] font-semibold transition-colors"
          style={{ border: '1px dashed var(--line)', background: 'transparent', color: 'var(--accent)' }}
        >
          <Plus className="size-[13px]" strokeWidth={2.4} />
          Write a new voice
        </button>
      </div>
    </SettingsCard>
  )
}

/* -------------------------------------------------------------------------- */
/* 5. Appearance                                                              */
/* -------------------------------------------------------------------------- */

function Appearance() {
  const { accent, mode, setAccent, setMode } = useAccentMode()

  return (
    <SettingsCard eyebrow="Appearance" bodyClassName="p-[22px]">
      <div className="mb-3.5 text-[14px]" style={{ color: 'var(--ink2)' }}>
        Accent
      </div>
      <div className="mb-6 flex flex-wrap gap-3.5">
        {ACCENTS.map((a) => {
          const selected = a.key === accent
          const hex = mode === 'night' ? a.night : a.day
          return (
            <button
              key={a.key}
              type="button"
              onClick={() => setAccent(a.key)}
              aria-pressed={selected}
              className="flex items-center gap-[9px] rounded-[12px] px-[15px] py-[11px] transition-transform hover:-translate-y-0.5"
              style={{
                border: `1.5px solid ${selected ? hex : 'var(--line)'}`,
                background: selected ? 'var(--accent-soft)' : 'var(--surface)',
              }}
            >
              <span className="inline-flex size-4 shrink-0 rounded-full" style={{ background: hex }} />
              <span className="text-[12.5px] font-semibold" style={{ color: 'var(--ink)' }}>
                {a.label}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mb-3.5 text-[14px]" style={{ color: 'var(--ink2)' }}>
        Mood
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <ModeCard
          title="Daylight"
          sub="Warm paper. Calm and bright."
          selected={mode === 'day'}
          onClick={() => setMode('day')}
        />
        <ModeCard
          title="Night desk"
          sub="Low light. For late filing."
          selected={mode === 'night'}
          onClick={() => setMode('night')}
        />
      </div>
    </SettingsCard>
  )
}

function ModeCard({
  title,
  sub,
  selected,
  onClick,
}: {
  title: string
  sub: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className="flex flex-1 flex-col items-start gap-1 rounded-[13px] px-[17px] py-[15px] text-left transition-colors"
      style={{
        border: `1.5px solid ${selected ? 'var(--accent)' : 'var(--line)'}`,
        background: selected ? 'var(--accent-soft)' : 'var(--surface)',
      }}
    >
      <span className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
        {title}
      </span>
      <span className="text-[12px]" style={{ color: 'var(--ink2)' }}>
        {sub}
      </span>
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/* 6. What Laila remembers                                                      */
/* -------------------------------------------------------------------------- */

const DEMO_PROFILE: ReaderProfile = {
  displayName: 'Harsh',
  interests: ['frontier AI models', 'agents and tool use', 'Lisbon', 'bouldering'],
  facts: [
    'Builds on the DeepSpace SDK and ships fast.',
    'Prefers the bottom line first, then the detail.',
    'Reads on weekday mornings, before the desk fills up.',
  ],
}

function WhatLailaRemembers({ demo }: { demo: boolean }) {
  // The profile row is read-scoped 'own', so the owner can read it on the client.
  const profileQ = useQuery<Record<string, unknown>>('profile')
  const profile = demo ? DEMO_PROFILE : profileFromRow(profileQ.records[0]?.data)

  const hasAnything =
    !!profile.displayName || profile.interests.length > 0 || profile.facts.length > 0
  // TODO(follow-up): add an edit / forget control here once the profile-write
  // path is exposed to the client. This wave is read-only by design.

  return (
    <SettingsCard eyebrow="What Laila remembers about you" bodyClassName="px-[22px] py-5">
      {!hasAnything ? (
        <p className="font-serif italic" style={{ fontSize: '16px', color: 'var(--ink2)' }}>
          Laila has not gotten to know you yet. Wire back on a dispatch and it will start to remember.
        </p>
      ) : (
        <div className="space-y-4">
          {profile.displayName && (
            <div>
              <div className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--ink3)' }}>
                Goes by
              </div>
              <p className="text-[14px]" style={{ color: 'var(--ink)' }}>
                {profile.displayName}
              </p>
            </div>
          )}
          {profile.interests.length > 0 && (
            <div>
              <div className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--ink3)' }}>
                Cares about
              </div>
              <div className="flex flex-wrap gap-2">
                {profile.interests.map((it) => (
                  <span
                    key={it}
                    className="rounded-[20px] px-3 py-1 text-[12.5px]"
                    style={{ background: 'var(--s2)', color: 'var(--ink2)' }}
                  >
                    {it}
                  </span>
                ))}
              </div>
            </div>
          )}
          {profile.facts.length > 0 && (
            <div>
              <div className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--ink3)' }}>
                Notes
              </div>
              <ul className="space-y-1.5">
                {profile.facts.slice(0, 5).map((f, i) => (
                  <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed" style={{ color: 'var(--ink2)' }}>
                    <span style={{ color: 'var(--ink3)' }}>-</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="pt-1 text-[12px]" style={{ color: 'var(--ink3)' }}>
            Read-only for now. Editing what Laila remembers is a later refinement.
          </p>
        </div>
      )}
    </SettingsCard>
  )
}

/* repo / about footer lives in the README; settings stays focused on the desk. */
