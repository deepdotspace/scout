/**
 * DetailHeader: one beat's masthead (DESIGN_V2.md section 5, shots
 * 02-newsletter-detail / 03-newsletter-empty / 25-newsletter-accent-moss).
 *
 * A mono status line (Live / next run / last filed), the newsletter name as a
 * serif H1 40/400, the field description in --ink2, and a mono VOICE + RHYTHM
 * meta line. On the right, the accent "File an issue now" CTA plus a Pause/Resume
 * toggle and Edit (both ghost). Hierarchy comes from type and space, no boxes.
 */

import { Pause, Play, Pencil } from 'lucide-react'
import { Button } from '../scout/Button'
import { StatusDot } from '../scout/StatusDot'
import { DetailMenu } from './DetailMenu'
import { voiceDisplay } from '../home/voiceDisplay'
import { rhythmLine } from './rhythm'
import { relativeTime } from '../../lib/format'
import type { Newsletter } from '../../lib/types'

/** A short forward-looking "Tue 7:00" stamp for the next scheduled run. */
function nextStamp(n: Newsletter): string {
  if (!n.nextSendAt) return n.time || ''
  const d = new Date(n.nextSendAt)
  const day = d.toLocaleDateString(undefined, { weekday: 'short' })
  const time = (n.time || '').trim()
  return time ? `${day} ${time}` : day
}

export function DetailHeader({
  newsletter,
  paused,
  busy,
  onFile,
  onTogglePause,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  newsletter: Newsletter
  paused: boolean
  busy: null | 'file' | 'pause' | 'duplicate'
  onFile: () => void
  onTogglePause: () => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const n = newsletter
  const filed = n.lastSentAt ? `Filed ${relativeTime(n.lastSentAt)}` : 'Not filed yet'

  return (
    <header className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        {/* Mono status line: Live/Paused . next run . last filed */}
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5">
            <StatusDot state={paused ? 'paused' : 'live'} ping={!paused} size={7} />
            <span
              className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: paused ? 'var(--ink3)' : 'var(--live)' }}
            >
              {paused ? 'Paused' : 'Live'}
            </span>
          </span>
          {!paused && (
            <>
              <span className="font-mono text-[10px]" style={{ color: 'var(--ink3)' }}>&middot;</span>
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--ink3)' }}>
                Next {nextStamp(n)}
              </span>
            </>
          )}
          <span className="font-mono text-[10px]" style={{ color: 'var(--ink3)' }}>&middot;</span>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--ink3)' }}>
            {filed}
          </span>
        </div>

        {/* Name H1 (serif 40/400) */}
        <h1
          className="mt-3 font-serif"
          style={{ fontSize: '40px', fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.1, color: 'var(--ink)' }}
        >
          {n.title || 'Untitled beat'}
        </h1>

        {/* Field description */}
        {n.scope && (
          <p className="mt-2 max-w-[58ch] text-[15px]" style={{ lineHeight: 1.5, color: 'var(--ink2)' }}>
            {n.scope}
          </p>
        )}

        {/* VOICE + RHYTHM meta line */}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[10.5px] uppercase tracking-[0.14em]">
          <span style={{ color: 'var(--ink3)' }}>
            Voice <span className="ml-1.5" style={{ color: 'var(--ink2)' }}>{voiceDisplay(n.voicePreset)}</span>
          </span>
          <span style={{ color: 'var(--ink3)' }}>
            Rhythm <span className="ml-1.5" style={{ color: 'var(--ink2)' }}>{rhythmLine(n)}</span>
          </span>
        </div>
      </div>

      {/* Right-side actions */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button
          variant="primary"
          onClick={onFile}
          loading={busy === 'file'}
          disabled={busy !== null}
        >
          <Play />
          File an issue now
        </Button>
        <Button variant="ghost" onClick={onTogglePause} loading={busy === 'pause'} disabled={busy !== null}>
          {paused ? <Play /> : <Pause />}
          {paused ? 'Resume' : 'Pause'}
        </Button>
        <Button variant="ghost" onClick={onEdit} disabled={busy !== null}>
          <Pencil />
          Edit
        </Button>
        <DetailMenu onDuplicate={onDuplicate} onDelete={onDelete} disabled={busy !== null} />
      </div>
    </header>
  )
}
