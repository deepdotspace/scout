/**
 * ReaderColumn: the dispatch itself, the left/main pane of the two-pane reader
 * (DESIGN_V2.md section 7, shots 07 / 24 / 28). Centered at max-width 680 inside
 * a scrollable column.
 *
 * Top to bottom: a centered LETTERHEAD (mono "Received over the wire" eyebrow,
 * the newsletter name serif 31/600, a mono meta line "Dispatch NN / date / Filed
 * by Laila, in the <Voice> voice" with " / " separators, a 2px solid --ink rule),
 * the serif lead 23/400, then THE WIRE: a vertical spine (with the sct-wire
 * streak) hanging numbered story nodes off it (a 28px accent-ringed circle with a
 * mono numeral, serif title 22/600 + body 18/400 --ink2 + a SourceChip + an
 * "Ask Laila about this" button that seeds the companion), then a dashed-node "What
 * I left out" serif-italic block, then "Shape the next dispatch:" with More / Less
 * like this pills.
 *
 * Pure presentation. The parent owns the seed callback (into the companion
 * composer) and the feedback callback (the tuning signal). Hierarchy from type,
 * space, and one ink rule, not boxes.
 *
 * Reader type: the article reading text (lead, story summaries, the "left out"
 * note) renders in the owner's chosen reading font (var(--reader-font)) and scales
 * off one body anchor (var(--reader-size)); the route sets both vars on the reader
 * container, persisted by useReaderPrefs. Both vars carry safe fallbacks here so
 * this column renders correctly on its own. Headlines keep Newsreader (the
 * editorial brand voice) but scale proportionally with the body so the whole
 * dispatch grows together. The measure stays capped at 680px (~66ch), the
 * research's comfort band, so body text never runs full-bleed.
 */

import { ArrowRight } from 'lucide-react'
import { EyebrowLabel } from '../scout/Eyebrow'
import { SourceChip } from '../scout/SourceChip'
import { Pill } from '../scout/Pill'
import { useReducedMotion } from '../scout/motion'
import { voiceDisplay } from '../home/voiceDisplay'
import { fullDate } from './reader-format'
import type { Issue, IssueSection, Newsletter } from '../../lib/types'

