/**
 * Issues: one row per generated issue of a newsletter.
 *
 * A draft row is created first so the UI can watch it go ready over live
 * records. Email HTML is rendered at send time from the structured issue, not
 * stored. Read is scoped 'own' for ALL roles including admin (single-owner;
 * admin:read:true would leak every user's rows over the WebSocket).
 *
 * The record envelope already carries createdAt / updatedAt / createdBy, so
 * those are not duplicated as columns; generatedAt / sentAt are explicit
 * domain timestamps the pipeline sets.
 */

import type { CollectionSchema } from 'deepspace/worker'

export const issuesSchema: CollectionSchema = {
  name: 'issues',
  ownerField: 'ownerUserId',
  columns: [
    { name: 'newsletterId', storage: 'text', interpretation: 'plain' },
    { name: 'number', storage: 'number', interpretation: 'plain', default: 0 },
    { name: 'title', storage: 'text', interpretation: 'plain' },
    { name: 'lead', storage: 'text', interpretation: 'plain' },
    // [{ headline, summary, sourceName, sourceUrl, publishedAt? }]
    { name: 'sections', storage: 'text', interpretation: { kind: 'json' }, default: [] },
    {
      name: 'status',
      storage: 'text',
      interpretation: { kind: 'select', options: ['draft', 'ready', 'sent', 'failed'] },
      default: 'draft',
    },
    {
      name: 'emailStatus',
      storage: 'text',
      interpretation: { kind: 'select', options: ['pending', 'sent', 'failed', 'skipped'] },
      default: 'pending',
    },
    { name: 'emailError', storage: 'text', interpretation: 'plain' },
    { name: 'starred', storage: 'number', interpretation: { kind: 'boolean' }, default: false },
    { name: 'archived', storage: 'number', interpretation: { kind: 'boolean' }, default: false },
    { name: 'version', storage: 'number', interpretation: 'plain', default: 1 },
    { name: 'parentIssueId', storage: 'text', interpretation: 'plain' },
    { name: 'modelUsed', storage: 'text', interpretation: 'plain' },
    { name: 'costEstimate', storage: 'number', interpretation: 'plain' },
    { name: 'generatedAt', storage: 'number', interpretation: 'plain' },
    { name: 'sentAt', storage: 'number', interpretation: 'plain' },
    // When the owner first opened this dispatch in the reader (mark-read-on-open).
    // Absent means unread. Owner-bound like the rest; admin may update own rows.
    { name: 'readAt', storage: 'number', interpretation: 'plain' },
    { name: 'runError', storage: 'text', interpretation: 'plain' },
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
