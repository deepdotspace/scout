/**
 * Profile: the one durable "who is this reader" row Laila reads every turn.
 *
 * Single-owner, one row per owner (recordId is the owner's userId). Read is
 * scoped 'own' for ALL roles so a future "what Laila remembers" surface can read
 * it on the client. Writes go through the worker action path (X-App-Action),
 * never direct member writes, so the worker stays the trust boundary and the
 * caps + dedupe live in code, not the schema. The record envelope carries
 * createdAt / updatedAt.
 *
 * The caps (facts ~20, interests ~12, each <= 140 chars) live in worker.ts, not
 * here: the schema stores the lists, the merge bounds them.
 */

import type { CollectionSchema } from 'deepspace/worker'

export const profileSchema: CollectionSchema = {
  name: 'profile',
  ownerField: 'ownerUserId',
  columns: [
    { name: 'displayName', storage: 'text', interpretation: 'plain' },
    // string[] of durable learned facts, capped + deduped in code.
    { name: 'facts', storage: 'text', interpretation: { kind: 'json' }, default: [] },
    // string[] of topics the reader cares about, capped + deduped in code.
    { name: 'interests', storage: 'text', interpretation: { kind: 'json' }, default: [] },
    { name: 'tonePref', storage: 'text', interpretation: 'plain' },
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
