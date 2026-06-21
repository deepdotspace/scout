/**
 * A demo companion thread for `?demo=1` screenshots, so the populated chat reads
 * in Laila's real voice without live AI or auth. The real Laila replies + memory
 * + web tools only work against the deployed app (the model proxy and exa run
 * live-only). Tone borrowed from docs/research/LAILA_VOICE.md. No em dashes.
 *
 * The empty opener + suggestion seeds are shared with the live rail so the empty
 * state reads the same way in demo and in production.
 */

import type { ChatPart } from './companion-parts'

export interface DemoTurn {
  role: 'user' | 'assistant'
  content: string
  /** Source names to show as chips under a grounded Laila reply. */
  sources?: { name: string; url: string }[]
  /**
   * A calm tool-status line on an in-flight Laila turn (e.g. "Laila is checking
   * the source"). When set with empty content, the turn renders as the status
   * indicator. Demo only, so the agentic states are screenshot-verifiable.
   */
  status?: string
  /**
   * The structured render of a PERSISTED assistant turn: text blocks interleaved
   * with tool notes + their chips, exactly as a reloaded live turn carries. Demo
   * only, so the after-the-fact tool-note look is screenshot-verifiable.
   */
  parts?: ChatPart[]
}

/** Laila's one-line opener for an empty thread (live + demo share this). */
export const LAILA_OPENER =
  'I filed this one for you. Ask me to go deeper on a story, what I left out, or how to shape the next dispatch.'

/** The three suggestion seeds shown under the opener. */
export const LAILA_SUGGESTIONS = [
  'Go deeper on the off-switch story',
  'What did you leave out?',
  'Make the next dispatch punchier',
]

/** A populated thread keyed to the demo "AI Frontier" dispatch (iss-1). */
export const DEMO_THREAD: DemoTurn[] = [
  { role: 'user', content: 'Go deeper on the off-switch story' },
  {
    role: 'assistant',
    content:
      'On the off-switch: the supervisor model runs in parallel and scores the agent\'s confidence every few steps. When it dips below a threshold the run pauses and asks for a human. That is the genuinely new bit, the long autonomous runs are not.\n\nThe part the demo skipped is what happens when the supervisor is wrong. They did not publish a false-pause rate, so I would hold the nine-hour number lightly until someone runs it outside the lab.',
    // Real per-reply chips: the pages Laila actually read this turn.
    sources: [
      { name: 'The Information', url: 'https://www.theinformation.com' },
      { name: 'arxiv.org', url: 'https://arxiv.org/abs/2401.00001' },
    ],
  },
  { role: 'user', content: 'What did you leave out?' },
  {
    role: 'assistant',
    content:
      'Good question. Short version: I grounded only in the sources I actually read for this issue, plus your history. So if I am not sure I will tell you rather than guess. What angle do you want me to chase?',
  },
  { role: 'user', content: 'Make the next dispatch punchier' },
  {
    role: 'assistant',
    content:
      'Got it. I will cut the throat-clearing, lead harder, and keep each story to three sentences. I have noted it for the writer so the next issue lands that way without you asking again.',
  },
  { role: 'user', content: 'What does the supervisor model cost to run alongside?' },
  // A PERSISTED grounded turn: Laila says a line, looks a fact up, reads a page,
  // then answers. The tool notes + chips survive reload, so this is the
  // after-the-fact view a reloaded thread shows (not just the live status).
  {
    role: 'assistant',
    content:
      'They did not break the overhead out cleanly, so I went and checked.\n\nThe paper frames the supervisor as a lightweight scorer, not a second full model, so the added cost is the scoring passes, not a doubling. I would still treat any single headline number with care until someone runs it outside the lab.',
    parts: [
      { type: 'text', text: 'They did not break the overhead out cleanly, so I went and checked.' },
      {
        type: 'tool',
        toolName: 'look_it_up',
        label: 'Looked up "supervisor model inference overhead vs base agent"',
        sources: [{ name: 'The Information', url: 'https://www.theinformation.com' }],
      },
      {
        type: 'tool',
        toolName: 'read_source',
        label: 'Read arxiv.org',
        sources: [{ name: 'arxiv.org', url: 'https://arxiv.org/abs/2401.00001' }],
      },
      {
        type: 'text',
        text: 'The paper frames the supervisor as a lightweight scorer, not a second full model, so the added cost is the scoring passes, not a doubling. I would still treat any single headline number with care until someone runs it outside the lab.',
      },
    ],
  },
  { role: 'user', content: 'Has anyone reproduced the nine-hour run?' },
  // An in-flight Laila turn: empty content with a tool status, so the calm
  // "checking the source" indicator is screenshot-verifiable in demo mode.
  { role: 'assistant', content: '', status: 'Laila is checking the source' },
]
