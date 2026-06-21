/**
 * DeskList: "Your desk", the newsletters as rows hung off a single vertical
 * timeline spine (DESIGN_V2.md section 5, shot 01-home). The spine is a 2px
 * var(--line) rule down the left; each row's status dot sits ON it (live green
 * with the sct-ping ring, paused muted, no ping). Each row carries the serif
 * name + voice mono, the field description, a right-aligned Next/Filed mono
 * status, and on hover two actions: a pause/resume toggle and a "File now"
 * accent action-pill that opens the honest generation view.
 *
 * Actions use the existing wiring: pause/resume is a records put() (with a fresh
 * nextSendAt on resume so the chip reads right away); File now calls the existing
 * /api/generate path and routes to /n/:id/run. Reversible actions toast via the
 * V2 ScoutToast. Demo rows render the same UI with no-op actions so the populated
 * preview is faithful without touching the database.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutations } from 'deepspace'
import { Pause, Play, Send } from 'lucide-react'
import { StatusDot } from '../scout/StatusDot'
import { useScoutToast } from '../scout/ScoutToast'
import { voiceDisplay } from './voiceDisplay'
import { generateIssue } from '../../lib/scout-api'
import { computeNextSendAt } from '../../lib/schedule'
import { relativeTime } from '../../lib/format'
import { isDemo } from '../../lib/demo'
import type { Issue, Newsletter } from '../../lib/types'

/** A short forward-looking "Next" stamp: "Tue 7:00" / a date for far out. */
function nextStamp(n: Newsletter): string {
  if (!n.nextSendAt) return n.time || ''
  const d = new Date(n.nextSendAt)
  const day = d.toLocaleDateString(undefined, { weekday: 'short' })
  const time = (n.time || '').trim()
  return time ? `${day} ${time}` : day
}

export function DeskList({
  rows,
}: {
  rows: { recordId: string; data: Newsletter; latestIssue?: { recordId: string; data: Issue } }[]
}) {
  return (
    <div className="relative">
      {/* The single timeline spine. */}
      <span
        className="absolute inset-y-1 left-[3px] w-0.5"
        style={{ background: 'var(--line)' }}
        aria-hidden
      />
      <ul className="flex flex-col">
        {rows.map((r) => (
          <DeskRow key={r.recordId} recordId={r.recordId} data={r.data} latestIssue={r.latestIssue} />
        ))}
      </ul>
    </div>
  )
}

function DeskRow({
  recordId,
  data,
  latestIssue,
}: {
  recordId: string
  data: Newsletter
  latestIssue?: { recordId: string; data: Issue }
}) {
  const navigate = useNavigate()
  const { showToast } = useScoutToast()
  const { put } = useMutations<Newsletter>('newsletters')
  const demo = isDemo()

  // Derive paused straight from the live record, not a local mirror, so a
  // pause/resume that lands from elsewhere (another tab, cron, the reader) keeps
  // this row in sync. The put() below re-renders the row via useQuery.
  const paused = data.status === 'paused'
  const [busy, setBusy] = useState<null | 'pause' | 'file'>(null)

  const name = data.title || 'this beat'
  const filedLabel = data.lastSentAt ? `Filed ${relativeTime(data.lastSentAt)}` : 'Not filed yet'

  async function togglePause(e: React.MouseEvent) {
    e.stopPropagation()
    if (busy) return
    const next = !paused
    setBusy('pause')
    try {
      if (!demo) {
        if (next) {
          await put(recordId, { status: 'paused' })
        } else {
          const when = computeNextSendAt(
            { frequency: data.frequency, days: data.days, time: data.time, timezone: data.timezone },
            Date.now(),
          )
          await put(recordId, { status: 'active', nextSendAt: when ?? undefined })
        }
      }
      showToast(
        next
          ? `${data.title || 'This beat'} paused. I will stay put.`
          : `${data.title || 'This beat'} is live again.`,
      )
    } catch {
      showToast('Could not update that beat. Try again in a moment.')
    } finally {
      setBusy(null)
    }
  }

  async function fileNow(e: React.MouseEvent) {
    e.stopPropagation()
    if (busy || paused) return
    setBusy('file')
    if (demo) {
      showToast(`Sending Laila out on ${data.title || 'this beat'}.`)
      setBusy(null)
      return
    }
    try {
      const { issueId } = await generateIssue(recordId)
      navigate(`/n/${recordId}/run?issue=${issueId}`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not start that issue. Try again.')
      setBusy(null)
    }
  }

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={() => navigate(`/n/${recordId}`)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            navigate(`/n/${recordId}`)
          }
        }}
        className="sct-desk-row group relative flex cursor-pointer items-start gap-4 rounded-[11px] py-4 pl-0 pr-3 transition-colors focus-visible:outline-none focus-visible:ring-2"
        style={{ ['--tw-ring-color' as string]: 'var(--accent-soft)' }}
      >
        {/* The status dot, sitting on the spine. */}
        <span className="relative mt-1 grid w-2 shrink-0 place-items-center" style={{ background: 'var(--bg)' }}>
          <StatusDot state={paused ? 'paused' : 'live'} ping={!paused} size={7} />
        </span>

        {/* Name + voice, then the field description. */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <h3 className="font-serif" style={{ fontSize: '19px', fontWeight: 500, color: 'var(--ink)' }}>
              {data.title || 'Untitled beat'}
            </h3>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--ink3)' }}>
              {voiceDisplay(data.voicePreset)}
            </span>
          </div>
          {data.scope && (
            <p className="mt-1 max-w-[62ch] truncate text-[13.5px]" style={{ color: 'var(--ink2)' }}>
              {data.scope}
            </p>
          )}
        </div>

        {/* Right: the resting Next/Filed status, swapped for actions on hover. */}
        <div className="relative flex shrink-0 items-center self-center" style={{ minWidth: 188, height: 34 }}>
          {/* Resting status (hidden on hover/focus). */}
          <div className="absolute right-0 flex flex-col items-end gap-0.5 text-right transition-opacity duration-150 group-hover:opacity-0 group-focus-within:opacity-0">
            {paused ? (
              <span className="font-mono text-[11px] font-semibold" style={{ color: 'var(--ink3)' }}>
                Paused
              </span>
            ) : (
              <span className="font-mono text-[11px]" style={{ color: 'var(--ink2)' }}>
                Next &middot; <span className="font-semibold" style={{ color: 'var(--ink)' }}>{nextStamp(data)}</span>
              </span>
            )}
            <span className="font-mono text-[10.5px]" style={{ color: 'var(--ink3)' }}>
              {filedLabel}
            </span>
          </div>

          {/* Hover/focus actions. */}
          <div className="absolute right-0 flex items-center gap-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
            <button
              type="button"
              onClick={togglePause}
              aria-label={paused ? `Resume ${name}` : `Pause ${name}`}
              className="sct-icon-btn grid size-[34px] place-items-center rounded-[9px]"
              style={{ border: '1px solid var(--line)', color: 'var(--ink2)' }}
            >
              {paused ? <Play className="size-[15px]" /> : <Pause className="size-[15px]" />}
            </button>
            <button
              type="button"
              onClick={fileNow}
              disabled={paused || busy === 'file'}
              aria-label={`File ${name} now`}
              className="sct-action inline-flex h-[34px] items-center gap-1.5 rounded-[20px] px-3.5 text-[12.5px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              style={{ border: '1px solid var(--accent-line)', background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              <Send className="size-[13px]" />
              File now
            </button>
          </div>
        </div>
      </div>
    </li>
  )
}
