/**
 * ReaderTypeControl: the calm "Aa" affordance in the reader toolbar that opens a
 * small hairline popover for picking the reading font and bumping the text size,
 * the Readwise / iA Writer model (docs/research/READER_FONTS.md section 4). It is
 * unobtrusive by design: one ghost icon button that only reveals the menu on
 * click, closes on outside click / Escape, and never overlaps the reading column
 * or the companion rail (it anchors to the toolbar, which sits above both).
 *
 * Restraint per the press-wire world, mirroring DetailMenu: a single button, a
 * hairline popover, no heavy chrome. Each font row previews in its own face so the
 * choice is legible at a glance; the size row is a quiet A- / A+ stepper with the
 * current step named. The active font carries a checkmark, the press-wire accent.
 *
 * Pure control. The parent owns the persisted prefs (useReaderPrefs) and applies
 * the chosen --reader-font / --reader-size on the reader container.
 */

import { useEffect, useRef, useState } from 'react'
import { Check, Minus, Plus } from 'lucide-react'
import { EyebrowLabel } from '../scout/Eyebrow'
import { READER_FONTS, type ReaderPrefs } from './useReaderPrefs'

export function ReaderTypeControl({ prefs }: { prefs: ReaderPrefs }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click or Escape, matching DetailMenu.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Reading type"
        title="Reading type"
        className="grid size-9 place-items-center rounded-[9px] transition-colors focus-visible:outline-none focus-visible:ring-2"
        style={{
          color: open ? 'var(--accent)' : 'var(--ink3)',
          background: open ? 'var(--accent-soft)' : 'transparent',
          ['--tw-ring-color' as string]: 'var(--accent-soft)',
        }}
        onMouseEnter={(e) => {
          if (!open) {
            e.currentTarget.style.color = 'var(--ink)'
            e.currentTarget.style.background = 'var(--hover)'
          }
        }}
        onMouseLeave={(e) => {
          if (!open) {
            e.currentTarget.style.color = 'var(--ink3)'
            e.currentTarget.style.background = 'transparent'
          }
        }}
      >
        {/* "Aa": a serif A and a smaller one, the universal reading-type glyph. */}
        <span className="font-serif leading-none" aria-hidden style={{ fontWeight: 500 }}>
          <span style={{ fontSize: '17px' }}>A</span>
          <span style={{ fontSize: '12px' }}>a</span>
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1.5 w-[244px] overflow-hidden rounded-[12px] p-1.5"
          style={{
            border: '1px solid var(--line)',
            background: 'var(--surface)',
            boxShadow: '0 18px 50px -18px rgba(20,12,2,.34)',
          }}
        >
          {/* Text size: a quiet A- / A+ stepper with the current step named. */}
          <div className="flex items-center gap-2 px-2 pb-1.5 pt-1">
            <EyebrowLabel className="flex-1">Text size</EyebrowLabel>
            <span className="font-sans text-[11px] font-medium" style={{ color: 'var(--ink3)' }}>
              {prefs.size.label}
            </span>
          </div>
          <div className="mb-1 flex items-stretch gap-1.5 px-1">
            <StepButton
              label="Smaller"
              disabled={!prefs.canStepDown}
              onClick={() => prefs.stepSize(-1)}
            >
              <Minus className="size-3.5" />
              <span className="font-serif" style={{ fontSize: '14px' }}>A</span>
            </StepButton>
            <StepButton
              label="Larger"
              disabled={!prefs.canStepUp}
              onClick={() => prefs.stepSize(1)}
            >
              <Plus className="size-3.5" />
              <span className="font-serif" style={{ fontSize: '18px' }}>A</span>
            </StepButton>
          </div>

          <div className="my-1.5 h-px" style={{ background: 'var(--line)' }} aria-hidden />

          {/* Font family: each row previews in its own face. */}
          <div className="px-2 pb-1 pt-0.5">
            <EyebrowLabel>Reading font</EyebrowLabel>
          </div>
          <div role="group">
            {READER_FONTS.map((f) => {
              const active = f.key === prefs.font.key
              return (
                <button
                  key={f.key}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => prefs.setFont(f.key)}
                  className="sct-menu-item flex w-full items-center gap-2 rounded-[8px] px-2 py-2 text-left transition-colors"
                  style={{ color: active ? 'var(--accent)' : 'var(--ink)' }}
                >
                  <span
                    className="flex-1 truncate"
                    style={{ fontFamily: f.stack, fontSize: '15px', lineHeight: 1.1 }}
                  >
                    {f.label}
                  </span>
                  {f.sans && (
                    <span className="font-sans text-[10px]" style={{ color: 'var(--ink3)' }}>
                      Sans
                    </span>
                  )}
                  {active && <Check className="size-4 shrink-0" style={{ color: 'var(--accent)' }} />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="sct-icon-btn flex flex-1 items-center justify-center gap-1 rounded-[8px] py-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
      style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink2)' }}
    >
      {children}
    </button>
  )
}
