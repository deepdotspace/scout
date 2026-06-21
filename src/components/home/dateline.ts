/**
 * The desk's time-aware greeting + today's dateline, shared by the populated
 * desk (HomeDesk) and the first-run state (FirstRun) so they never drift.
 */

/** "Good morning." / "Good afternoon." / "Good evening." by local hour. */
export function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning.'
  if (h < 18) return 'Good afternoon.'
  return 'Good evening.'
}

/** "Thu, Jun 18" for the mono dateline, top-right. */
export function today(): string {
  return new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}
