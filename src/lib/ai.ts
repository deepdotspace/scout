/**
 * Thin AI helpers over the DeepSpace proxy. Each function owns one model call,
 * its own token budget, and its own defensive parse so the pipeline stages stay
 * small. Haiku does the bulk passes (queries, judging, scout's-read); Sonnet
 * does compose (in pipeline.ts). All calls omit authToken, so they fall back to
 * APP_OWNER_JWT and the owner is billed (single-user app).
 */

import { generateText } from 'ai'
import { createDeepSpaceAI } from 'deepspace/worker'
import { MODELS } from '../config'
import { PROMPTS } from '../prompts'
import { tryParseJsonLenient } from './report-shape'

type AiEnv = Parameters<typeof createDeepSpaceAI>[0]

export interface ScoutsRead {
  scope: string
  angle: string
  exampleSources: string[]
  assumptions: string[]
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean)
}

/** scout's-read: a rough topic becomes a sharp scope + example sources + stated assumptions. */
export async function runScoutsRead(env: AiEnv, topic: string): Promise<ScoutsRead> {
  const anthropic = createDeepSpaceAI(env, 'anthropic')
  const { text } = await generateText({
    model: anthropic(MODELS.haiku),
    system: PROMPTS.scoutsRead,
    prompt: `Rough topic from the person:\n${topic}`,
    maxOutputTokens: MODELS.scoutsReadMaxOutputTokens,
  })
  const parsed = tryParseJsonLenient(text)
  const o = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>
  return {
    scope: typeof o.scope === 'string' ? o.scope.trim() : topic.trim(),
    angle: typeof o.angle === 'string' ? o.angle.trim() : '',
    exampleSources: asStringArray(o.exampleSources),
    assumptions: asStringArray(o.assumptions),
  }
}

/** queryGen: a scope becomes a small set of non-overlapping web queries. */
export async function generateQueries(
  env: AiEnv,
  args: { scope: string; angle?: string; recencyWindow: string; location?: string },
  max: number,
): Promise<string[]> {
  const anthropic = createDeepSpaceAI(env, 'anthropic')
  const lines = [
    `Scope: ${args.scope}`,
    args.angle ? `Angle: ${args.angle}` : '',
    `Recency window: ${args.recencyWindow}`,
    args.location ? `Location: ${args.location}` : '',
  ].filter(Boolean)
  const { text } = await generateText({
    model: anthropic(MODELS.haiku),
    system: PROMPTS.queryGen,
    prompt: lines.join('\n'),
    maxOutputTokens: MODELS.queryGenMaxOutputTokens,
  })
  return asStringArray(tryParseJsonLenient(text)).slice(0, max)
}

export interface JudgeVerdict {
  score: number
  duplicateOf: number | null
}

function clamp01(n: unknown): number {
  const v = typeof n === 'number' ? n : parseFloat(String(n))
  if (!Number.isFinite(v)) return 0
  return Math.max(0, Math.min(1, v))
}

/**
 * relevanceJudge: score a batch of candidates 0 to 1 against the scope and flag
 * near-duplicates. Returns a verdict array aligned 1:1 with `candidates`;
 * missing or invalid entries default to score 0.
 */
export async function judgeCandidates(
  env: AiEnv,
  args: { scope: string; candidates: { title: string; text: string; publishedAt: string | null }[] },
): Promise<JudgeVerdict[]> {
  const { candidates } = args
  const empty = (): JudgeVerdict[] => candidates.map(() => ({ score: 0, duplicateOf: null }))
  if (candidates.length === 0) return []

  const anthropic = createDeepSpaceAI(env, 'anthropic')
  const lines = [`Scope: ${args.scope}`, '', 'Candidates:']
  candidates.forEach((c, i) => {
    const date = c.publishedAt ? ` | Date: ${c.publishedAt}` : ''
    lines.push(`[${i}] ${c.title}${date}\n${c.text.slice(0, 700)}`)
  })

  const { text } = await generateText({
    model: anthropic(MODELS.haiku),
    system: PROMPTS.relevanceJudge,
    prompt: lines.join('\n'),
    maxOutputTokens: MODELS.judgeMaxOutputTokens,
  })

  const arr = tryParseJsonLenient(text)
  if (!Array.isArray(arr)) return empty()
  const out = empty()
  for (const v of arr) {
    if (!v || typeof v !== 'object') continue
    const obj = v as Record<string, unknown>
    const i = typeof obj.i === 'number' ? obj.i : parseInt(String(obj.i), 10)
    if (!Number.isInteger(i) || i < 0 || i >= candidates.length) continue
    const dup = obj.duplicateOf
    const duplicateOf =
      typeof dup === 'number' && Number.isInteger(dup) && dup >= 0 && dup < candidates.length && dup !== i
        ? dup
        : null
    out[i] = { score: clamp01(obj.score), duplicateOf }
  }
  return out
}