export function ReaderColumn({
  issue,
  newsletter,
  onAsk,
  onShape,
}: {
  issue: Issue
  newsletter?: Newsletter
  /** Seed a question about a story into the companion composer. */
  onAsk: (section: IssueSection, index: number) => void
  /** Steer the next dispatch (the tuning signal). */
  onShape: (direction: 'up' | 'down') => void
}) {
  const reduced = useReducedMotion()
  const voice = voiceDisplay(newsletter?.voicePreset)
  const dateStr = fullDate(issue.generatedAt)
  // The owner's reading font + body anchor (set on the reader container by the
  // route; fall back to the defaults so this column renders standalone). Reading
  // text uses `font` and `body`; headlines scale off `body` via the *RATIO consts.
  const font = 'var(--reader-font, "Newsreader", Georgia, "Times New Roman", serif)'
  const body = 'var(--reader-size, 1.125rem)'
  // The dispatch meta line with " / " separators (DESIGN_V2 section 7).
  const meta = [
    `Dispatch ${issue.number}`,
    dateStr,
    `Filed by Laila, in the ${voice} voice`,
  ]
    .filter(Boolean)
    .join('  /  ')

  return (
    <article className="mx-auto w-full max-w-[680px] px-6 pb-24 pt-12 md:px-10">
      {/* Letterhead (centered). */}
      <header className="text-center">
        <EyebrowLabel className="inline-flex items-center gap-1.5">
          <span style={{ color: 'var(--accent)' }} aria-hidden>
            &bull;
          </span>
          Received over the wire
        </EyebrowLabel>
        <h1
          className="mx-auto mt-3 max-w-[18ch] font-serif"
          style={{ fontSize: '31px', fontWeight: 600, lineHeight: 1.1, color: 'var(--ink)' }}
        >
          {newsletter?.title || 'A dispatch'}
        </h1>
        <p
          className="mt-3 font-mono uppercase"
          style={{ fontSize: '10px', letterSpacing: '0.14em', color: 'var(--ink3)' }}
        >
          {meta}
        </p>
        <div className="mx-auto mt-5 h-0.5 w-full" style={{ background: 'var(--ink)' }} />
      </header>

      {/* The dispatch title (headline voice, Newsreader) + lead (reading text). Both
          scale off the body anchor so the dispatch grows together. */}
      <h2
        className="mt-9 font-serif"
        style={{
          fontSize: `calc(${body} * 1.444)`,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          lineHeight: 1.22,
          color: 'var(--ink)',
        }}
      >
        {issue.title}
      </h2>
      {issue.lead && (
        <p
          className="mt-4"
          style={{
            fontFamily: font,
            fontSize: `calc(${body} * 1.278)`,
            fontWeight: 400,
            letterSpacing: '-0.01em',
            lineHeight: 1.5,
            color: 'var(--ink)',
          }}
        >
          {issue.lead}
        </p>
      )}

      {/* THE WIRE: a vertical spine hanging numbered story nodes. */}
      {issue.sections.length > 0 && (
        <div className="relative mt-12 pl-12">
          {/* The 2px spine with the traveling streak. */}
          <span
            className="pointer-events-none absolute bottom-2 left-[13px] top-2 w-0.5 overflow-hidden"
            style={{ background: 'var(--line)' }}
            aria-hidden
          >
            {!reduced && (
              <span
                className="absolute left-0 h-16 w-full"
                style={{
                  background: 'linear-gradient(to bottom, transparent, var(--accent-line), transparent)',
                  animation: 'sct-wire 3.8s linear infinite',
                }}
              />
            )}
          </span>

          <div className="flex flex-col gap-12">
            {issue.sections.map((s, i) => (
              <Story key={`${i}-${s.headline}`} section={s} index={i} onAsk={onAsk} font={font} body={body} />
            ))}
          </div>
        </div>
      )}

      {/* What I left out (dashed node, serif italic). */}
      <div className="relative mt-12 pl-12">
        <span
          className="absolute left-0 top-0 grid size-7 place-items-center rounded-full"
          style={{ border: '1.5px dashed var(--line)' }}
          aria-hidden
        />
        <EyebrowLabel className="block">What I left out</EyebrowLabel>
        <p
          className="mt-2 italic"
          style={{ fontFamily: font, fontSize: body, fontWeight: 400, lineHeight: 1.6, color: 'var(--ink2)' }}
        >
          The rest was churn. Reprints of the same press release, threads with no source,
          and two stories I could not stand up before filing. If you want, ask me what I
          skipped and why.
        </p>
      </div>

      {/* Shape the next dispatch. */}
      <div className="mt-12 flex flex-wrap items-center gap-3">
        <EyebrowLabel className="w-full sm:w-auto">Shape the next dispatch:</EyebrowLabel>
        <Pill onClick={() => onShape('up')}>More like this</Pill>
        <Pill onClick={() => onShape('down')}>Less like this</Pill>
      </div>
    </article>
  )
}

/** One numbered story node hung off the wire. The headline keeps Newsreader (the
 *  brand voice) and scales off the body anchor; the summary is reading text in the
 *  chosen font at the body size. */
function Story({
  section,
  index,
  onAsk,
  font,
  body,
}: {
  section: IssueSection
  index: number
  onAsk: (section: IssueSection, index: number) => void
  /** The chosen reading font stack (a var(--reader-font) reference). */
  font: string
  /** The body size anchor (a var(--reader-size) reference). */
  body: string
}) {
  return (
    <section className="relative">
      {/* The accent-ringed numeral node (sits over the spine, at pl-12). */}
      <span
        className="absolute grid size-7 place-items-center rounded-full font-mono"
        style={{
          left: '-46px',
          top: '2px',
          border: '1.5px solid var(--accent-line)',
          background: 'var(--surface)',
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--accent)',
        }}
        aria-hidden
      >
        {index + 1}
      </span>

      <h3
        className="font-serif"
        style={{
          fontSize: `calc(${body} * 1.222)`,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          lineHeight: 1.3,
          color: 'var(--ink)',
        }}
      >
        {section.headline}
      </h3>
      {section.summary && (
        <p
          className="mt-2.5"
          style={{ fontFamily: font, fontSize: body, fontWeight: 400, lineHeight: 1.6, color: 'var(--ink2)' }}
        >
          {section.summary}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        {section.sourceUrl ? (
          <SourceChip href={section.sourceUrl}>{section.sourceName || 'Source'}</SourceChip>
        ) : (
          <SourceChip>{section.sourceName || 'Source unavailable'}</SourceChip>
        )}
        <button
          type="button"
          onClick={() => onAsk(section, index)}
          className="inline-flex items-center gap-1.5 font-sans font-medium transition-colors duration-150"
          style={{ fontSize: '12.5px', color: 'var(--ink3)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink3)')}
        >
          <ArrowRight className="size-3.5" />
          Ask Laila about this
        </button>
      </div>
    </section>
  )
}
