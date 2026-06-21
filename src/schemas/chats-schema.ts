/**
 * Chats: the companion conversation attached to an issue.
 *
 * One row per turn (user or assistant). Read is scoped 'own' for ALL roles
 * including admin (single-owner; admin:read:true would leak every user's rows
 * over the WebSocket). The record envelope carries createdAt.
 */

import type { CollectionSchema } from 'deepspace/worker'

export const chatsSchema: CollectionSchema = {
  name: 'chats',
  ownerField: 'ownerUserId',
  columns: [
    { name: 'issueId', storage: 'text', interpretation: 'plain' },
    { name: 'newsletterId', storage: 'text', interpretation: 'plain' },
    {
      name: 'role',
      storage: 'text',
      interpretation: { kind: 'select', options: ['user', 'assistant'] },
    },
    { name: 'content', storage: 'text', interpretation: 'plain' },
    // The structured render of an assistant turn: an ordered [{type:'text'} |
    // {type:'tool', toolName, label, sources}] array so a reloaded thread shows
    // the same tool notes + source chips the live turn did. `content` stays the
    // text fallback; old rows (no parts) render unchanged. User rows stay [].
    { name: 'parts', storage: 'text', interpretation: { kind: 'json' }, default: [] },
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
