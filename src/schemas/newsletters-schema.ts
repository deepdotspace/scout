/**
 * Newsletters: one row per newsletter the owner has configured.
 *
 * Single-owner app: every newsletter belongs to the owner. Read is scoped
 * 'own' for ALL roles including admin so no client surface ever shows another
 * user's rows over the WebSocket (admin:read:true leaks all rows client-side).
 */

import type { CollectionSchema } from 'deepspace/worker'

export const newslettersSchema: CollectionSchema = {
  name: 'newsletters',
  ownerField: 'ownerUserId',
  columns: [
    { name: 'title', storage: 'text', interpretation: 'plain' },
    { name: 'topicRaw', storage: 'text', interpretation: 'plain' },
    // Scout's-read: the sharpened scope derived from topicRaw.
    { name: 'scope', storage: 'text', interpretation: 'plain' },
    { name: 'angle', storage: 'text', interpretation: 'plain' },
    { name: 'voicePreset', storage: 'text', interpretation: 'plain' },
    { name: 'voiceCustomPrompt', storage: 'text', interpretation: 'plain' },
    {
      name: 'frequency',
      storage: 'text',
      interpretation: { kind: 'select', options: ['daily', 'weekdays', 'weekly', 'custom'] },
    },
    { name: 'days', storage: 'text', interpretation: { kind: 'json' }, default: [] },
    { name: 'time', storage: 'text', interpretation: 'plain' },
    { name: 'timezone', storage: 'text', interpretation: 'plain' },
    {
      name: 'recencyWindow',
      storage: 'text',
      interpretation: { kind: 'select', options: ['24h', '3d', '7d', '30d'] },
    },
    { name: 'location', storage: 'text', interpretation: 'plain' },
    { name: 'preferredDomains', storage: 'text', interpretation: { kind: 'json' }, default: [] },
    { name: 'blockedDomains', storage: 'text', interpretation: { kind: 'json' }, default: [] },
    {
      name: 'status',
      storage: 'text',
      interpretation: { kind: 'select', options: ['active', 'paused'] },
      default: 'active',
    },
    // Running "more/less like this" tuning notes.
    { name: 'preferences', storage: 'text', interpretation: { kind: 'json' }, default: [] },
    { name: 'lastSentAt', storage: 'number', interpretation: 'plain' },
    { name: 'nextSendAt', storage: 'number', interpretation: 'plain' },
    {
      name: 'lastRunStatus',
      storage: 'text',
      interpretation: { kind: 'select', options: ['idle', 'running', 'ok', 'failed'] },
      default: 'idle',
    },
    { name: 'lastRunError', storage: 'text', interpretation: 'plain' },
    {
      name: 'ownerUserId',
      storage: 'text',
      interpretation: 'plain',
      userBound: true,
      immutable: true,
    },
  ],
  permissions: {
    viewer: { read: 'own', create: false, update: false, delete: false },
    member: { read: 'own', create: false, update: false, delete: false },
    admin: { read: 'own', create: true, update: true, delete: true },
  },
}
