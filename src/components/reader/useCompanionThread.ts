/**
 * useCompanionThread: the companion's conversation state, kept out of the rail so
 * CompanionRail stays a view. It reads the persisted thread for ONE issue from
 * the live chats collection, holds the in-flight turn (the user message we just
 * sent plus the streaming Laila text), and streams a reply through the LOCKED
 * transport in lib/companion-api.ts (the /api/companion contract is unchanged).
 *
 * Every assistant turn (live AND persisted) renders from ONE ordered ChatPart[]:
 * text segments interleaved with tool notes + their source chips. A persisted row
 * reads its `parts` column (json); a legacy row with only `content` falls back to
 * a single text part. The in-flight turn assembles the same ChatPart[] from the
 * streamed text deltas and tool events, so a reloaded thread renders identically.
 *
 * Each issue keeps its own thread (the rows are filtered by issueId). Once the
 * persisted rows catch up with what we sent, the in-flight copies drop so a
 * message never shows twice. AbortError keeps whatever streamed; the server still
 * persisted both turns in its onFinish.
 *
 * In demo mode (?demo=1) there is no live AI or auth, so the hook serves a static
 * fixture thread and the send is inert. Real Laila replies + memory verify only
 * against the deployed app.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from 'deepspace'
import { streamCompanion } from '../../lib/companion-api'
import {
  asChatParts,
  sourcesFromToolResult,
  toolLabel,
  toolRunningLabel,
  type ChatPart,
} from '../../lib/companion-parts'
import { DEMO_THREAD, type DemoTurn } from '../../lib/demo-companion'

export interface UiMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  /** A streaming, not-yet-finished assistant turn (drives the caret). */
  pending?: boolean
  /**
   * The ordered render of an assistant turn: text blocks + tool notes with their
   * chips. Present on every assistant turn (live and persisted); user turns omit
   * it and render `content`. A legacy assistant row with no parts also omits it
   * and falls back to `content`.
   */
  parts?: ChatPart[]
}

interface ChatRow {
  issueId: string
  role: 'user' | 'assistant'
  content: string
  parts?: unknown
  ownerUserId: string
}

export interface CompanionThread {
  messages: UiMessage[]
  busy: boolean
  error: string
  send: (text: string) => void
  clearError: () => void
}

/** The demo thread, shaped as UiMessages (stable ids). */
function demoMessages(turns: DemoTurn[]): UiMessage[] {
  return turns.map((t, i) => ({
    id: `demo-${i}`,
    role: t.role,
    content: t.content,
    parts: t.role === 'assistant' ? demoTurnParts(t) : undefined,
  }))
}

/** Build a demo assistant turn's parts: its explicit `parts`, or content + chips. */
function demoTurnParts(t: DemoTurn): ChatPart[] | undefined {
  if (t.parts && t.parts.length) return t.parts
  if (t.status) return [{ type: 'tool', toolName: 'read_source', label: t.status, sources: [], running: true }]
  if (!t.content) return undefined
  const text: ChatPart = { type: 'text', text: t.content }
  if (t.sources && t.sources.length) {
    return [text, { type: 'tool', toolName: 'look_it_up', label: '', sources: t.sources }]
  }
  return [text]
}

/** A persisted assistant row's parts: its json column, or one text part fallback. */
function persistedParts(row: { role: string; content: string; parts?: unknown }): ChatPart[] | undefined {
  if (row.role !== 'assistant') return undefined
  const parts = asChatParts(row.parts)
  if (parts.length) return parts
  return row.content ? [{ type: 'text', text: row.content }] : undefined
}

