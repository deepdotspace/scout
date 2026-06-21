/**
 * Deterministic text guard against em / en dashes in anything a reader sees.
 *
 * The compose prompt bans these dashes (they read as AI-generated), but a model
 * still slips one in now and then. stripDashes is the belt to that prompt's
 * suspenders: a pure, reusable pass that removes them and substitutes natural
 * punctuation, so even a slip never ships. It runs on every user-visible field
 * of a composed issue (see report-shape.ts), which is the one place both the web
 * issue and the email render from. The companion can reuse it later.
 *
 * Characters handled:
 *   U+2014 em dash      (long dash, almost always a clause break in prose)
 *   U+2013 en dash      (range between numbers, or a clause break elsewhere)
 *   U+2015 horizontal bar (treated like an em dash)
 */

const EM_OR_BAR = /\s*[—―]\s*/g // em dash / horizontal bar, with any surrounding spaces
const EN_BETWEEN_DIGITS = /(\d)\s*–\s*(\d)/g // numeric range like 10-20
const EN_DASH = /\s*–\s*/g // any remaining en dash, with any surrounding spaces

/**
 * Remove em dashes, en dashes, and the horizontal bar, replacing each with
 * natural punctuation. Pure: returns the input unchanged when it has no such
 * dash. Never produces broken punctuation (no doubled commas, no space before a
 * comma, no leading or trailing comma, no double spaces).
 *
 * Rules:
 *   - em dash / horizontal bar (any surrounding spaces) becomes ", "
 *   - en dash between digits (a range) becomes a plain hyphen "-"
 *   - en dash elsewhere (any surrounding spaces) becomes ", "
 * Then the result is normalized so the substituted comma always reads cleanly.
 */
export function stripDashes(text: string): string {
  if (!text) return text

  let out = text
    .replace(EM_OR_BAR, ', ')
    .replace(EN_BETWEEN_DIGITS, '$1-$2')
    .replace(EN_DASH, ', ')

  // Normalize the substituted commas so nothing reads broken.
  out = out
    .replace(/\s+,/g, ',') // no space before a comma ("word , x" -> "word, x")
    .replace(/,(\s*,)+/g, ',') // collapse a doubled comma ("a,, b" / "a, , b" -> "a, b")
    .replace(/,\s*,/g, ',')
    .replace(/ {2,}/g, ' ') // collapse any double space left behind
    .replace(/^[\s,]+/, '') // drop a leading comma or space
    .replace(/[\s,]+$/, '') // drop a trailing comma or space

  return out
}
