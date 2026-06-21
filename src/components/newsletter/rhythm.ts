/**
 * The detail header's RHYTHM meta line. Reads a newsletter's cadence into the
 * wire-machine phrasing from the design (shots 02 / 03 / 25): "Weekdays . 7:00",
 * "Fridays . 18:00", "Saturdays . 9:00". A weekly beat on one day reads as the
 * pluralized weekday ("Saturdays"); multiple days list the abbreviations.
 */

import type { Newsletter } from '../../lib/types'

const WEEKDAY_PLURAL: Record<string, string> = {
  sun: 'Sundays',
  mon: 'Mondays',
  tue: 'Tuesdays',
  wed: 'Wednesdays',
  thu: 'Thursdays',
  fri: 'Fridays',
  sat: 'Saturdays',
}

const WEEKDAY_SHORT: Record<string, string> = {
  sun: 'Sun',
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
}

/** The cadence phrase, without the time. */
function cadence(n: Pick<Newsletter, 'frequency' | 'days'>): string {
  switch (n.frequency) {
    case 'daily':
      return 'Every day'
    case 'weekdays':
      return 'Weekdays'
    case 'weekly':
    case 'custom': {
      const keys = n.days.map((d) => d.slice(0, 3).toLowerCase()).filter((d) => d in WEEKDAY_SHORT)
      if (keys.length === 0) return n.frequency === 'weekly' ? 'Mondays' : 'No days set'
      if (keys.length === 1) return WEEKDAY_PLURAL[keys[0]]
      return keys.map((d) => WEEKDAY_SHORT[d]).join(', ')
    }
  }
}

/** "Saturdays . 9:00": the cadence and the wall-clock send time. */
export function rhythmLine(n: Pick<Newsletter, 'frequency' | 'days' | 'time'>): string {
  const c = cadence(n)
  const time = (n.time || '').trim()
  return time ? `${c} · ${time}` : c
}
