/**
 * useDebouncedValue: returns `value` after it has stayed unchanged for `delayMs`.
 * Used by the Scope step to re-derive Scout's read only once the topic settles,
 * so a fast typist does not trigger an owner-billed scouts-read on every keystroke.
 */

import { useEffect, useState } from 'react'

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])
  return debounced
}
