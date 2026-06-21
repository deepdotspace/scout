/**
 * CompanionRail: the "Wire back to Laila" pane of the reader (DESIGN_V2.md section
 * 7, shots 09 / 10). On desktop it is the structural right column the reading
 * reflows around (flex:0 0 clamp(300px,34%,380px), a left hairline). Below md it
 * renders inside a docked bottom sheet (see the reader route). Either way it is
 * NEVER a position:fixed overlay over the issue.
 *
 * Its own column: a header ("Wire back to Laila" accent mono + a one-line
 * description), a scrollable thread (id=scout-chat-scroll, auto-scrolls to the
 * bottom on new messages), and a pinned composer (the shared Composer, Enter
 * sends / Shift+Enter newlines). The thread shows a mono role label (LAILA accent
 * / YOU --ink3) over each message, Laila in serif, the reader in sans, with source
 * chips under grounded Laila replies and a sct-blink typing indicator while a reply
 * streams. The empty state is a warm Laila opener plus three suggestion seeds.
 *
 * Presentation only. Conversation state lives in useCompanionThread; the parent
 * route owns the draft + the seed-from-a-story flow.
 */

import { useLayoutEffect, useRef } from 'react'
import { AlertCircle } from 'lucide-react'
import { Composer } from '../scout/Composer'
import { EyebrowLabel } from '../scout/Eyebrow'
import { SourceChip } from '../scout/SourceChip'
import { LAILA_OPENER, LAILA_SUGGESTIONS } from '../../lib/demo-companion'
import type { UiMessage } from './useCompanionThread'
import type { ChatPart } from '../../lib/companion-parts'

export function CompanionRail({
  messages,
  busy,
  error,
  draft,
  onDraftChange,
  onSend,
  onSeed,
  onClearError,
  composerRef,
  composerDisabled = false,
}: {
  messages: UiMessage[]
  busy: boolean
  error: string
  draft: string
  onDraftChange: (v: string) => void
  onSend: () => void
  /** A suggestion seed drops a first message straight into the thread. */
  onSeed: (prompt: string) => void
  onClearError: () => void
  composerRef?: React.Ref<HTMLTextAreaElement>
  composerDisabled?: boolean
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const hasThread = messages.length > 0

  // Keep the latest message in view as the reply streams.
  const streamingLen = messages[messages.length - 1]?.content.length ?? 0
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, streamingLen])

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ background: 'var(--surface)' }}>
      {/* Header. */}
      <header
        className="shrink-0 px-5 py-4"
        style={{ borderBottom: '1px solid var(--line)' }}
      >
        <EyebrowLabel accent className="inline-flex items-center gap-1.5">
          <span aria-hidden>&bull;</span>
          Wire back to Laila
        </EyebrowLabel>
        <p className="mt-1.5 text-[12.5px]" style={{ lineHeight: 1.45, color: 'var(--ink3)' }}>
          Ask about a story, what I skipped, or shape the next dispatch. I remember our
          past dispatches.
        </p>
      </header>

      {/* The thread. */}
      <div
        id="scout-chat-scroll"
        ref={scrollRef}
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-5 py-5"
      >
        {!hasThread ? (
          <Empty onSeed={onSeed} disabled={composerDisabled} />
        ) : (
          <div className="flex flex-col gap-6">
            {messages.map((m) => (
              <Message key={m.id} message={m} />
            ))}
          </div>
        )}

        {error && (
          <div
            className="mt-4 flex items-start gap-2 rounded-[10px] px-3.5 py-2.5 text-[13px]"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={onClearError}
              className="shrink-0 text-xs font-medium underline-offset-2 hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Pinned composer. */}
      <div className="shrink-0 px-4 pb-4 pt-3" style={{ borderTop: '1px solid var(--line)' }}>
        <Composer
          ref={composerRef}
          value={draft}
          onChange={onDraftChange}
          onSend={onSend}
          placeholder="Ask Laila..."
          disabled={composerDisabled || busy}
        />
      </div>
    </div>
  )
}

/** The empty thread: a warm Laila opener and three suggestion seeds. */
function Empty({ onSeed, disabled }: { onSeed: (prompt: string) => void; disabled: boolean }) {
  return (
    <div className="flex flex-col gap-5">
      <p
        className="font-serif"
        style={{ fontSize: '17.5px', fontWeight: 400, lineHeight: 1.6, color: 'var(--ink)' }}
      >
        {LAILA_OPENER}
      </p>
      <div className="flex flex-col gap-2">
        {LAILA_SUGGESTIONS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onSeed(p)}
            disabled={disabled}
            className="w-full rounded-[12px] px-3.5 py-2.5 text-left text-[14px] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              border: '1px solid var(--line)',
              background: 'var(--bg)',
              color: 'var(--ink2)',
            }}
            onMouseEnter={(e) => {
              if (disabled) return
              e.currentTarget.style.borderColor = 'var(--accent-line)'
              e.currentTarget.style.color = 'var(--accent)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--line)'
              e.currentTarget.style.color = 'var(--ink2)'
            }}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  )
}

