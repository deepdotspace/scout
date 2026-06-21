/**
 * FeaturedDispatch: the single most recent issue, the ONLY elevated card on the
 * desk (DESIGN_V2.md section 5, shot 01-home). A soft two-layer shadow that lifts
 * on hover (translateY(-2px)), an accent status dot with a soft halo, the
 * newsletter name in accent mono with the dispatch number + date, the issue title
 * in serif 27/500, the serif lead, a "Read the issue ->" accent pill that opens
 * the reader, and a mono "N sources . <Voice>" line.
 *
 * Clicking the card body or the pill both open the reader. The byline voice uses
 * the design's desk labels (voiceDisplay), not the picker labels.
 */

import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { EyebrowLabel } from '../scout/Eyebrow'
import { useReducedMotion } from '../scout/motion'
import { voiceDisplay } from './voiceDisplay'
import type { Issue, Newsletter } from '../../lib/types'

/** "Tue, Jun 17" from an epoch (the dispatch dateline). */
function dateline(ts?: number): string {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export function FeaturedDispatch({
  newsletterId,
  newsletter,
  issueId,
  issue,
}: {
  newsletterId: string
  newsletter: Newsletter
  issueId: string
  issue: Issue
}) {
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const open = () => navigate(`/n/${newsletterId}/i/${issueId}`)
  const sourceCount = issue.sections?.length ?? 0

  return (
    <motion.button
      type="button"
      onClick={open}
      whileHover={reduced ? undefined : { y: -2, boxShadow: 'var(--shadow-featured-hover)' }}
      transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
      className="sct-featured block w-full rounded-[18px] p-7 text-left focus-visible:outline-none focus-visible:ring-2"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        boxShadow: 'var(--shadow-featured)',
        ['--tw-ring-color' as string]: 'var(--accent-soft)',
      }}
    >
      {/* Newsletter name in accent mono, with a haloed accent dot + the dispatch dateline */}
      <div className="flex items-center gap-2.5">
        <span className="relative inline-flex size-[7px] shrink-0">
          <span
            className="absolute rounded-full"
            style={{ inset: '-4px', background: 'var(--accent-soft)' }}
            aria-hidden
          />
          <span className="relative inline-flex size-[7px] rounded-full" style={{ background: 'var(--accent)' }} />
        </span>
        <EyebrowLabel accent>{newsletter.title || 'Untitled beat'}</EyebrowLabel>
        <span className="font-mono text-[10px]" style={{ color: 'var(--ink3)' }}>
          Dispatch {issue.number} &middot; {dateline(issue.generatedAt)}
        </span>
      </div>

      {/* Title (serif 27/500) */}
      <h2
        className="mt-3.5 font-serif"
        style={{ fontSize: '27px', fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.18, color: 'var(--ink)' }}
      >
        {issue.title}
      </h2>

      {/* Lead (serif) */}
      {issue.lead && (
        <p className="mt-3 max-w-[58ch] font-serif" style={{ fontSize: '17px', lineHeight: 1.6, color: 'var(--ink2)' }}>
          {issue.lead}
        </p>
      )}

      {/* Read pill + sources/voice line */}
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <span
          className="sct-action inline-flex items-center gap-2 rounded-[20px] px-4 py-2 text-[13px] font-semibold"
          style={{
            border: '1px solid var(--accent-line)',
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
          }}
        >
          Read the issue
          <ArrowRight className="size-[15px]" />
        </span>
        <span className="font-mono text-[11px]" style={{ color: 'var(--ink3)' }}>
          {sourceCount > 0 ? `${sourceCount} sources` : 'Sourced'} &middot; {voiceDisplay(newsletter.voicePreset)}
        </span>
      </div>
    </motion.button>
  )
}
