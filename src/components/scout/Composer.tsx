/**
 * Composer: the chat-composer container used by the companion rail. A rounded
 * --bg-filled box with a hairline border holding a borderless auto-grow textarea
 * and a send button. Enter sends, Shift+Enter newlines; send is disabled when the
 * field is empty (DESIGN_V2.md section 6, section 7). The send button fills with
 * the accent when there is text, else sits muted on --s2.
 *
 * Controlled: the parent owns `value` and gets `onChange` + `onSend`. The textarea
 * auto-grows to a 120px cap. The ref is forwarded so a toolbar "Wire back" button
 * can focus it.
 */

import { forwardRef, useCallback, type KeyboardEvent } from 'react'
import { ArrowUp } from 'lucide-react'
import { cn } from '../ui/utils'

export interface ComposerProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export const Composer = forwardRef<HTMLTextAreaElement, ComposerProps>(function Composer(
  { value, onChange, onSend, placeholder = 'Wire back...', disabled = false, className },
  ref,
) {
  const canSend = value.trim().length > 0 && !disabled

  const grow = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [])

  const handleKey = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (canSend) onSend()
      }
    },
    [canSend, onSend],
  )

  return (
    <div
      className={cn('flex items-center gap-2 rounded-[14px] p-2', className)}
      style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}
    >
      <textarea
        ref={ref}
        id="scout-composer"
        rows={1}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value)
          grow(e.currentTarget)
        }}
        onKeyDown={handleKey}
        className="flex-1 resize-none border-0 bg-transparent px-2 py-1.5 outline-none placeholder:opacity-70"
        style={{ fontSize: '14.5px', color: 'var(--ink)', maxHeight: '120px' }}
      />
      <button
        type="button"
        onClick={() => canSend && onSend()}
        disabled={!canSend}
        aria-label="Send"
        className="grid size-10 shrink-0 place-items-center rounded-[10px] transition-[background,color] duration-150 disabled:cursor-not-allowed"
        style={{
          background: canSend ? 'var(--accent)' : 'var(--s2)',
          color: canSend ? 'var(--aink)' : 'var(--ink3)',
        }}
      >
        <ArrowUp className="size-[18px]" />
      </button>
    </div>
  )
})
