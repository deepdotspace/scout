import { describe, it, expect } from 'vitest'
import * as sdkWorker from 'deepspace/worker'
import type { ChatTurn as SdkChatTurn } from 'deepspace/worker'
import {
  assembleContext,
  issueSectionsAsSources,
  conversationAsTuning,
  voiceLabelFor,
  recentHistory,
  HISTORY_TURNS,
  type ChatTurn,
} from '../../src/lib/companion'
import { buildCompanionPrompt } from '../../src/prompts'
import type { Env } from '../../worker'
import type { IssueSection } from '../../src/lib/report-shape'

// A bare env stands in for `deepspace dev`. assembleContext only uses the env
// for the SDK compaction summarizer, which is a pass-through on a short thread.
const noBindingEnv = { OWNER_USER_ID: 'owner-1' } as unknown as Env

describe('assembleContext', () => {
  const history: ChatTurn[] = [
    { chatId: 'c2', role: 'assistant', content: 'second', createdAt: 200 },
    { chatId: 'c1', role: 'user', content: 'first', createdAt: 100 },
    { chatId: 'c3', role: 'user', content: 'third', createdAt: 300 },
  ]

  it('orders history oldest-first and maps to model messages', async () => {
    const ctx = await assembleContext(noBindingEnv, { history, userMessage: 'fourth' })
    expect(ctx.history.map((m) => m.content)).toEqual(['first', 'second', 'third'])
    expect(ctx.history.map((m) => m.role)).toEqual(['user', 'assistant', 'user'])
    expect(ctx.userMessage).toBe('fourth')
  })
})

describe('compaction sees the FULL history (no fixed 12-turn cliff)', () => {
  it('carries every turn into the prompt on a short thread (no 12-turn pre-slice)', async () => {
    // A thread far longer than HISTORY_TURNS but tiny in total chars, so the
    // SDK's compaction is a pass-through. If assembleContext still pre-sliced
    // to HISTORY_TURNS, only 12 turns would survive; the full set proves the
    // whole history is what reaches compaction.
    const many: ChatTurn[] = Array.from({ length: HISTORY_TURNS + 40 }, (_, i) => ({
      chatId: `c${i}`,
      role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
      content: String(i),
      createdAt: i,
    }))
    const ctx = await assembleContext(noBindingEnv, { history: many, userMessage: 'q' })

    expect(ctx.history).toHaveLength(HISTORY_TURNS + 40)
    expect(ctx.history[0].content).toBe('0') // oldest turn, would be gone under a 12-cliff
    expect(ctx.history[ctx.history.length - 1].content).toBe(String(HISTORY_TURNS + 39))
  })

  it('the SDK compaction the chat feeds DOES summarize once the history is over budget', async () => {
    // Drive the exact SDK call assembleContext makes, with a captured summarizer,
    // to prove a genuinely long thread (over the 240k budget) reaches the summary
    // path instead of passing through. This is the mechanism the live fix relies on.
    const big = 'x'.repeat(2000)
    const long: SdkChatTurn[] = Array.from({ length: 200 }, (_, i) => ({
      id: `c${i}`,
      role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
      content: big,
    }))
    let summarizerSawOlder = 0
    const { messages } = await sdkWorker.prepareMessagesWithCompaction(long, sdkWorker.DEFAULT_CONTEXT_CONFIG, {
      summarizer: async (older) => {
        summarizerSawOlder = older.length
        return 'a short summary of the older turns'
      },
    })

    expect(summarizerSawOlder).toBeGreaterThan(0) // the summarizer fired
    expect(messages.some((m) => m.content.includes('summary of the older turns'))).toBe(true)
    expect(messages.length).toBeLessThan(long.length) // older turns collapsed into the summary
  })
})

describe('recentHistory (the one shared window for the regenerate transcript)', () => {
  it('sorts oldest-first', () => {
    const out = recentHistory([
      { chatId: 'b', role: 'assistant', content: '2', createdAt: 200 },
      { chatId: 'a', role: 'user', content: '1', createdAt: 100 },
    ])
    expect(out.map((t) => t.chatId)).toEqual(['a', 'b'])
  })

  it('keeps only the last HISTORY_TURNS, dropping the oldest', () => {
    const many: ChatTurn[] = Array.from({ length: HISTORY_TURNS + 5 }, (_, i) => ({
      chatId: `c${i}`,
      role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
      content: String(i),
      createdAt: i,
    }))
    const out = recentHistory(many)
    expect(out).toHaveLength(HISTORY_TURNS)
    expect(out[0].chatId).toBe('c5') // first 5 dropped
    expect(out[out.length - 1].chatId).toBe(`c${HISTORY_TURNS + 4}`)
  })
})

