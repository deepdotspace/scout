/**
 * DetailMenu: the hairline overflow menu on the newsletter detail header. Holds
 * the verbs that are not primary actions (Duplicate, Delete) so the product keeps
 * its rule that every verb has a button and no flow is a dead end.
 *
 * Restraint per the press-wire world: a single ghost "..." button opens a small
 * hairline popover (no heavy chrome). Delete confirms inline (a second click on a
 * danger-tinted "Delete this beat" row) rather than a modal, so the destructive
 * path is deliberate without a jarring dialog. The menu closes on outside click,
 * on Escape, and after an action fires.
 */

import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal, Copy, Trash2 } from 'lucide-react'

export function DetailMenu({
  onDuplicate,
  onDelete,
  disabled,
}: {
  onDuplicate: () => void
  onDelete: () => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click or Escape; reset the confirm step on every close.
  useEffect(() => {
    if (!open) {
      setConfirming(false)
      return
    }
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
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More actions"
        className="sct-icon-btn grid size-9 place-items-center rounded-[9px] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink2)' }}
      >
        <MoreHorizontal className="size-[17px]" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1.5 w-[208px] overflow-hidden rounded-[12px] py-1"
          style={{ border: '1px solid var(--line)', background: 'var(--surface)', boxShadow: '0 18px 50px -18px rgba(20,12,2,.34)' }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onDuplicate()
            }}
            className="sct-menu-item flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13.5px] transition-colors"
            style={{ color: 'var(--ink)' }}
          >
            <Copy className="size-[15px]" style={{ color: 'var(--ink3)' }} />
            Duplicate this beat
          </button>

          <div className="my-1 h-px" style={{ background: 'var(--line)' }} aria-hidden />

          {confirming ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onDelete()
              }}
              className="sct-menu-item flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13.5px] font-semibold transition-colors"
              style={{ color: 'var(--color-danger)' }}
            >
              <Trash2 className="size-[15px]" />
              Delete for good?
            </button>
          ) : (
            <button
              type="button"
              role="menuitem"
              onClick={() => setConfirming(true)}
              className="sct-menu-item flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13.5px] transition-colors"
              style={{ color: 'var(--color-danger)' }}
            >
              <Trash2 className="size-[15px]" />
              Delete this beat
            </button>
          )}
        </div>
      )}
    </div>
  )
}
