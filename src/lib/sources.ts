/**
 * Source discovery through the DeepSpace integration proxy (owner-billed via
 * APP_OWNER_JWT, so `call` is `ctx.integrations.call`).
 *
 * Exa is the general web/news/blog layer: it returns clean full text and real
 * publish dates, which is exactly what compose needs. Firecrawl covers forums
 * (site: searches) where Exa 403s on includeDomains:['reddit.com'].
 *
 * The proxy masks provider failures to a generic 502 and wraps the results
 * array unpredictably, so we locate results defensively and, when there are
 * none, surface WHY (the provider error message) rather than swallowing it to a
 * silent empty list. A caller that gets `{ results: [], error }` can record an
 * honest run error instead of writing an empty issue with no explanation.
 */

export interface SourceItem {
  url: string
  title: string
  text: string
  publishedAt: string | null
  source: 'exa' | 'firecrawl'
  sourceName: string
}

export interface SourceResult {
  results: SourceItem[]
  /** Present only when the call failed or was masked; null on a real empty. */
  error: string | null
}

export type IntegrationCall = (endpoint: string, params?: Record<string, unknown>) => Promise<unknown>

function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/** The provider error the proxy hands back (it masks the real cause to a generic 502). */
function providerError(res: unknown): string | null {
  if (!res || typeof res !== 'object') return null
  const o = res as Record<string, unknown>
  if ('success' in o && o.success === false) {
    return asString(o.error) || asString(o.message) || 'integration call failed (success:false)'
  }
  return null
}

// ---------------------------------------------------------------------------
// Exa
// ---------------------------------------------------------------------------

interface RawExa {
  url?: unknown
  title?: unknown
  publishedDate?: unknown
  text?: unknown
}

/** Locate the Exa results array however the proxy wrapped it. */
function extractExa(res: unknown): RawExa[] | null {
  if (!res || typeof res !== 'object') return null
  const obj = res as Record<string, unknown>
  if ('success' in obj && obj.success === false) return null
  const data = obj.data as Record<string, unknown> | undefined
  const candidates: unknown[] = [
    data?.results,
    obj.results,
    (data?.data as Record<string, unknown> | undefined)?.results,
  ]
  for (const c of candidates) if (Array.isArray(c)) return c as RawExa[]
  return null
}

export interface ExaOpts {
  query: string
  numResults: number
  recencyDays: number
  textMaxChars: number
  includeDomains?: string[]
  blockedDomains?: string[]
}

/** One exa/search for general web/news/blog discovery. Returns text-bearing results. */
export async function searchExa(call: IntegrationCall, opts: ExaOpts): Promise<SourceResult> {
  const body: Record<string, unknown> = {
    query: opts.query,
    numResults: opts.numResults,
    type: 'auto',
    contents: { text: { maxCharacters: opts.textMaxChars } },
  }
  if (opts.recencyDays > 0) {
    body.startPublishedDate = new Date(Date.now() - opts.recencyDays * 86400000).toISOString()
  }
  if (opts.includeDomains?.length) body.includeDomains = opts.includeDomains
  if (opts.blockedDomains?.length) body.excludeDomains = opts.blockedDomains

  let res: unknown
  try {
    res = await call('exa/search', body)
  } catch (err) {
    return { results: [], error: `exa/search threw: ${errMsg(err)}` }
  }

  const raw = extractExa(res)
  if (!raw) return { results: [], error: providerError(res) }

  const blocked = new Set((opts.blockedDomains ?? []).map((d) => d.toLowerCase()))
  const results: SourceItem[] = []
  for (const r of raw) {
    const url = asString(r.url)
    if (!url) continue
    const host = hostOf(url)
    if (host && blocked.has(host)) continue
    results.push({
      url,
      title: asString(r.title),
      text: asString(r.text),
      publishedAt: typeof r.publishedDate === 'string' ? r.publishedDate : null,
      source: 'exa',
      sourceName: host || 'web',
    })
  }
  return { results, error: null }
}

// ---------------------------------------------------------------------------
// Firecrawl (forums via site: search)
// ---------------------------------------------------------------------------

interface RawFire {
  url?: unknown
  title?: unknown
  description?: unknown
  markdown?: unknown
  metadata?: unknown
}

/** Locate the Firecrawl results array (it can be {data:{data:[...]}} or {data:[...]} or {results:[...]}). */
function extractFire(res: unknown): RawFire[] | null {
  if (!res || typeof res !== 'object') return null
  const obj = res as Record<string, unknown>
  if ('success' in obj && obj.success === false) return null
  const inner = obj.data as Record<string, unknown> | unknown[] | undefined
  const candidates: unknown[] = [
    obj.data,
    Array.isArray(inner) ? inner : (inner as Record<string, unknown> | undefined)?.data,
    obj.results,
  ]
  for (const c of candidates) if (Array.isArray(c)) return c as RawFire[]
  return null
}

/** Google's after:YYYY-MM-DD recency operator (works through Firecrawl search). */
function afterOperator(recencyDays: number): string {
  if (recencyDays <= 0) return ''
  const d = new Date(Date.now() - recencyDays * 86400000)
  return ` after:${d.toISOString().slice(0, 10)}`
}

export interface FirecrawlOpts {
  query: string
  site: string // e.g. 'reddit.com'
  limit: number
  recencyDays: number
}

/**
 * One firecrawl/search scoped to a forum via site:. Reddit bodies are not
 * returned (scrape is blocked there), so the text is the Google snippet
 * (metadata.description). That is enough for the judge; compose still cites the
 * real thread url.
 */
export async function searchFirecrawl(call: IntegrationCall, opts: FirecrawlOpts): Promise<SourceResult> {
  const query = `${opts.query} site:${opts.site}${afterOperator(opts.recencyDays)}`

  let res: unknown
  try {
    res = await call('firecrawl/search', { query, limit: opts.limit })
  } catch (err) {
    return { results: [], error: `firecrawl/search threw: ${errMsg(err)}` }
  }

  const raw = extractFire(res)
  if (!raw) return { results: [], error: providerError(res) }

  const results: SourceItem[] = []
  for (const r of raw) {
    const meta = (r.metadata as Record<string, unknown>) || {}
    const url = asString(r.url) || asString(meta.sourceURL)
    if (!url) continue
    const description = asString(r.description) || asString(meta.description) || asString(r.markdown)
    results.push({
      url,
      title: asString(r.title) || asString(meta.title),
      text: description,
      publishedAt: typeof meta.publishedTime === 'string' ? meta.publishedTime : null,
      source: 'firecrawl',
      sourceName: hostOf(url) || opts.site,
    })
  }
  return { results, error: null }
}

export function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
