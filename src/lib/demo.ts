/**
 * Demo data. ONLY for screenshotting the populated Home layout. It is never
 * written to the database and never shown unless the URL carries `?demo=1`.
 * Real Home reads from useQuery; this is a visual fixture, not seeded data.
 *
 * Shaped exactly like RecordData<Newsletter> / RecordData<Issue> so the same
 * components render it. Timestamps are relative to "now" so the chips read live.
 */

import type { Newsletter, Issue } from './types'
import { computeNextSendAt } from './schedule'

interface Record_<T> {
  recordId: string
  data: T
  createdBy: string
  createdAt: string
  updatedAt: string
}

const HOUR = 3600_000
const DAY = 24 * HOUR
const now = Date.now()

function nl(recordId: string, data: Partial<Newsletter> & Pick<Newsletter, 'title'>): Record_<Newsletter> {
  const merged: Newsletter = {
    topicRaw: '',
    scope: '',
    angle: '',
    voicePreset: 'analyst',
    frequency: 'weekly',
    days: [],
    time: '07:00',
    timezone: 'America/New_York',
    recencyWindow: '7d',
    preferredDomains: [],
    blockedDomains: [],
    status: 'active',
    preferences: [],
    lastRunStatus: 'ok',
    ownerUserId: 'demo',
    ...data,
  } as Newsletter
  // Derive a real next-send from the schedule so the desk "Next . <weekday>"
  // stamp reads like genuine schedule output (active beats only).
  if (merged.status !== 'paused' && merged.nextSendAt === undefined) {
    merged.nextSendAt =
      computeNextSendAt(
        { frequency: merged.frequency, days: merged.days, time: merged.time, timezone: merged.timezone },
        now,
      ) ?? undefined
  }
  return {
    recordId,
    createdBy: 'demo',
    createdAt: new Date(now - 14 * DAY).toISOString(),
    updatedAt: new Date(now - DAY).toISOString(),
    data: merged,
  }
}

export const DEMO_NEWSLETTERS: Record_<Newsletter>[] = [
  nl('demo-1', {
    title: 'The AI Frontier',
    scope: 'Frontier models, agents, and the research that actually ships. No hype, no roadmaps.',
    voicePreset: 'analyst',
    frequency: 'weekly',
    days: ['tue'],
    time: '7:00',
    lastSentAt: now - 2 * HOUR,
    lastRunStatus: 'ok',
  }),
  nl('demo-2', {
    title: 'Northwind Watch',
    scope: 'Everything your main competitor ships, says, prices, and hires.',
    voicePreset: 'operator',
    frequency: 'weekly',
    days: ['mon'],
    time: '8:00',
    lastSentAt: now - 4 * DAY,
    lastRunStatus: 'ok',
  }),
  nl('demo-3', {
    title: 'Lisbon, locally',
    scope: 'Openings, transit, politics and weekend plans across Lisbon.',
    voicePreset: 'companion',
    frequency: 'weekly',
    days: ['sat'],
    time: '9:00',
    lastSentAt: now - DAY,
    lastRunStatus: 'ok',
  }),
  nl('demo-4', {
    title: 'Send & Suffer',
    scope: 'Bouldering, alpine conditions, and gear that is worth the money.',
    voicePreset: 'storyteller',
    frequency: 'weekly',
    days: ['fri'],
    time: '18:00',
    status: 'paused',
    lastSentAt: now - 14 * DAY,
    lastRunStatus: 'idle',
  }),
]

function iss(recordId: string, newsletterId: string, data: Partial<Issue> & Pick<Issue, 'title' | 'number'>): Record_<Issue> {
  const generatedAt = data.generatedAt ?? now - 2 * DAY
  return {
    recordId,
    createdBy: 'demo',
    createdAt: new Date(generatedAt).toISOString(),
    updatedAt: new Date(generatedAt).toISOString(),
    data: {
      newsletterId,
      lead: '',
      sections: [],
      status: 'sent',
      emailStatus: 'sent',
      starred: false,
      archived: false,
      version: 1,
      generatedAt,
      sentAt: generatedAt,
      ownerUserId: 'demo',
      ...data,
    } as Issue,
  }
}

/**
 * Five source rows so the featured card reads "5 sources". The summaries also
 * populate the issue reader's story bodies (shot 07) in demo mode; the home
 * featured card ignores them and shows the source count only. No em dashes.
 */
