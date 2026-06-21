/**
 * The Scout mark: a compass-star glyph in the live accent. The wordmark pairs it
 * with "Scout" set in Newsreader (the editorial serif). One rationed accent.
 * The glyph reads as a reporter's compass-star, the bureau's mark.
 */

import { cn } from '../ui/utils'

export function ScoutMark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={cn('shrink-0', className)}
    >
      {/* Four-point compass star with thin diagonal rays and a center node. */}
      <path
        d="M16 2 L18.4 13.6 L30 16 L18.4 18.4 L16 30 L13.6 18.4 L2 16 L13.6 13.6 Z"
        fill="var(--accent)"
      />
      <path
        d="M16 7 L17 15 L25 16 L17 17 L16 25 L15 17 L7 16 L15 15 Z"
        fill="var(--surface)"
        opacity="0.55"
      />
      <circle cx="16" cy="16" r="2.4" fill="var(--accent)" />
    </svg>
  )
}

export function ScoutWordmark({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <ScoutMark size={22} />
      <span
        className="font-serif font-semibold tracking-tight"
        style={{ fontSize: '22px', color: 'var(--ink)' }}
      >
        Scout
      </span>
    </span>
  )
}
