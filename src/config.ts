/**
 * Scout engine config: the single editable source for model ids, pipeline
 * caps, and per-issue cost. A redeployer tunes numbers here without hunting
 * through code. Prompts live in src/prompts; voice fragments in src/personas.
 *
 * Cost is marked TODO until verified against real DeepSpace billing (Exa +
 * Firecrawl per-search and Anthropic per-call rates).
 */

export const MODELS = {
  // Cheap bulk passes: query generation, batch relevance judging, scout's-read.
  haiku: 'claude-haiku-4-5',
  // The craft: composing the issue, and the companion chat.
  sonnet: 'claude-sonnet-4-6',
  // A JSON array of ~6 queries needs more room than a single short answer, or
  // the array truncates with no closing bracket and parses to [].
  queryGenMaxOutputTokens: 512,
  // Scout's-read returns a small structured object.
  scoutsReadMaxOutputTokens: 700,
  // Gated profile extraction returns a small JSON delta of durable facts.
  profileExtractMaxOutputTokens: 700,
  // Batch judging returns one verdict per candidate; needs room for the array.
  judgeMaxOutputTokens: 1500,
  // Compose writes a full issue (lead + up to ~15 sections); give it real room.
  composeMaxOutputTokens: 4000,
  // The companion is a chat turn: a few paragraphs, not a full issue.
  companionMaxOutputTokens: 1200,
  // The companion agentic loop: up to 3 web-tool round-trips, then a final answer.
  companionMaxSteps: 4,
} as const

export const FUNNEL = {
  // Haiku turns the scope into this many search queries.
  maxQueries: 6,
  // Exa results per query (general web/news/blogs).
  exaResultsPerQuery: 8,
  // Firecrawl results per forum query.
  firecrawlResultsPerQuery: 8,
  // Hard ceiling on candidates carried into the sift stage (bounds Haiku spend).
  maxCandidates: 60,
  // Candidates scored per Haiku judge call.
  judgeBatchSize: 12,
  // Relevance score (0 to 1) below which a candidate is dropped before compose.
  scoreThreshold: 0.55,
  // Stories kept for the final issue (compose input is bounded to these).
  maxKept: 14,
  // Characters of Exa body text passed per candidate into compose (bounds Sonnet input).
  composeTextPerStory: 1200,
  // Job chunking: stay under the Worker subrequest ceiling per alarm tick.
  searchesPerTick: 8,
} as const

/**
 * How often the scan-due cron task sweeps for newsletters whose slot has
 * arrived. One source of truth: src/cron.ts registers the task at this
 * interval, and config-health uses it to decide how far past its slot an
 * active beat has to be before the scanner is provably not running.
 */
export const SCAN_INTERVAL_MINUTES = 15

// Recency window option -> days back for the search startPublishedDate / after:.
export const RECENCY_DAYS: Record<string, number> = {
  '24h': 1,
  '3d': 3,
  '7d': 7,
  '30d': 30,
}

// Per-issue cost is derived, not hardcoded: estimateIssueModelCents() in
// src/lib/config-health.ts prices the Haiku + Sonnet calls off the FUNNEL caps
// above. It is the single source of truth; jobs.ts and the Settings panel both
// call it. (Exa/Firecrawl search spend is an unpriced extra, called out there.)
