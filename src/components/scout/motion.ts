/**
 * Motion primitives: the house easing and a reduced-motion hook.
 *
 * DESIGN.md rations motion to four moments (issue arrival, generation metronome,
 * reading reveals, tactile press) on one easing curve, and collapses everything
 * to instant under prefers-reduced-motion.
 */

import { useEffect, useState } from 'react'

/** House easing: a confident ease-out. Same curve everywhere. */
export const EASE = [0.16, 1, 0.3, 1] as const

/** Crisp tactile press for buttons and cards (scale ~0.98). */
export const PRESS = { scale: 0.98 } as const

/** True when the OS asks for reduced motion. Components branch on this. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return reduced
}
