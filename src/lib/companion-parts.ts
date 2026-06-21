/**
 * The shared shape for a persisted / streamed companion turn: an ordered list of
 * text blocks and tool blocks. ONE definition the worker and the client both
 * build from, so a reloaded thread renders identically to the live turn.
 *
 * A tool part is a deliberately trimmed view of a tool call: the tool name, a
 * compact human label (the query for look_it_up, the source name for
 * read_source), and the chip sources the tool surfaced. We never re-feed parts to
 * the model, so the raw exa answer / page text is dropped (useless for render).
 *
 * This module is pure (no DOM, no SDK): the worker imports it to capture parts in
 * onFinish, the client imports it to extract sources and build the live parts.
 */

/** A source Laila used in a turn, surfaced from a tool result for the chips. */
export interface CompanionSource {
  name: string
  url: string
}

/** The web tools Laila can reach for; the label copy differs per tool. */
export type CompanionToolName = 'look_it_up' | 'read_source'

/** One block of a companion turn: prose text, or a tool call with its chips. */
export type ChatPart =
  | { type: 'text'; text: string }
  | {
      type: 'tool'
      toolName: CompanionToolName | string
      /** The compact, past-tense line the rail draws (e.g. `Looked up "..."`). */
      label: string
      /** The chips under the line; may be empty (looked, found nothing). */
      sources: CompanionSource[]
      /**
       * Live only: the tool is still running, so the rail shows the calm pulsing
       * status copy instead of the past-tense note. Persisted parts never set it.
       */
      running?: boolean
    }

const MAX_LABEL_QUERY = 60

/** Trim a long query to a readable label, eliding the tail with a single dot run. */
function elide(text: string, max: number): string {
  const t = text.trim()
  return t.length > max ? `${t.slice(0, max).trimEnd()}...` : t
}

/** A readable host label for a url when a page gives no title. Mirrors the worker. */
export function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Pull the chip sources out of a tool result by the tool that produced it. */
export function sourcesFromToolResult(toolName: string, result: unknown): CompanionSource[] {
  if (!result || typeof result !== 'object') return []
  const r = result as Record<string, unknown>
  if (toolName === 'look_it_up' && Array.isArray(r.sources)) {
    return (r.sources as unknown[])
      .map((s) => (s && typeof s === 'object' ? (s as Record<string, unknown>) : {}))
      .filter((s) => typeof s.url === 'string' && s.url)
      .map((s) => ({ name: typeof s.name === 'string' && s.name ? s.name : (s.url as string), url: s.url as string }))
  }
  if (toolName === 'read_source' && typeof r.url === 'string' && r.url) {
    return [{ name: typeof r.name === 'string' && r.name ? r.name : r.url, url: r.url }]
  }
  return []
}

/**
 * The compact, past-tense label a finished tool call settles to (live and
 * persisted). `input` is the tool's typed input ({ query } / { url }); `sources`
 * are the surfaced chips, used to name a read_source when the input had only a
 * url. No em dashes.
 */
export function toolLabel(toolName: string, input: unknown, sources: CompanionSource[]): string {
  const i = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
  if (toolName === 'look_it_up') {
    const query = typeof i.query === 'string' ? i.query : ''
    return query ? `Looked up "${elide(query, MAX_LABEL_QUERY)}"` : 'Looked it up'
  }
  if (toolName === 'read_source') {
    const url = typeof i.url === 'string' ? i.url : ''
    const name = sources[0]?.name || (url ? hostLabel(url) : '')
    return name ? `Read ${name}` : 'Read the source'
  }
  return 'Checked a source'
}

/** Calm, on-brand copy shown while a web tool runs mid-turn (live only). */
const TOOL_RUNNING_STATUS: Record<string, string> = {
  look_it_up: 'Laila is looking that up',
  read_source: 'Laila is checking the source',
}
export function toolRunningLabel(toolName: string): string {
  return TOOL_RUNNING_STATUS[toolName] ?? 'Laila is checking a source'
}

/**
 * A steps-like shape: only the fields partsFromSteps reads, so the worker can
 * pass AI SDK v5 `StepResult[]` straight in and a test can pass a fixture.
 */
export interface StepLike {
  text?: string
  toolCalls?: Array<{ toolCallId: string; toolName: string; input?: unknown }>
  toolResults?: Array<{ toolCallId: string; toolName?: string; output?: unknown }>
}

/**
 * Build the ordered ChatPart[] for an assistant turn from the run's steps, so the
 * persisted thread matches what streamed. For each step in order: the step text
 * (if any), then each of the step's tool calls as a trimmed tool part, matched to
 * its result by toolCallId for the chip sources. A tool with no usable output
 * still produces an honest part with `sources: []`.
 */
export function partsFromSteps(steps: StepLike[]): ChatPart[] {
  const parts: ChatPart[] = []
  for (const step of steps) {
    if (step.text && step.text.trim()) parts.push({ type: 'text', text: step.text })
    for (const call of step.toolCalls ?? []) {
      const result = (step.toolResults ?? []).find((r) => r.toolCallId === call.toolCallId)
      const sources = sourcesFromToolResult(call.toolName, result?.output)
      parts.push({
        type: 'tool',
        toolName: call.toolName,
        label: toolLabel(call.toolName, call.input, sources),
        sources,
      })
    }
  }
  return parts
}

/** Type guard: a value decoded from the `parts` json column is a usable ChatPart[]. */
export function asChatParts(value: unknown): ChatPart[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (p): p is ChatPart =>
      !!p &&
      typeof p === 'object' &&
      ((p as ChatPart).type === 'text' || (p as ChatPart).type === 'tool'),
  )
}
