/**
 * Never-throws parser for the compose model's JSON output.
 *
 * The lenient JSON extractor here is adapted from Deepbrief's report-shape.ts:
 * its job is to recover a JSON value from model text even when the model wraps
 * it in a code fence or pads it with stray prose. Scout's compose output has a
 * fixed, known schema ({ title, lead, sections }), so the generic block-walking
 * renderer from Deepbrief is not needed; we keep only the extractor and add a
 * small validator that coerces the raw value into a clean IssueDraft and drops
 * any section without a real http(s) source url (no fabricated links).
 *
 * Every user-visible prose field (title, lead, each section headline + summary +
 * sourceName) is run through stripDashes here, after JSON.parse so it can never
 * break parsing. This is the one choke point both the web issue and the email
 * render from, so a model that slips in an em or en dash still ships clean prose.
 */

import { stripDashes } from './sanitize'

export interface IssueSection {
  headline: string
  summary: string
  sourceName: string
  sourceUrl: string
  publishedAt?: string
}

export interface IssueDraft {
  title: string
  lead: string
  sections: IssueSection[]
}

/**
 * Recover a JSON value from model text. Tolerant in three ways so a compose
 * call doesn't break on a slightly-off response:
 *   1. plain JSON.parse on the trimmed input
 *   2. strip a wrapping markdown code fence (```json ... ```)
 *   3. extract the first balanced {...} or [...] from the string
 * Returns null when nothing parses; never throws.
 */
export function tryParseJsonLenient(input: string | null | undefined): unknown {
  if (!input) return null
  const trimmed = input.trim()
  if (!trimmed) return null

  try {
    return JSON.parse(trimmed)
  } catch {
    /* fall through */
  }

  const fenced = trimmed.match(/```(?:json|JSON)?\s*([\s\S]*?)```/)
  if (fenced && fenced[1]) {
    try {
      return JSON.parse(fenced[1].trim())
    } catch {
      /* fall through */
    }
  }

  const extracted = extractFirstJsonValue(trimmed)
  if (extracted) {
    try {
      return JSON.parse(extracted)
    } catch {
      /* fall through */
    }
  }

  return null
}

/**
 * Return the substring covering the first balanced JSON value, either {...} or
 * [...]. Tracks string state so braces inside quoted strings do not fool the
 * matcher. Returns null if no balanced value is found.
 */
function extractFirstJsonValue(s: string): string | null {
  const start = s.search(/[{[]/)
  if (start < 0) return null
  const openChar = s[start]
  const closeChar = openChar === '{' ? '}' : ']'
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < s.length; i++) {
    const c = s[i]
    if (escape) {
      escape = false
      continue
    }
    if (c === '\\') {
      escape = true
      continue
    }
    if (c === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (c === openChar) depth++
    else if (c === closeChar) {
      depth--
      if (depth === 0) return s.slice(start, i + 1)
    }
  }
  return null
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/** asString for a user-visible prose field: also strips em / en dashes (never a url or date). */
function asProse(v: unknown): string {
  return stripDashes(asString(v))
}

/** True for a safe http(s) url; everything else (javascript:, data:, '') is rejected. */
export function isHttpUrl(s: unknown): s is string {
  if (typeof s !== 'string') return false
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/** Coerce one raw section object into a clean IssueSection, or null if it has no real source url. */
function toSection(raw: unknown): IssueSection | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const sourceUrl = asString(o.sourceUrl)
  if (!isHttpUrl(sourceUrl)) return null
  const headline = asProse(o.headline)
  const summary = asProse(o.summary)
  if (!headline || !summary) return null
  const publishedAt = asString(o.publishedAt)
  return {
    headline,
    summary,
    sourceName: asProse(o.sourceName) || new URL(sourceUrl).hostname.replace(/^www\./, ''),
    sourceUrl,
    ...(publishedAt ? { publishedAt } : {}),
  }
}

/**
 * Parse the compose model's text into a validated IssueDraft. Never throws.
 * Returns null when the output is unusable (no title/lead, or no section keeps
 * a real source url). Sections without a valid http(s) sourceUrl are dropped so
 * a fabricated or empty link never reaches the reader.
 */
export function parseComposeOutput(text: string | null | undefined): IssueDraft | null {
  const parsed = tryParseJsonLenient(text)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const o = parsed as Record<string, unknown>

  const title = asProse(o.title)
  const lead = asProse(o.lead)
  if (!title || !lead) return null

  const rawSections = Array.isArray(o.sections) ? o.sections : []
  const sections = rawSections.map(toSection).filter((s): s is IssueSection => s !== null)
  if (sections.length === 0) return null

  return { title, lead, sections }
}
