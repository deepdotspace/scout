/**
 * Companion server logic - the chat turn context and regenerate-as-version.
 *
 * Kept out of worker.ts so the route handlers stay thin and the context
 * assembly is unit-testable. Two jobs:
 *
 *   1. assembleContext - bound the chat history with the SDK's compaction
 *      (summarize older turns when over budget) into the model messages the
 *      turn streams from. The current issue and the reader profile are in the
 *      system prompt; the agentic web tools (worker.ts) handle anything the
 *      issue does not contain.
 *
 *   2. regenerateFromConversation - reuse the existing compose stage with the
 *      original issue's stories as the sources and the conversation as extra
 *      tuning, producing a NEW issue version (parentIssueId = original). The
 *      original issue is never mutated.
 *
 * Owner-billed Sonnet, capped context for cost.
 */

import type { ModelMessage } from 'ai'
import {
  prepareMessagesWithCompaction,
  makeDefaultSummarizer,
  DEFAULT_CONTEXT_CONFIG,
  type ChatTurn as SdkChatTurn,
} from 'deepspace/worker'
import type { Env } from '../../worker'
import { composeIssue, type NewsletterConfig } from './pipeline'
import type { SourceItem } from './sources'
import type { IssueSection } from './report-shape'
import { voiceLabel } from '../personas'

/**
 * The recent window used for the regenerate transcript. The chat turn does NOT
 * cap history at this number: it feeds the full history into the SDK's
 * compaction, which summarizes anything older than the budget rather than
 * letting it fall off a fixed cliff.
 */
export const HISTORY_TURNS = 12

export interface ChatTurn {
  chatId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
}

export interface CompanionIssue {
  title: string
  lead: string
  sections: IssueSection[]
}

export interface AssembledContext {
  /** The recent conversation as model messages (oldest first), excluding the live user turn. */
  history: ModelMessage[]
  /** The live user message that triggered this turn. */
  userMessage: string
}

/** Chat turns sorted oldest-first. */
function sortedHistory(history: ChatTurn[]): ChatTurn[] {
  return [...history].sort((a, b) => a.createdAt - b.createdAt)
}

/**
 * The recent window of chat turns, oldest first, bounded to HISTORY_TURNS.
 * Used for the regenerate path (conversationAsTuning). The chat turn itself
 * feeds the FULL history into compaction, not this window, so the summarizer
 * can fire on a genuinely long thread.
 */
export function recentHistory(history: ChatTurn[]): ChatTurn[] {
  return sortedHistory(history).slice(-HISTORY_TURNS)
}

/**
 * Build the model context for one companion turn. `history` is every persisted
 * chat row for this issue (any order); `userMessage` is the new, not-yet-saved
 * user turn.
 *
 * The FULL conversation is fed into the SDK's compaction: under budget it
 * passes through unchanged; over budget it summarizes the older half (Haiku,
 * owner-billed) and keeps the recent turns, so there is no fixed 12-turn cliff.
 */
export async function assembleContext(
  env: Env,
  args: {
    history: ChatTurn[]
    userMessage: string
  },
): Promise<AssembledContext> {
  // Feed the whole sorted history into compaction. On a short thread this is a
  // no-op pass-through; on a long one (over the 240k budget) the summarizer
  // windows + summarizes the older turns within the budget.
  const turns: SdkChatTurn[] = sortedHistory(args.history).map((t) => ({
    id: t.chatId,
    role: t.role,
    content: t.content,
  }))
  const { messages } = await prepareMessagesWithCompaction(turns, DEFAULT_CONTEXT_CONFIG, {
    summarizer: makeDefaultSummarizer(env),
  })

  return {
    history: messages.map((m) => ({ role: m.role, content: m.content }) as ModelMessage),
    userMessage: args.userMessage,
  }
}

/**
 * Reconstruct SourceItem[] from a saved issue's sections. The issue already
 * cites real source names and urls, so its stories ARE the sources for a
 * regenerate, summary doubles as the body text the writer works from.
 */
export function issueSectionsAsSources(sections: IssueSection[]): SourceItem[] {
  return sections.map((s) => ({
    url: s.sourceUrl,
    title: s.headline,
    text: s.summary,
    publishedAt: s.publishedAt ?? null,
    source: 'exa',
    sourceName: s.sourceName,
  }))
}

/**
 * Fold the companion conversation into a single tuning instruction the compose
 * prompt already knows how to honor (it injects preferences as "Tuning from the
 * reader"). Bounded so a long chat can't dominate the prompt.
 */
export function conversationAsTuning(history: ChatTurn[], latestUser: string): string {
  // The companion is Laila, so the transcript bylines the assistant as Laila.
  const lines = recentHistory(history)
    .map((t) => `${t.role === 'user' ? 'Reader' : 'Laila'}: ${t.content}`)
  if (latestUser.trim()) lines.push(`Reader: ${latestUser.trim()}`)
  return [
    'Regenerate this issue applying what the reader asked for in this conversation.',
    'Keep the same real sources and links; do not invent new ones. Change only what',
    'the conversation asks for (depth, length, focus, ordering, tone).',
    '',
    'Conversation:',
    lines.join('\n'),
  ].join('\n')
}

export interface RegenerateInput {
  cfg: NewsletterConfig
  issue: CompanionIssue
  history: ChatTurn[]
  latestUser: string
}

/**
 * Produce a revised issue from the conversation by reusing the existing compose
 * stage: the original issue's stories are the sources, and the conversation is
 * appended as an extra tuning note. The caller writes the result as a NEW
 * version; this never mutates the original.
 */
export async function regenerateFromConversation(env: Env, input: RegenerateInput) {
  const sources = issueSectionsAsSources(input.issue.sections)
  const tuning = conversationAsTuning(input.history, input.latestUser)
  const cfgWithConversation: NewsletterConfig = {
    ...input.cfg,
    preferences: [...(input.cfg.preferences ?? []), tuning],
  }
  return composeIssue(env, cfgWithConversation, sources)
}

/** The reader's voice label for the companion prompt (e.g. "Sharp Analyst"). */
export function voiceLabelFor(cfg: NewsletterConfig): string {
  if (cfg.voicePreset === 'custom') return 'a custom voice'
  return voiceLabel(cfg.voicePreset)
}