describe('regenerate context assembly', () => {
  const sections: IssueSection[] = [
    {
      headline: 'A real story',
      summary: 'What happened.',
      sourceName: 'example.com',
      sourceUrl: 'https://example.com/post',
      publishedAt: '2026-06-10',
    },
  ]

  it('turns saved sections into sources that keep the real url and name', () => {
    const sources = issueSectionsAsSources(sections)
    expect(sources).toHaveLength(1)
    expect(sources[0].url).toBe('https://example.com/post')
    expect(sources[0].sourceName).toBe('example.com')
    expect(sources[0].title).toBe('A real story')
  })

  it('folds the conversation into a tuning instruction in reader/Laila turns', () => {
    const tuning = conversationAsTuning(
      [
        { chatId: 'c1', role: 'user', content: 'make it shorter', createdAt: 1 },
        { chatId: 'c2', role: 'assistant', content: 'sure', createdAt: 2 },
      ],
      'and add the funding round',
    )
    expect(tuning).toContain('Reader: make it shorter')
    expect(tuning).toContain('Laila: sure')
    expect(tuning).toContain('Reader: and add the funding round')
    expect(tuning).toContain('do not invent new ones')
    expect(tuning).not.toContain('—') // no em dashes
  })
})

describe('companion prompt assembly', () => {
  const issue = {
    title: 'Weekly AI',
    lead: 'Two things moved.',
    sections: [
      { headline: 'Story one', summary: 'Detail.', sourceName: 'site.com', sourceUrl: 'https://site.com/a' },
    ],
  }

  it('embeds Laila, the anti-slop rules, the issue, the voice, and teaches the tools, with no em dashes', () => {
    const prompt = buildCompanionPrompt({
      issue,
      voiceLabel: 'The Analyst',
    })
    expect(prompt).toContain('You are Laila')
    expect(prompt).toContain('Write like a sharp human, not an AI.')
    expect(prompt).toContain('Weekly AI')
    expect(prompt).toContain('https://site.com/a')
    expect(prompt).toContain('The Analyst')
    // The agentic tools are taught by name so the model knows when to reach for them.
    expect(prompt).toContain('look_it_up')
    expect(prompt).toContain('read_source')
    expect(prompt).not.toContain('—')
  })

  it('renders nothing for the profile when it is empty or absent', () => {
    const absent = buildCompanionPrompt({ issue, voiceLabel: 'The Analyst' })
    expect(absent).not.toContain('What you know about this reader')

    const empty = buildCompanionPrompt({
      issue,
      voiceLabel: 'The Analyst',
      profile: { facts: [], interests: [] },
    })
    expect(empty).not.toContain('What you know about this reader')
  })

  it('renders a compact profile block when the profile is populated', () => {
    const prompt = buildCompanionPrompt({
      issue,
      voiceLabel: 'The Analyst',
      profile: {
        displayName: 'Maya',
        facts: ['Works in healthcare.', 'Reads on the train.'],
        interests: ['AI policy', 'climate tech'],
        tonePref: 'short, no fluff',
      },
    })
    expect(prompt).toContain('What you know about this reader')
    expect(prompt).toContain('They go by Maya.')
    expect(prompt).toContain('Cares about: AI policy, climate tech.')
    expect(prompt).toContain('Works in healthcare.')
    expect(prompt).toContain('Tone they like: short, no fluff.')
    expect(prompt).not.toContain('—')
  })
})

describe('voiceLabelFor', () => {
  it('maps a known preset to its label', () => {
    expect(voiceLabelFor({ scope: 's', recencyWindow: '7d', voicePreset: 'analyst' })).toBe('Sharp Analyst')
  })
  it('describes a custom voice', () => {
    expect(voiceLabelFor({ scope: 's', recencyWindow: '7d', voicePreset: 'custom' })).toBe('a custom voice')
  })
})
