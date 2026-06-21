/**
 * Client plumbing for the companion. The chat turn streams from
 * POST /api/companion (a UIMessage SSE stream); we decode it with the SDK's
 * wire helpers and hand text deltas to the caller. Regenerate is a plain POST
 * that returns the new issue id + version.
 *
 * Kept beside the reader so the components stay views: useCompanionThread owns
 * the conversation state and CompanionRail the rendering, this owns the transport.
 */

import { getAuthToken, parseSseLine, decodeAiStreamChunk } from 'deepspace'
import { sourcesFromToolResult, type CompanionSource } from './companion-parts'

export type { CompanionSource } from './companion-parts'

/**
 * A live event from Laila's agentic turn, beyond the text deltas. The caller
 * uses these to build the SAME ChatPart[] a persisted turn carries: the calm
 * "checking the source" status, the per-tool note, and the real source chips.
 * The chip sources are extracted in the shared parts module (it knows the tool
 * result shapes) so the caller just collects them.
 */
export type CompanionEvent =
  /** Laila committed to a web tool; carries the tool input for the note label. */
  | { type: 'tool-start'; toolCallId: string; toolName: string; input: unknown }
  /** The tool finished; `sources` are the real pages it surfaced (may be empty). */
  | { type: 'tool-result'; toolCallId: string; toolName: string; sources: CompanionSource[] }
  /** The tool failed; clear the status and keep the turn going. */
  | { type: 'tool-failed'; toolCallId?: string; toolName?: string }

/**
 * Stream one companion turn. Calls `onDelta` with each text chunk as it
 * arrives. `onEvent` (optional) surfaces Laila's tool activity so the caller
 * can show the status line and live source chips. The signal aborts the request
 * (the stop control). Resolves with the full assistant text when the stream
 * ends; rejects on a transport/HTTP error (the caller shows the honest error
 * state). An AbortError surfaces so the caller can keep whatever streamed so far.
 */
export async function streamCompanion(
  args: { issueId: string; message: string; signal?: AbortSignal },
  onDelta: (delta: string) => void,
  onEvent?: (event: CompanionEvent) => void,
): Promise<string> {
  const token = await getAuthToken()
  const res = await fetch('/api/companion', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ issueId: args.issueId, message: args.message }),
    signal: args.signal,
  })

  if (!res.ok || !res.body) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error || `Laila could not reply (${res.status})`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''
  // finalize-tool-call / fail-tool-output only carry the toolCallId, so remember
  // which tool each id is to pick the right source extractor and status label.
  const toolNames = new Map<string, string>()

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const chunk = parseSseLine(line)
      if (!chunk) continue
      const action = decodeAiStreamChunk(chunk)
      if (action?.type === 'append-text') {
        full += action.delta
        onDelta(action.delta)
      } else if (action?.type === 'upsert-tool-call') {
        toolNames.set(action.toolCallId, action.toolName)
        onEvent?.({
          type: 'tool-start',
          toolCallId: action.toolCallId,
          toolName: action.toolName,
          input: action.input,
        })
      } else if (action?.type === 'finalize-tool-call') {
        const toolName = toolNames.get(action.toolCallId) ?? ''
        onEvent?.({
          type: 'tool-result',
          toolCallId: action.toolCallId,
          toolName,
          sources: sourcesFromToolResult(toolName, action.result),
        })
      } else if (action?.type === 'fail-tool-input') {
        onEvent?.({ type: 'tool-failed', toolName: action.toolName })
      } else if (action?.type === 'fail-tool-output') {
        onEvent?.({ type: 'tool-failed', toolCallId: action.toolCallId, toolName: toolNames.get(action.toolCallId) })
      } else if (action?.type === 'stream-error') {
        throw new Error(action.errorText || 'The reply stopped unexpectedly.')
      }
    }
  }

  return full
}

/**
 * Regenerate the issue from the conversation. `message` is the optional latest
 * (unsent) ask. Returns the new version's issue id so the caller can navigate.
 */
export async function regenerateIssue(args: {
  issueId: string
  message?: string
}): Promise<{ issueId: string; version: number }> {
  const token = await getAuthToken()
  const res = await fetch('/api/companion/regenerate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ issueId: args.issueId, message: args.message ?? '' }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    issueId?: string
    version?: number
    error?: string
  }
  if (!res.ok || !data.issueId) {
    throw new Error(data.error || `Regenerate failed (${res.status})`)
  }
  return { issueId: data.issueId, version: data.version ?? 0 }
}