/** One message: a mono role label over the message; a thread dot on the rail.
 *  An assistant turn renders its ordered ChatPart[] (text + inline tool notes);
 *  a user turn and a legacy assistant row (no parts) render plain content. */
function Message({ message }: { message: UiMessage }) {
  const isLaila = message.role === 'assistant'
  const parts = message.parts
  // The streaming caret rides the LAST text part. Nothing visible yet (no parts,
  // empty content) shows the typing dots.
  const lastTextIdx = parts ? lastIndexOf(parts, (p) => p.type === 'text') : -1
  const nothingYet = isLaila && !message.content && (!parts || parts.length === 0)

  return (
    <div className="relative pl-5">
      {/* Thread dot. */}
      <span
        className="absolute left-0 top-[5px] size-2 rounded-full"
        style={{ background: isLaila ? 'var(--accent)' : 'var(--ink3)' }}
        aria-hidden
      />
      <EyebrowLabel accent={isLaila} className="block">
        {isLaila ? 'Laila' : 'You'}
      </EyebrowLabel>

      {nothingYet ? (
        <TypingDots />
      ) : isLaila && parts && parts.length > 0 ? (
        <div className="flex flex-col">
          {parts.map((part, i) =>
            part.type === 'text' ? (
              <LailaText key={i} text={part.text}>
                {message.pending && i === lastTextIdx && <Caret />}
              </LailaText>
            ) : (
              <ToolNote key={i} part={part} />
            ),
          )}
        </div>
      ) : isLaila ? (
        <LailaText text={message.content}>{message.pending && <Caret />}</LailaText>
      ) : (
        <p
          className="mt-2 whitespace-pre-wrap font-sans"
          style={{ fontSize: '15px', fontWeight: 500, lineHeight: 1.55, color: 'var(--ink2)' }}
        >
          {message.content}
        </p>
      )}
    </div>
  )
}

/** Find the last index in `arr` matching `pred`, or -1. */
function lastIndexOf<T>(arr: T[], pred: (v: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) if (pred(arr[i])) return i
  return -1
}

/** A serif Laila text block (an optional trailing caret while it streams). */
function LailaText({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <p
      className="mt-2 whitespace-pre-wrap font-serif"
      style={{ fontSize: '17.5px', fontWeight: 400, lineHeight: 1.6, color: 'var(--ink)' }}
    >
      {text}
      {children}
    </p>
  )
}

/**
 * An inline tool note under Laila's turn: a quiet mono micro-label (the
 * ToolStatus texture) with its own source chips, INLINE per tool. While the tool
 * runs it shows the calm pulsing status copy; once it finishes it settles to the
 * past-tense line ("Looked up ..." / "Read ...") so the call stays visible after
 * the fact and on reload. Empty sources render just the line, no chip row.
 */
function ToolNote({ part }: { part: Extract<ChatPart, { type: 'tool' }> }) {
  return (
    <div className="mt-2.5">
      <ToolStatus label={part.label} pulsing={!!part.running} />
      {part.sources.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {part.sources.map((s) => (
            <SourceChip key={s.url} href={s.url}>
              {s.name}
            </SourceChip>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * A calm mono micro-label for a tool note: an accent dot + a quiet line. While
 * the tool runs (`pulsing`) the dot blinks and reads "Laila is checking the
 * source"; once settled the dot is steady and the line is past tense ("Read
 * ..."). One texture for the live status and the persisted note.
 */
function ToolStatus({ label, pulsing = false }: { label: string; pulsing?: boolean }) {
  return (
    <span
      className="flex items-start gap-2 font-mono"
      style={{ fontSize: '11.5px', letterSpacing: '0.02em', color: 'var(--ink3)' }}
      aria-live={pulsing ? 'polite' : undefined}
    >
      <span
        className="mt-[5px] size-1.5 shrink-0 rounded-full"
        style={{ background: 'var(--accent)', ...(pulsing ? { animation: 'sct-blink 1.1s infinite' } : {}) }}
        aria-hidden
      />
      <span className="min-w-0 break-words" style={{ overflowWrap: 'anywhere', lineHeight: 1.45 }}>
        {label}
      </span>
    </span>
  )
}

/** The sct-blink three-dot typing indicator while a reply is awaited. */
function TypingDots() {
  return (
    <span className="mt-2 inline-flex items-center gap-1.5 py-1" aria-label="Laila is wiring back">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 rounded-full"
          style={{ background: 'var(--ink3)', animation: 'sct-blink 1s infinite', animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </span>
  )
}

function Caret() {
  return (
    <span
      className="ml-0.5 inline-block h-[0.95em] w-0.5 translate-y-[2px] align-middle"
      style={{ background: 'var(--accent)', animation: 'sct-blink 1s infinite' }}
      aria-hidden
    />
  )
}
