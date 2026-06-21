/**
 * Domain types: the frontend shape of the records the worker stores.
 *
 * These mirror src/schemas/* (the worker is the source of truth for storage).
 * `useQuery<Newsletter>('newsletters')` returns these under each record's
 * `.data`. Keep in sync with the schema column lists when they change.
 */

export type Frequency = 'daily' | 'weekdays' | 'weekly' | 'custom'
export type RecencyWindow = '24h' | '3d' | '7d' | '30d'
export type NewsletterStatus = 'active' | 'paused'
export type RunStatus = 'idle' | 'running' | 'ok' | 'failed'

export interface Newsletter {
  title: string
  topicRaw: string
  scope: string
  angle: string
  voicePreset: string
  voiceCustomPrompt?: string
  frequency: Frequency
  days: string[]
  time: string
  timezone: string
  recencyWindow: RecencyWindow
  location?: string
  preferredDomains: string[]
  blockedDomains: string[]
  status: NewsletterStatus
  preferences: string[]
  lastSentAt?: number
  nextSendAt?: number
  lastRunStatus: RunStatus
  lastRunError?: string
  ownerUserId: string
}

export type IssueStatus = 'draft' | 'ready' | 'sent' | 'failed'
export type EmailStatus = 'pending' | 'sent' | 'failed' | 'skipped'

export interface IssueSection {
  headline: string
  summary: string
  sourceName: string
  sourceUrl: string
  publishedAt?: string
}

export interface Issue {
  newsletterId: string
  number: number
  title: string
  lead: string
  sections: IssueSection[]
  status: IssueStatus
  emailStatus: EmailStatus
  emailError?: string
  starred: boolean
  archived: boolean
  version: number
  parentIssueId?: string
  modelUsed?: string
  costEstimate?: number
  generatedAt?: number
  sentAt?: number
  /** When the owner first opened this dispatch. Absent means unread. */
  readAt?: number
  runError?: string
  ownerUserId: string
}
