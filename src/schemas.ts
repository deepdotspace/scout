/**
 * Collection Schemas
 *
 * All collections with columns and RBAC permissions.
 * Single source of truth: imported by both worker and frontend.
 *
 * Add schemas by creating a file in src/schemas/ and importing it here.
 */

import type { CollectionSchema } from 'deepspace/worker'
import { usersSchema } from './schemas/users-schema'
import { newslettersSchema } from './schemas/newsletters-schema'
import { issuesSchema } from './schemas/issues-schema'
import { chatsSchema } from './schemas/chats-schema'
import { profileSchema } from './schemas/profile-schema'

export const schemas: CollectionSchema[] = [
  usersSchema,
  newslettersSchema,
  issuesSchema,
  chatsSchema,
  profileSchema,
]
