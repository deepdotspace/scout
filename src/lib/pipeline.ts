/**
 * The generation pipeline as small, separately testable stages:
 *   scope   -> queries   (Haiku, src/lib/ai)
 *   discover -> candidates (Exa + Firecrawl, deduped by url)
 *   sift    -> kept       (Haiku batch relevance + dedupe, top N)
 *   compose -> issue      (Sonnet, persona + tuning, structured + validated)
 *
 * The job (src/jobs.ts) chunks discover across ticks (searchesPerTick); sift is
 * a single pass that judges the kept candidates in judgeBatchSize batches. The
 * pure helpers here (dedupeByUrl, siftVerdicts) are unit-tested, compose is the
 * one Sonnet call and parses through report-shape so a malformed response never
 * throws.
 */

import { generateText } from 'ai'
import { createDeepSpaceAI } from 'deepspace/worker'
import { MODELS, FUNNEL, RECENCY_DAYS } from '../config'
import { buildComposePrompt } from '../prompts'
import { resolvePersona } from '../personas'
import { judgeCandidates, type JudgeVerdict } from './ai'
import { parseComposeOutput, type IssueDraft } from './report-shape'
import {
  searchExa,
  searchFirecrawl,
  type IntegrationCall,
  type SourceItem,
  type SourceResult,
} from './sources'

type AiEnv = Parameters<typeof createDeepSpaceAI>[0]

/** The subset of a newsletter row the pipeline reads. */
export interface NewsletterConfig {
  scope: string
  angle?: string
  voicePreset?: string
  voiceCustomPrompt?: string
  recencyWindow: string
  location?: string
  preferredDomains?: string[]
  blockedDomains?: string[]
  preferences?: string[]
}

export function recencyDaysFor(window: string): number {
  return RECENCY_DAYS[window] ?? 7
}

// ---------------------------------------------------------------------------
// discover
// ---------------------------------------------------------------------------

/** Dedupe source items by url, keeping the first (and the one with longer text on a tie). */
export function dedupeByUrl(items: SourceItem[]): SourceItem[] {
  const byUrl = new Map<string, SourceItem>()
  for (const item of items) {
    if (!item.url) continue
    const existing = byUrl.get(item.url)
    if (!existing || item.text.length > existing.text.length) byUrl.set(item.url, item)
  }
  return [...byUrl.values()]
}

const FORUM_SITES = ['reddit.com', 'news.ycombinator.com']

/**
 * Run one search across Exa (general web) and, when the query reads like a
 * community/opinion query, Firecrawl forums. Errors are collected, not thrown,
 * so one failed provider does not kill discovery; the caller decides whether an
 * all-empty discover is an honest "no sources" or a masked outage.
 */
export async function discoverForQuery(
  call: IntegrationCall,
  cfg: NewsletterConfig,
  query: string,
): Promise<{ items: SourceItem[]; errors: string[] }> {
  const recencyDays = recencyDaysFor(cfg.recencyWindow)
  const errors: string[] = []
  const items: SourceItem[] = []

  const exa: SourceResult = await searchExa(call, {
    query,
    numResults: FUNNEL.exaResultsPerQuery,
    recencyDays,
    textMaxChars: 2000,
    includeDomains: cfg.preferredDomains,
    blockedDomains: cfg.blockedDomains,
  })
  items.push(...exa.results)
  if (exa.error) errors.push(`exa "${query}": ${exa.error}`)

  // Forums add community voice; skip if the reader pinned preferred domains.
  if (!cfg.preferredDomains?.length) {
    for (const site of FORUM_SITES) {
      const fc = await searchFirecrawl(call, {
        query,
        site,
        limit: FUNNEL.firecrawlResultsPerQuery,
        recencyDays,
      })
      items.push(...fc.results)
      if (fc.error) errors.push(`firecrawl ${site} "${query}": ${fc.error}`)
    }
  }

  return { items, errors }
}

// ---------------------------------------------------------------------------
// sift
// ---------------------------------------------------------------------------

