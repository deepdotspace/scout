/**
 * StatusDot: a 7px state dot. `live` shows the green filing dot with the sct-ping
 * expanding ring; `paused` is a muted --ink3 dot with no ping. `accent` paints
 * the dot in the live accent (used for the featured-card / nav-row markers).
 * Motion collapses to a static dot under prefers-reduced-motion (the keyframe
 * sweep in styles.css handles that). (DESIGN_V2.md sections 5, 6.)
 */

import { cn } from '../ui/utils'

type DotState = 'live' | 'paused' | 'accent'

export function StatusDot({
  state = 'live',
  ping = true,
  size = 7,
  className,
}: {
  state?: DotState
  /** Show the expanding ping ring (only meaningful for live/accent). */
  ping?: boolean
  size?: number
  className?: string
}) {
  const color =
    state === 'paused' ? 'var(--ink3)' : state === 'accent' ? 'var(--accent)' : 'var(--live)'
  const showPing = ping && state !== 'paused'

  return (
    <span
      className={cn('relative inline-flex shrink-0', className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {showPing && (
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background: color,
            animation: 'sct-ping 2.8s ease-out infinite',
          }}
        />
      )}
      <span className="relative inline-flex rounded-full" style={{ width: size, height: size, background: color }} />
    </span>
  )
}
