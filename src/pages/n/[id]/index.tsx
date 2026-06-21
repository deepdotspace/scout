/**
 * Newsletter detail (route `/n/:id`). One beat's page (DESIGN_V2.md section 5,
 * shots 02-newsletter-detail / 03-newsletter-empty / 25-newsletter-accent-moss).
 *
 * "The desk" back button, then the header (mono status line, serif name H1, field
 * description, VOICE + RHYTHM meta, and the File-an-issue-now / Pause-Resume / Edit
 * actions), then "BACK ISSUES" and the issue list. When the beat has no issues, a
 * centered elevated empty state invites the first one. Every state present:
 * loading, not-found, error, empty, populated. Hierarchy from type, space, and a
 * single hairline, never boxes.
 *
 * Real data via useQuery (the newsletter by id + its issues). Actions reuse the
 * existing wiring: File now calls /api/generate and routes to /n/:id/run; Pause /
 * Resume is a records put() (with a fresh nextSendAt on resume); Edit opens the
 * create stepper in edit mode; star toggles through the records layer. `?demo=1`
 * renders the visual fixture (no auth, no DB) for screenshots.
 */

import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutations } from 'deepspace'
import { ChevronLeft } from 'lucide-react'
import { EyebrowLabel } from '../../../components/scout/Eyebrow'
import { InlineStatus } from '../../../components/scout/Status'
import { useScoutToast } from '../../../components/scout/ScoutToast'
import { ScoutMark } from '../../../components/scout/Logo'
import { DetailHeader } from '../../../components/newsletter/DetailHeader'
import { BackIssues } from '../../../components/newsletter/BackIssues'
import { DetailEmpty } from '../../../components/newsletter/DetailEmpty'
import { useIssueActions } from '../../../components/reader/useIssueActions'
import { generateIssue } from '../../../lib/scout-api'
import { computeNextSendAt } from '../../../lib/schedule'
import { DEMO_NEWSLETTERS, DEMO_ISSUES, isDemo } from '../../../lib/demo'
import type { Issue, Newsletter } from '../../../lib/types'