/**
 * Apply judge verdicts to candidates: drop below the score threshold, drop
 * flagged duplicates (keeping the higher-scoring of a duplicate pair), sort by
 * score then recency, and keep up to maxKept. Pure: no I/O.
 */
export function siftVerdicts(candidates: SourceItem[], verdicts: JudgeVerdict[]): SourceItem[] {
  const scored = candidates.map((item, i) => ({
    item,
    score: verdicts[i]?.score ?? 0,
    duplicateOf: verdicts[i]?.duplicateOf ?? null,
  }))

  const dropped = new Set<number>()
  scored.forEach((s, i) => {
    if (s.duplicateOf == null) return
    const other = scored[s.duplicateOf]
    if (!other) return
    // Keep the higher score; drop the lower (drop self on a tie).
    if (s.score <= other.score) dropped.add(i)
    else dropped.add(s.duplicateOf)
  })

  return scored
    .filter((s, i) => !dropped.has(i) && s.score >= FUNNEL.scoreThreshold)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return recencyMs(b.item.publishedAt) - recencyMs(a.item.publishedAt)
    })
    .slice(0, FUNNEL.maxKept)
    .map((s) => s.item)
}

function recencyMs(publishedAt: string | null): number {
  if (!publishedAt) return 0
  const n = Date.parse(publishedAt)
  return Number.isNaN(n) ? 0 : n
}

/** Judge a flat candidate list in batches and sift to the kept set. */
export async function siftCandidates(
  env: AiEnv,
  scope: string,
  candidates: SourceItem[],
): Promise<SourceItem[]> {
  const verdicts: JudgeVerdict[] = []
  for (let i = 0; i < candidates.length; i += FUNNEL.judgeBatchSize) {
    const batch = candidates.slice(i, i + FUNNEL.judgeBatchSize)
    const batchVerdicts = await judgeCandidates(env, {
      scope,
      candidates: batch.map((c) => ({ title: c.title, text: c.text, publishedAt: c.publishedAt })),
    })
    // duplicateOf is batch-local; re-base to the flat index.
    for (const v of batchVerdicts) {
      verdicts.push({ score: v.score, duplicateOf: v.duplicateOf == null ? null : v.duplicateOf + i })
    }
  }
  return siftVerdicts(candidates, verdicts)
}

// ---------------------------------------------------------------------------
// compose
// ---------------------------------------------------------------------------

/** Format the kept stories as compact, numbered source blocks for the compose prompt. */
export function buildSourcesBlock(kept: SourceItem[]): string {
  return kept
    .map((s, i) => {
      const date = s.publishedAt ? `\nDate: ${s.publishedAt}` : ''
      return [
        `[${i + 1}] ${s.title}`,
        `Source: ${s.sourceName}`,
        `URL: ${s.url}${date}`,
        s.text.slice(0, FUNNEL.composeTextPerStory),
      ].join('\n')
    })
    .join('\n\n')
}

export interface ComposeResult {
  issue: IssueDraft | null
  rawText: string
}

/**
 * The one Sonnet call. Writes the issue from the kept stories in the reader's
 * voice, honoring their tuning notes. Returns the validated IssueDraft (null if
 * the model produced nothing usable) plus the raw text for diagnostics.
 */
export async function composeIssue(
  env: AiEnv,
  cfg: NewsletterConfig,
  kept: SourceItem[],
): Promise<ComposeResult> {
  const anthropic = createDeepSpaceAI(env, 'anthropic')
  const system = buildComposePrompt(
    resolvePersona(cfg.voicePreset, cfg.voiceCustomPrompt),
    cfg.preferences ?? [],
  )
  const prompt = [
    `Newsletter scope: ${cfg.scope}`,
    cfg.angle ? `Angle: ${cfg.angle}` : '',
    '',
    `Sources (${kept.length}):`,
    buildSourcesBlock(kept),
  ]
    .filter(Boolean)
    .join('\n')

  const { text } = await generateText({
    model: anthropic(MODELS.sonnet),
    system,
    prompt,
    maxOutputTokens: MODELS.composeMaxOutputTokens,
  })

  return { issue: parseComposeOutput(text), rawText: text }
}
