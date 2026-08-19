/**
 * Domain-filter hygiene.
 *
 * The reader's "preferred / blocked sites" flow straight into Exa's
 * includeDomains / excludeDomains. Exa 400s (INVALID_DOMAIN) on anything without
 * a real top-level domain, e.g. a bare "x" (someone typing "x" meaning x.com).
 * Because that filter is applied to EVERY query in a run, one bad entry fails the
 * whole run and produces a misleading "no sources found for this scope". We
 * normalize and drop invalid entries at both the input (on save) and the
 * provider boundary (right before the Exa call), so bad data can never break
 * generation.
 *
 * We never fabricate a TLD: a bare "x" is dropped, not turned into "x.com", so we
 * never silently search a site the reader did not ask for. Dropping a filter just
 * widens the search (more sources), which is the safe failure direction.
 */

/**
 * A hostname: dot-joined labels ending in a >= 2-letter TLD, no spaces/underscores.
 * Each label must start AND end alphanumeric (RFC 1123), so "-reddit.com" and
 * "reddit-.com" are rejected. Those are exactly the shapes Exa 400s on, and
 * letting them through would re-open the bug this module exists to close.
 */
const HOSTNAME = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/

/** Normalize one raw entry to a bare hostname, or null if it is not a real domain. */
export function normalizeDomain(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  let d = raw.trim().toLowerCase()
  if (!d) return null
  d = d
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '') // scheme://
    .replace(/[/?#].*$/, '') // path / query / fragment
    .replace(/:\d+$/, '') // :port
    .replace(/^www\./, '') // leading www.
    .replace(/\.$/, '') // trailing root dot
  if (!HOSTNAME.test(d)) return null
  return d
}

/** Normalize a list: clean each entry, drop the invalid, dedupe (order-stable). */
export function normalizeDomains(list: readonly unknown[] | undefined | null): string[] {
  if (!list?.length) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of list) {
    const d = normalizeDomain(raw)
    if (d && !seen.has(d)) {
      seen.add(d)
      out.push(d)
    }
  }
  return out
}

/**
 * Parse a free-text field ("arxiv.org, openai.com") into clean domains.
 *
 * Splits on whitespace as well as commas/semicolons/pipes: space-separated is
 * how people actually type two domains, and treated as one token it normalizes
 * to nothing, silently clearing the field the reader just filled in.
 */
export function parseDomainList(input: string): string[] {
  return normalizeDomains(input.split(/[\s,;|]+/))
}
