/**
 * ReaderToolbar: the reader's sticky top bar (DESIGN_V2.md section 7, shots
 * 07 / 28). A back-to-newsletter button on the left; on the right an "Ask Laila"
 * action pill that FOCUSES the companion composer (it opens / closes nothing,
 * per the hard requirement), the reading-type control ("Aa"), a star toggle, and
 * an archive toggle. The pill reads "Ask Laila" (self-evident) while the rail
 * header keeps "Wire back to Laila" and the composer placeholder keeps
 * "Wire back..." (where the metaphor has room to breathe).
 *
 * Hierarchy from type and one hairline. The bar blurs over the page on scroll.
 * The reading-type control is passed in as a slot so the route owns the persisted
 * prefs; the toolbar stays presentational.
 */

import { type ReactNode } from 'react'
import { ChevronLeft, Star, Archive } from 'lucide-react'
import { cn } from '../ui/utils'

export function ReaderToolbar({
  newsletterTitle,
  starred,
  archived,
  onBack,
  onWireBack,
  onToggleStar,
  onToggleArchive,
  typeControl,
}: {
  newsletterTitle?: string
  starred: boolean
  archived: boolean
  onBack: () => void
  /** Focus the composer (does not open / close the rail). */
  onWireBack: () => void
  onToggleStar: () => void
  onToggleArchive: () => void
  /** The reading-type ("Aa") control, owned by the route. */
  typeControl?: ReactNode
}) {
  return (
    <header
      className="sticky top-0 z-20 flex shrink-0 items-center gap-3 px-4 py-3 md:px-6"
      style={{
        background: 'var(--bg-trans)',
        borderBottom: '1px solid var(--line)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <button
        onClick={onBack}
        className="sct-btn-ghost inline-flex h-9 min-w-0 items-center gap-1.5 rounded-[9px] px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2"
        style={{ ['--tw-ring-color' as string]: 'var(--accent-soft)', color: 'var(--ink2)' }}
      >
        <ChevronLeft className="size-4 shrink-0" />
        <span className="truncate">{newsletterTitle || 'The desk'}</span>
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <button
          onClick={onWireBack}
          className="sct-action inline-flex h-9 items-center gap-1.5 rounded-[20px] px-3.5 text-[13px] font-semibold transition-colors"
          style={{
            border: '1px solid var(--accent-line)',
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
          }}
        >
          Ask Laila
        </button>
        {typeControl}
        <IconToggle on={starred} onClick={onToggleStar} label={starred ? 'Unstar' : 'Star'}>
          <Star className="size-[18px]" style={{ fill: starred ? 'var(--accent)' : 'transparent' }} />
        </IconToggle>
        <IconToggle on={archived} onClick={onToggleArchive} label={archived ? 'Unarchive' : 'Archive'}>
          <Archive className="size-[18px]" />
        </IconToggle>
      </div>
    </header>
  )
}

function IconToggle({
  on,
  onClick,
  label,
  children,
}: {
  on: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={on}
      title={label}
      className={cn(
        'grid size-9 place-items-center rounded-[9px] transition-colors focus-visible:outline-none focus-visible:ring-2',
      )}
      style={{
        color: on ? 'var(--accent)' : 'var(--ink3)',
        ['--tw-ring-color' as string]: 'var(--accent-soft)',
      }}
      onMouseEnter={(e) => {
        if (!on) e.currentTarget.style.color = 'var(--ink)'
        e.currentTarget.style.background = 'var(--hover)'
      }}
      onMouseLeave={(e) => {
        if (!on) e.currentTarget.style.color = 'var(--ink3)'
        e.currentTarget.style.background = 'transparent'
      }}
    >
      {children}
    </button>
  )
}