export default function NewsletterDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const demo = isDemo()
  const { showToast } = useScoutToast()
  const issueActions = useIssueActions()

  const nlQ = useQuery<Newsletter>('newsletters')
  const issuesQ = useQuery<Issue>('issues')
  const { put, create, remove } = useMutations<Newsletter>('newsletters')

  const record = demo ? DEMO_NEWSLETTERS.find((r) => r.recordId === id) : nlQ.records.find((r) => r.recordId === id)
  const n = record?.data

  const allIssues = demo ? DEMO_ISSUES : issuesQ.records
  const issues = allIssues
    .filter((r) => r.data.newsletterId === id && !r.data.archived)
    .sort((a, b) => (b.data.generatedAt ?? 0) - (a.data.generatedAt ?? 0))

  const [busy, setBusy] = useState<null | 'file' | 'pause' | 'duplicate'>(null)
  const back = () => navigate('/')

  const loading = !demo && nlQ.status === 'loading' && !record

  if (loading) {
    return (
      <Frame onBack={back}>
        <div className="flex flex-1 items-center justify-center">
          <ScoutMark size={24} className="animate-pulse opacity-40" />
        </div>
      </Frame>
    )
  }

  if (!demo && nlQ.status === 'error') {
    return (
      <Frame onBack={back}>
        <InlineStatus tone="danger">
          Could not load this newsletter. Check your connection and reload.
        </InlineStatus>
      </Frame>
    )
  }

  if (!record || !n) {
    return (
      <Frame onBack={back}>
        <InlineStatus tone="warning">
          That newsletter does not exist, or it was deleted. Head back to the desk to pick another.
        </InlineStatus>
      </Frame>
    )
  }

  const paused = n.status === 'paused'

  async function file() {
    if (!record || !n) return
    setBusy('file')
    if (demo) {
      showToast(`Sending Laila out on ${n.title || 'this beat'}.`)
      setBusy(null)
      return
    }
    try {
      const { issueId } = await generateIssue(record.recordId)
      navigate(`/n/${record.recordId}/run?issue=${issueId}`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not start that issue. Try again.')
      setBusy(null)
    }
  }

  async function togglePause() {
    if (!record || !n) return
    setBusy('pause')
    if (demo) {
      showToast(paused ? `${n.title || 'This beat'} is live again.` : `${n.title || 'This beat'} paused. I will stay put.`)
      setBusy(null)
      return
    }
    try {
      if (paused) {
        const next = computeNextSendAt(
          { frequency: n.frequency, days: n.days, time: n.time, timezone: n.timezone },
          Date.now(),
        )
        await put(record.recordId, { status: 'active', nextSendAt: next ?? undefined })
        showToast(`${n.title || 'This beat'} is live again.`)
      } else {
        await put(record.recordId, { status: 'paused' })
        showToast(`${n.title || 'This beat'} paused. I will stay put.`)
      }
    } catch {
      showToast('Could not update that beat. Try again in a moment.')
    } finally {
      setBusy(null)
    }
  }

  function toggleStar(issueId: string, current: boolean) {
    if (demo) {
      showToast(current ? 'Unstarred.' : 'Starred.')
      return
    }
    void issueActions.toggleStar(issueId, current)
  }

  // Duplicate the beat: copy its config to a new active beat and open it. The copy
  // starts clean, no run history, a "(copy)" title, and its own next-send slot.
  async function duplicate() {
    if (!record || !n) return
    if (demo) {
      showToast('Duplicated this beat.')
      return
    }
    setBusy('duplicate')
    try {
      const next = computeNextSendAt(
        { frequency: n.frequency, days: n.days, time: n.time, timezone: n.timezone },
        Date.now(),
      )
      const newId = await create({
        ...n,
        title: `${n.title || 'Untitled beat'} (copy)`,
        status: 'active',
        nextSendAt: next ?? undefined,
        lastSentAt: undefined,
        lastRunStatus: 'idle',
        lastRunError: '',
      })
      showToast('Duplicated this beat.')
      navigate(`/n/${newId}`)
    } catch {
      showToast('Could not duplicate that beat. Try again in a moment.')
      setBusy(null)
    }
  }

  // Delete the beat and return to the desk. The overflow menu confirms first, so
  // this fires only on a deliberate second click.
  async function destroy() {
    if (!record || !n) return
    if (demo) {
      showToast('Deleted this beat.')
      return
    }
    try {
      await remove(record.recordId)
      showToast(`${n.title || 'That beat'} deleted.`)
      navigate('/')
    } catch {
      showToast('Could not delete that beat. Try again in a moment.')
    }
  }

  return (
    <div className="mx-auto w-full max-w-[880px] px-6 py-8 md:px-10 md:py-10">
      {/* The desk back button (centered pill). */}
      <div className="flex justify-center">
        <button
          onClick={back}
          className="sct-btn-ghost inline-flex h-9 items-center gap-1.5 rounded-[9px] px-3.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2"
          style={{ ['--tw-ring-color' as string]: 'var(--accent-soft)' }}
        >
          <ChevronLeft className="size-4" />
          The desk
        </button>
      </div>

      <div className="mt-8">
        <DetailHeader
          newsletter={n}
          paused={paused}
          busy={busy}
          onFile={file}
          onTogglePause={togglePause}
          onEdit={() => navigate(`/n/${record.recordId}/edit`)}
          onDuplicate={duplicate}
          onDelete={destroy}
        />
      </div>

      <section className="mt-12">
        <EyebrowLabel>Back issues</EyebrowLabel>
        <div className="mt-3">
          {!demo && issuesQ.status === 'loading' && issues.length === 0 ? (
            <div className="flex flex-col gap-px">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-[11px]" style={{ background: 'var(--s2)' }} />
              ))}
            </div>
          ) : !demo && issuesQ.status === 'error' ? (
            <InlineStatus tone="danger">Could not load issues. Reload to try again.</InlineStatus>
          ) : issues.length === 0 ? (
            <DetailEmpty
              title={n.title || 'this beat'}
              onFile={file}
              filing={busy === 'file'}
              disabled={busy !== null}
            />
          ) : (
            <BackIssues newsletterId={record.recordId} issues={issues} onToggleStar={toggleStar} />
          )}
        </div>
      </section>
    </div>
  )
}

/** A minimal frame for the loading / not-found / error states. */
function Frame({ children, onBack }: { children: React.ReactNode; onBack: () => void }) {
  return (
    <div className="mx-auto flex h-full w-full max-w-[880px] flex-col px-6 py-8 md:px-10 md:py-10">
      <div className="flex justify-center">
        <button
          onClick={onBack}
          className="sct-btn-ghost inline-flex h-9 items-center gap-1.5 rounded-[9px] px-3.5 text-[13px] font-medium transition-colors"
        >
          <ChevronLeft className="size-4" />
          The desk
        </button>
      </div>
      <div className="mt-8 flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
