/**
 * Reader-local date formatting. Kept beside the reader components so Wave 5 owns
 * it cleanly without reaching into the shared lib/format (owned elsewhere). Pure
 * and tiny; the `tnum` class handles numeral alignment at the component layer.
 */

/** A full, human date for an issue header: "Monday, June 16, 2026". */
export function fullDate(ts?: number): string {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/** A compact date for list rows: "Jun 16". */
export function shortDate(ts?: number): string {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
