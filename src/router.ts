// Generouted, changes to this file will be overridden
/* eslint-disable */

import { components, hooks, utils } from '@generouted/react-router/client'

export type Path =
  | `*`
  | `/`
  | `/issues`
  | `/n/:id`
  | `/n/:id/edit`
  | `/n/:id/i/:issueId`
  | `/n/:id/run`
  | `/new`
  | `/settings`
  | `/welcome`

export type Params = {
  '/*': { '*': string }
  '/n/:id': { id: string }
  '/n/:id/edit': { id: string }
  '/n/:id/i/:issueId': { id: string; issueId: string }
  '/n/:id/run': { id: string }
}

export type ModalPath = never

export const { Link, Navigate } = components<Path, Params>()
export const { useModals, useNavigate, useParams } = hooks<Path, Params, ModalPath>()
export const { redirect } = utils<Path, Params>()