const FEATURED_SECTIONS: Issue['sections'] = [
  {
    headline: 'The new long-horizon agent can run for hours. The real story is the off-switch.',
    summary:
      'Everyone screenshotted the nine-hour autonomous run. The part worth your attention is on page 14: a separate supervisor model that halts the agent mid-task when its confidence drops. It is the first time a major lab has shipped oversight as a product feature instead of a research demo.',
    sourceName: 'The Information',
    sourceUrl: 'https://theinformation.com',
  },
  {
    headline: 'An open-weights model matched a frontier one on reasoning, with an asterisk.',
    summary:
      'A 70B open model posted frontier-level math scores. Before you switch your stack, independent researchers flagged likely benchmark contamination in two of the three test sets. The honest read is "very close on the clean evals," which is still a real milestone for anyone self-hosting.',
    sourceName: 'arXiv',
    sourceUrl: 'https://arxiv.org',
  },
  {
    headline: 'The GPU lease market did something worth a paragraph.',
    summary:
      'Spot prices for last-generation accelerators fell hard as a wave of capacity came online. If you train or fine-tune, the cost floor just moved under you. The catch is that the cheapest pools are the least reliable, so read the SLA before you commit a long run.',
    sourceName: 'SemiAnalysis',
    sourceUrl: 'https://semianalysis.com',
  },
  {
    headline: 'A pricing change buried in a changelog, not a blog post.',
    summary:
      'One provider quietly cut its mid-tier input price by a third and did not announce it. I only caught it diffing the docs. If your bills run through that tier, recheck them, the savings are real and retroactive to the start of the month.',
    sourceName: 'OpenAI',
    sourceUrl: 'https://openai.com',
  },
  {
    headline: 'The one number everyone is overreacting to.',
    summary:
      'A single eval jumped twelve points and the timeline lost its mind. Look closer and the gain is almost all on one narrow category that does not generalize. It is a real result, just not the step change the screenshots implied. I would not rewrite a roadmap over it.',
    sourceName: 'Anthropic',
    sourceUrl: 'https://anthropic.com',
  },
]

export const DEMO_ISSUES: Record_<Issue>[] = [
  // The AI Frontier (demo-1): the featured dispatch plus two back issues, so the
  // detail screen reads as a real run of dispatches (shot 02-newsletter-detail).
  iss('iss-1', 'demo-1', {
    number: 48,
    title: "Two labs shipped agents. Both quietly admitted the hard part isn't the model.",
    lead: 'Two labs shipped "agents" this week and both buried the same confession in the footnotes: the model was never the bottleneck. Knowing when to stop is. Here are the five things that actually moved, and the one everyone is overreacting to.',
    sections: FEATURED_SECTIONS,
    generatedAt: now - 2 * HOUR,
    starred: true,
  }),
  iss('iss-1b', 'demo-1', {
    number: 47,
    title: 'A quiet Monday, one real release, and a lot of noise.',
    lead: 'Slow day, and I would rather send you two real things than pad it. The signal: a serious eval got open sourced, and the GPU lease market did something worth a paragraph.',
    sections: FEATURED_SECTIONS.slice(0, 2),
    generatedAt: now - 2 * DAY,
    // Already read, so the desk dot is clear and "fresh" counts only new ones.
    readAt: now - 2 * DAY + HOUR,
  }),
  iss('iss-1c', 'demo-1', {
    number: 46,
    title: 'The week was about efficiency, not capability.',
    lead: 'Step back and the week had one pattern. Nobody got dramatically smarter, everybody got cheaper and faster. That is the story, and it changes what you should plan around.',
    sections: FEATURED_SECTIONS.slice(0, 3),
    generatedAt: now - 4 * DAY,
    readAt: now - 4 * DAY + HOUR,
  }),
  iss('iss-2', 'demo-2', {
    number: 21,
    title: 'A price change, a quiet hire, and the feature they shipped without a post',
    generatedAt: now - 6 * HOUR,
    readAt: now - 5 * HOUR,
  }),
  iss('iss-3', 'demo-3', {
    number: 14,
    title: 'A quietly excellent week, Lisbon. The big news is small.',
    lead: 'Honestly a lovely week. The bakery in Arroios reopened, the bridge works got pushed again, and Saturday looks perfect for a miradouro. Here is the short of it.',
    sections: FEATURED_SECTIONS.slice(0, 2),
    generatedAt: now - 10 * HOUR,
    starred: true,
  }),
  // Send & Suffer (demo-4) is paused with no issues filed yet, so its detail
  // screen shows the empty state (shot 03-newsletter-empty).
]

/** True only when the URL explicitly asks for the demo fixture. */
export function isDemo(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('demo') === '1'
}