export function useCompanionThread(
  issueId: string | undefined,
  opts: { demo: boolean; demoThread?: DemoTurn[] },
): CompanionThread {
  const { demo, demoThread = DEMO_THREAD } = opts

  // Hooks run unconditionally (rules of hooks); the demo flag only changes which
  // data the hook returns, never how many hooks it calls.
  const chatsQ = useQuery<ChatRow>('chats')
  const [pendingUser, setPendingUser] = useState<string | null>(null)
  const [streaming, setStreaming] = useState('')
  const [busy, setBusy] = useState(false)
  // The in-flight assistant turn's ordered parts, assembled from the stream.
  const [liveParts, setLiveParts] = useState<ChatPart[]>([])
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const persisted = useMemo(
    () =>
      chatsQ.records
        .filter((r) => r.data.issueId === issueId)
        .map((r) => ({ id: r.recordId, createdAt: r.createdAt, ...r.data }))
        .sort((a, b) => Date.parse(a.createdAt as string) - Date.parse(b.createdAt as string)),
    [chatsQ.records, issueId],
  )

  // Drop the in-flight copies once the persisted rows have caught up, so a turn
  // never renders twice (the live records arrive a beat after the stream ends).
  useEffect(() => {
    if (demo) return
    if (!busy && pendingUser) {
      const last = persisted[persisted.length - 1]
      if (last && last.role === 'assistant') {
        setPendingUser(null)
        setStreaming('')
        setLiveParts([])
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persisted.length, busy, demo])

  // When the reader switches issues (the hook instance is reused, not remounted)
  // or unmounts, abort any in-flight stream and clear the in-flight turn so one
  // issue's reply never streams under another.
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      abortRef.current = null
      setPendingUser(null)
      setStreaming('')
      setBusy(false)
      setLiveParts([])
      setError('')
    }
  }, [issueId])

  const demoMsgs = useMemo(() => demoMessages(demoThread), [demoThread])
  if (demo) {
    return { messages: demoMsgs, busy: false, error: '', send: () => {}, clearError: () => {} }
  }

  const messages: UiMessage[] = [
    ...persisted.map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content as string,
      parts: persistedParts(m as { role: string; content: string; parts?: unknown }),
    })),
    ...(pendingUser ? [{ id: 'pending-user', role: 'user' as const, content: pendingUser }] : []),
    ...(busy || streaming || liveParts.length
      ? [
          {
            id: 'pending-asst',
            role: 'assistant' as const,
            content: streaming,
            pending: true,
            parts: liveParts,
          },
        ]
      : []),
  ]

  function send(text: string) {
    const message = text.trim()
    if (!message || busy || !issueId) return
    setError('')
    setPendingUser(message)
    setStreaming('')
    setLiveParts([])
    setBusy(true)
    const controller = new AbortController()
    abortRef.current = controller
    void (async () => {
      try {
        await streamCompanion(
          { issueId, message, signal: controller.signal },
          (delta) => {
            setStreaming((s) => s + delta)
            // A text delta extends the trailing text part (or starts a new one
            // after a tool), so the live order matches what persists.
            setLiveParts((prev) => appendText(prev, delta))
          },
          (event) => {
            if (event.type === 'tool-start') {
              setLiveParts((prev) => [
                ...prev,
                {
                  type: 'tool',
                  toolName: event.toolName,
                  label: toolRunningLabel(event.toolName),
                  sources: [],
                  running: true,
                  // The toolCallId + input ride along the running part so the
                  // result can find it and label it; both are dropped on settle
                  // and never persisted.
                  ...({ toolCallId: event.toolCallId, input: event.input } as object),
                },
              ])
            } else if (event.type === 'tool-result') {
              setLiveParts((prev) => settleTool(prev, event.toolCallId, event.sources))
            } else if (event.type === 'tool-failed') {
              setLiveParts((prev) => settleTool(prev, event.toolCallId, []))
            }
          },
        )
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') {
          // Stopped on purpose; keep whatever streamed. The server still persists.
        } else {
          setError(err instanceof Error ? err.message : 'Laila could not reply. Try again.')
          setPendingUser(null)
          setStreaming('')
          setLiveParts([])
        }
      } finally {
        setBusy(false)
        abortRef.current = null
      }
    })()
  }

  return { messages, busy, error, send, clearError: () => setError('') }
}

/** Extend the trailing text part with a delta, or open a new one after a tool. */
function appendText(parts: ChatPart[], delta: string): ChatPart[] {
  const last = parts[parts.length - 1]
  if (last && last.type === 'text') {
    return [...parts.slice(0, -1), { type: 'text', text: last.text + delta }]
  }
  return [...parts, { type: 'text', text: delta }]
}

/**
 * Settle a running tool part to its past-tense note + chips. Match by the
 * toolCallId carried during streaming; fall back to the last running tool part
 * when the id is missing (a fail-tool-output without an id). The toolCallId is
 * dropped here so the settled part is a clean ChatPart.
 */
function settleTool(
  parts: ChatPart[],
  toolCallId: string | undefined,
  sources: ReturnType<typeof sourcesFromToolResult>,
): ChatPart[] {
  let idx = -1
  if (toolCallId) {
    idx = parts.findIndex((p) => p.type === 'tool' && (p as { toolCallId?: string }).toolCallId === toolCallId)
  }
  if (idx < 0) {
    for (let i = parts.length - 1; i >= 0; i--) {
      if (parts[i].type === 'tool' && (parts[i] as { running?: boolean }).running) {
        idx = i
        break
      }
    }
  }
  if (idx < 0) return parts
  const part = parts[idx] as Extract<ChatPart, { type: 'tool' }> & { input?: unknown }
  const settled: ChatPart = {
    type: 'tool',
    toolName: part.toolName,
    label: toolLabel(part.toolName, part.input, sources),
    sources,
  }
  return [...parts.slice(0, idx), settled, ...parts.slice(idx + 1)]
}
