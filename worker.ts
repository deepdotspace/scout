/**
 * App Worker — Hono-based Cloudflare Worker for DeepSpace apps.
 *
 * Each app owns its RecordRoom DOs. Schemas are baked in at deploy time.
 *
 * Handles:
 *   - WebSocket → app's own RecordRoom DO (real-time data)
 *   - Auth proxy → auth-worker (same-origin cookies)
 *   - Integration proxy → api-worker (LLM, search, etc.)
 *   - AI chat (Vercel AI SDK + DeepSpace proxy)
 *   - Server actions (app-defined, bypass user RBAC)
 *   - Scoped R2 file storage
 *   - HMAC-authenticated cron
 *   - Static asset serving with SPA fallback
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { verifyJwt, apiWorkerFetch, platformWorkerFetch, authWorkerFetch } from 'deepspace/worker'
import type { JwtVerifierConfig, VerifyResult } from 'deepspace/worker'
import { RecordRoom, YjsRoom, CanvasRoom, PresenceRoom, CronRoom, JobRoom } from 'deepspace/worker'
import { enqueueJob } from 'deepspace/worker'
import type { Job, JobContext, ActionTools, ActionResult, DOManifest, DOBindings } from 'deepspace/worker'
import { createDeepSpaceAI } from 'deepspace/worker'
import { streamText, stepCountIs, generateText, tool } from 'ai'
import { z } from 'zod'
import { actions } from './src/actions/index.js'
import { tasks as cronTasks, runTask as runCronTask } from './src/cron.js'
import { runJob, toConfig } from './src/jobs.js'
import { schemas } from './src/schemas.js'
import { integrations } from './src/integrations.js'
import { runScoutsRead } from './src/lib/ai.js'
import {
  ownerCheck,
  emailCheck,
  probeReason,
  modelCheck,
  schedulerCheck,
  storageCheck,
  countScheduled,
} from './src/lib/config-health.js'
import type { ConfigHealth } from './src/lib/config-health.js'
import { MODELS } from './src/config.js'
import { buildCompanionPrompt, profileExtract } from './src/prompts/index.js'
import {
  assembleContext,
  regenerateFromConversation,
  voiceLabelFor,
  type ChatTurn,
  type CompanionIssue,
} from './src/lib/companion.js'
import {
  profileFromRow,
  parseExtraction,
  mergeProfile,
  profileToRow,
  emptyProfile,
  type ReaderProfile,
} from './src/lib/profile.js'
import type { IssueSection } from './src/lib/report-shape.js'
import { partsFromSteps, type ChatPart } from './src/lib/companion-parts.js'

// =============================================================================
// DO Manifest — declares all Durable Objects for dynamic deploy bindings
// =============================================================================

export const __DO_MANIFEST__ = [
  { binding: 'RECORD_ROOMS', className: 'AppRecordRoom', sqlite: true },
  { binding: 'YJS_ROOMS', className: 'AppYjsRoom', sqlite: true },
  { binding: 'CANVAS_ROOMS', className: 'AppCanvasRoom', sqlite: true },
  { binding: 'PRESENCE_ROOMS', className: 'AppPresenceRoom', sqlite: true },
  { binding: 'CRON_ROOMS', className: 'AppCronRoom', sqlite: true },
  { binding: 'JOB_ROOMS', className: 'AppJobRoom', sqlite: true },
] as const satisfies DOManifest

// =============================================================================
// Durable Objects — extend to customize behavior
// =============================================================================

export class AppRecordRoom extends RecordRoom<Env> {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env, schemas, { ownerUserId: env.OWNER_USER_ID })
  }
}

export class AppYjsRoom extends YjsRoom<Env> {}
export class AppCanvasRoom extends CanvasRoom<Env> {}
export class AppPresenceRoom extends PresenceRoom<Env> {}

/**
 * AppCronRoom — runs scheduled tasks defined in src/cron.ts.
 *
 * Tasks are configured at construction time. The DO alarm fires at the
 * next interval / cron-expression match, calls `onTask(name)`, and
 * records the execution in its `cron_history` table. Admin clients can
 * watch via the `useCronMonitor('app:<APP_NAME>')` hook.
 */
export class AppCronRoom extends CronRoom<Env> {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env, { tasks: cronTasks })
  }

  protected async onTask(taskName: string): Promise<void> {
    await runCronTask(taskName, this.env)
  }
}

/**
 * AppJobRoom — durable background-job queue defined in src/jobs.ts.
 *
 * Use this for any work that needs to outlive an HTTP response: AI
 * generation, exports, renders, scheduled side effects. The DO alarm
 * picks up queued jobs and calls `onJob(job, ctx)`; crashes mid-run are
 * recovered automatically. Clients enqueue and subscribe via the
 * `useJobs('app:<APP_NAME>')` hook; server-side code uses the
 * `enqueueJob` helper from 'deepspace/worker'.
 */
export class AppJobRoom extends JobRoom<Env> {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env)
  }

  protected async onJob(job: Job, ctx: JobContext): Promise<unknown> {
    return await runJob(job, ctx, this.env)
  }
}

// =============================================================================
// Types
// =============================================================================

export interface Env extends DOBindings<typeof __DO_MANIFEST__> {
  ASSETS: Fetcher
  /**
   * Upstream platform-worker. In production this is a [[services]] binding;
   * in `deepspace dev` the binding is absent and the helper falls back to
   * `PLATFORM_WORKER_URL` (written into .dev.vars by the CLI).
   *
   * R2 lives on the platform side, not the app: the `/api/files/*` route
   * below proxies to platform-worker `/internal/files/*` which serves a
   * shared `APP_FILES` bucket scoped per-app via the `?scope=` query:
   *   - `?scope=app`  → apps/<APP_NAME>/…       (per-app shared)
   *   - `?scope=self` → apps/<APP_NAME>/users/<userId>/…  (per-user, default)
   *
   * Apps don't need a local R2 binding for the standard flow. If you need
   * a wholly separate bucket, add `[[r2_buckets]]` to wrangler.toml AND a
   * field here — but prefer the proxied path so the platform retains
   * unified moderation / quota / cleanup hooks.
   */
  PLATFORM_WORKER?: Fetcher
  PLATFORM_WORKER_URL?: string
  APP_IDENTITY_TOKEN: string
  /**
   * Upstream api-worker. Same pattern as PLATFORM_WORKER above —
   * binding in prod, URL fallback in dev.
   */
  API_WORKER?: Fetcher
  API_WORKER_URL?: string
  AUTH_JWT_PUBLIC_KEY: string
  AUTH_JWT_ISSUER: string
  AUTH_WORKER_URL: string
  APP_NAME: string
  DEEPSPACE_APP_ID: string
  OWNER_USER_ID: string
  /**
   * Long-lived JWT minted for the app owner at deploy time. Server-side
   * code (actions, cron, AI helpers) uses this to authenticate to the
   * api-worker for developer-billed calls — the owner is billed because
   * they are the JWT subject.
   */
  APP_OWNER_JWT: string
  /**
   * Email delivery (Stage 4). Optional, with sensible defaults:
   *   EMAIL_FROM — the verified sender once a domain is verified at resend.com.
   *     Until then Resend test mode only delivers to the owner's own verified
   *     address, so the default `onboarding@resend.dev` sender is used.
   *   APP_URL — deployed origin for the footer manage/pause link. Defaults to
   *     `https://<APP_NAME>.app.space`.
   * Set both below the SDK divider in .dev.vars to override.
   */
  EMAIL_FROM?: string
  APP_URL?: string
  /**
   * When set to "true", the app worker exposes /api/debug/* (set-role,
   * sql, query, records, status) by forwarding to the RecordRoom DO's
   * debug handler. Tests need this for role elevation and state cleanup.
   *
   * The CLI writes this to .dev.vars on `deepspace dev`/`deepspace test`
   * but never to production secrets, so deployed apps don't expose
   * debug routes by default.
   */
  ALLOW_DEBUG_ROUTES?: string
}

export type AppContext = { Bindings: Env }

// =============================================================================
// App
// =============================================================================

const app = new Hono<AppContext>()
app.use('/api/*', cors())

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function jwtConfig(env: Env): JwtVerifierConfig {
  return { publicKey: env.AUTH_JWT_PUBLIC_KEY, issuer: env.AUTH_JWT_ISSUER }
}

async function resolveAuth(req: Request, env: Env): Promise<VerifyResult | null> {
  const header = req.headers.get('Authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return null
  return (await verifyJwt(jwtConfig(env), token)).result
}

// ---------------------------------------------------------------------------
// Social OAuth redirect + code exchange
// ---------------------------------------------------------------------------

app.get('/api/auth/social-redirect', (c) => {
  const provider = c.req.query('provider')
  if (!provider) return c.json({ error: 'Missing provider' }, 400)

  const appOrigin = new URL(c.req.url).origin
  const authOrigin = new URL(c.env.AUTH_WORKER_URL).origin

  return c.redirect(
    `${authOrigin}/login/social?provider=${encodeURIComponent(provider)}&returnTo=${encodeURIComponent(appOrigin)}`,
  )
})

app.get('/api/auth/oauth-complete', async (c) => {
  const code = c.req.query('code')
  const appOrigin = new URL(c.req.url).origin

  if (!code) return c.redirect(appOrigin)

  const res = await authWorkerFetch(c.env, '/api/auth/exchange-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  })

  if (!res.ok) return c.redirect(appOrigin)
  const data = (await res.json()) as { sessionToken?: string }
  if (!data.sessionToken) return c.redirect(appOrigin)
  const sessionToken = data.sessionToken

  return new Response(null, {
    status: 302,
    headers: {
      Location: appOrigin,
      'Set-Cookie': `__Secure-better-auth.session_token=${encodeURIComponent(sessionToken)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`,
    },
  })
})

app.all('/api/auth/sign-out', async (c) => {
  try {
    await authWorkerFetch(c.env, '/api/auth/sign-out', {
      method: c.req.method,
      headers: c.req.raw.headers,
      body: c.req.method !== 'GET' && c.req.method !== 'HEAD' ? c.req.raw.body : undefined,
    })
  } catch {
    // Still expire the app-scoped cookie below. A network/auth-worker
    // failure must not leave the browser immediately signed back in.
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': '__Secure-better-auth.session_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    },
  })
})

// ---------------------------------------------------------------------------
// Auth proxy → auth-worker (same-origin cookies)
// ---------------------------------------------------------------------------

app.all('/api/auth/*', async (c) => {
  const url = new URL(c.req.url)
  const res = await authWorkerFetch(c.env, url.pathname + url.search, {
    method: c.req.method,
    headers: c.req.raw.headers,
    body: c.req.method !== 'GET' && c.req.method !== 'HEAD' ? c.req.raw.body : undefined,
  })
  const headers = new Headers(res.headers)
  const setCookie = headers.get('set-cookie')
  if (setCookie) {
    headers.set('set-cookie', setCookie.replace(/;\s*Domain=[^;]*/gi, ''))
  }
  return new Response(res.body, { status: res.status, headers })
})

// ---------------------------------------------------------------------------
// Debug proxy → app's RecordRoom DO
//
// Forwards /api/debug/* (set-role, sql, query, records, user-role, status)
// to the DO's debug handler. The DO ships these endpoints unconditionally,
// so we gate the proxy on env.ALLOW_DEBUG_ROUTES === "true". The CLI
// writes that env var to .dev.vars on `deepspace dev`/`deepspace test`,
// never to deploy secrets — so production apps return 404 here.
// ---------------------------------------------------------------------------

app.all('/api/debug/*', async (c) => {
  if (c.env.ALLOW_DEBUG_ROUTES !== 'true') {
    return c.notFound()
  }
  const stub = c.env.RECORD_ROOMS.get(c.env.RECORD_ROOMS.idFromName(`app:${c.env.APP_NAME}`))
  // Forward verbatim, preserving method, headers, body, and the full URL
  // (the DO's debug handler dispatches on url.pathname).
  return stub.fetch(c.req.raw)
})

// ---------------------------------------------------------------------------
// Integrations proxy → api-worker
// ---------------------------------------------------------------------------

app.get('/api/integrations', async (c) => {
  try {
    const res = await apiWorkerFetch(c.env, '/api/integrations')
    return new Response(res.body, { status: res.status, headers: res.headers })
  } catch {
    return c.json({ error: 'Failed to fetch integration catalog' }, 502)
  }
})

// OAuth: per-user connection status. Always user-billed — must forward caller's JWT.
app.get('/api/integrations/status', async (c) => {
  const auth = await resolveAuth(c.req.raw, c.env)
  if (!auth) return c.json({ error: 'Sign in required' }, 401)
  const token = c.req.header('Authorization')?.slice(7)
  try {
    const res = await apiWorkerFetch(c.env, '/api/integrations/status', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    return new Response(res.body, { status: res.status, headers: res.headers })
  } catch {
    return c.json({ error: 'Status proxy failed' }, 502)
  }
})

// OAuth: disconnect a provider for the calling user. Always user-billed.
app.delete('/api/integrations/oauth/:provider/disconnect', async (c) => {
  const auth = await resolveAuth(c.req.raw, c.env)
  if (!auth) return c.json({ error: 'Sign in required' }, 401)
  const token = c.req.header('Authorization')?.slice(7)
  const provider = c.req.param('provider')
  try {
    const res = await apiWorkerFetch(
      c.env,
      `/api/integrations/oauth/${encodeURIComponent(provider)}/disconnect`,
      {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    )
    return new Response(res.body, { status: res.status, headers: res.headers })
  } catch {
    return c.json({ error: 'Disconnect proxy failed' }, 502)
  }
})

app.all('/api/integrations/:name/:endpoint', async (c) => {
  const integrationName = c.req.param('name')
  const billingMode = integrations[integrationName]?.billing ?? 'developer'

  const auth = await resolveAuth(c.req.raw, c.env)
  if (!auth) return c.json({ error: 'Sign in required' }, 401)
  // developer-billed integrations spend the owner's credits — owner only.
  if (billingMode === 'developer' && auth.userId !== c.env.OWNER_USER_ID) {
    return c.json({ error: 'Owner only' }, 403)
  }

  const target = `/api/integrations/${integrationName}/${c.req.param('endpoint')}`

  const headers: Record<string, string> = {
    'Content-Type': c.req.header('Content-Type') ?? 'application/json',
  }

  // Pick the JWT whose subject is the user we want billed:
  //   - developer-billed → the app owner (via APP_OWNER_JWT)
  //   - user-billed      → the caller (forward their Bearer token)
  // The api-worker bills the JWT subject; it does not accept any
  // client-supplied billing override.
  if (billingMode === 'developer') {
    headers['Authorization'] = `Bearer ${c.env.APP_OWNER_JWT}`
  } else {
    const token = c.req.header('Authorization')?.slice(7)
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  const hasBody = c.req.method !== 'GET' && c.req.method !== 'HEAD'
  const body = hasBody ? await c.req.text() : undefined

  try {
    const res = await apiWorkerFetch(c.env, target, {
      method: c.req.method,
      headers,
      body,
    })
    return new Response(res.body, { status: res.status, headers: res.headers })
  } catch {
    return c.json({ error: 'Integration proxy failed' }, 502)
  }
})

// ---------------------------------------------------------------------------
// WebSocket routes
// ---------------------------------------------------------------------------

// The DO reads identity (userId, userName, userEmail, userImageUrl, role)
// off the URL it receives and trusts it. Anything the client put on the URL
// is stripped on every code path; identity is re-applied only from a
// verified JWT. Three states: no token = anonymous (the SDK's
// allowAnonymous flow), invalid token = 401, valid token = JWT identity.
function wsRoute(
  doNamespace: (env: Env) => DurableObjectNamespace,
  extraParams?: (auth: VerifyResult, env: Env) => Record<string, string>,
) {
  return async (c: any) => {
    const id = c.req.param('roomId') ?? c.req.param('docId') ?? c.req.param('scopeId')
    const url = new URL(c.req.url)
    const token = url.searchParams.get('token')

    let auth: VerifyResult | null = null
    if (token) {
      auth = (await verifyJwt(jwtConfig(c.env), token)).result
      if (!auth) return new Response('Unauthorized', { status: 401 })
    }

    const doUrl = new URL(c.req.url)
    doUrl.searchParams.delete('token')
    for (const k of ['userId', 'userName', 'userEmail', 'userImageUrl', 'role']) {
      doUrl.searchParams.delete(k)
    }

    if (auth) {
      doUrl.searchParams.set('userId', auth.userId)
      if (auth.claims.name) doUrl.searchParams.set('userName', auth.claims.name)
      if (auth.claims.email) doUrl.searchParams.set('userEmail', auth.claims.email)
      if (auth.claims.image) doUrl.searchParams.set('userImageUrl', auth.claims.image)
      if (extraParams) {
        for (const [k, v] of Object.entries(extraParams(auth, c.env))) {
          doUrl.searchParams.set(k, v)
        }
      }
    }

    const ns = doNamespace(c.env)
    const stub = ns.get(ns.idFromName(id))
    return stub.fetch(new Request(doUrl.toString(), c.req.raw))
  }
}

app.get(
  '/ws/:roomId',
  wsRoute((env) => env.RECORD_ROOMS),
)

type DocsYjsRole = 'admin' | 'member' | 'viewer'

interface DocumentRecordForAccess {
  ownerId?: string
  collaborators?: string
  editors?: string
}

type DocumentAccessLookup =
  | { kind: 'found'; doc: DocumentRecordForAccess }
  | { kind: 'not-docs-room' }
  | { kind: 'error' }

function parseAccessList(raw: string | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

async function getDocumentForAccess(
  env: Env,
  docId: string,
): Promise<DocumentAccessLookup> {
  const stub = env.RECORD_ROOMS.get(env.RECORD_ROOMS.idFromName(`app:${env.APP_NAME}`))
  try {
    const res = await stub.fetch(
      new Request('https://internal/api/tools/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': env.OWNER_USER_ID,
          'X-App-Action': 'true',
        },
        body: JSON.stringify({
          tool: 'records.get',
          params: { collection: 'documents', recordId: docId },
        }),
      }),
    )
    const json = (await res.json()) as {
      success?: boolean
      error?: string
      data?: { record?: { data?: DocumentRecordForAccess } }
    }
    if (json.success && json.data?.record?.data) {
      return { kind: 'found', doc: json.data.record.data }
    }
    if (
      json.error === 'Record not found' ||
      json.error?.startsWith('Schema not registered for collection: documents')
    ) {
      return { kind: 'not-docs-room' }
    }
    return { kind: 'error' }
  } catch {
    return { kind: 'error' }
  }
}

async function resolveDocsYjsRole(
  env: Env,
  docId: string,
  userId: string,
): Promise<DocsYjsRole | null> {
  const lookup = await getDocumentForAccess(env, docId)
  if (lookup.kind === 'not-docs-room') return 'member'
  if (lookup.kind === 'error') return null
  const { doc } = lookup
  if (doc.ownerId === userId || userId === env.OWNER_USER_ID) return 'admin'

  const editors = parseAccessList(doc.editors)
  if (editors.includes(userId)) return 'member'

  const collaborators = parseAccessList(doc.collaborators)
  if (collaborators.includes(userId)) return 'viewer'

  return null
}

app.get('/ws/yjs/:docId', async (c) => {
  const docId = c.req.param('docId')
  const url = new URL(c.req.url)
  const token = url.searchParams.get('token')
  const auth = token ? (await verifyJwt(jwtConfig(c.env), token)).result : null
  if (!auth) return new Response('Unauthorized', { status: 401 })

  const role = await resolveDocsYjsRole(c.env, docId, auth.userId)
  if (!role) return new Response('Forbidden', { status: 403 })

  const doUrl = new URL(c.req.url)
  doUrl.searchParams.set('userId', auth.userId)
  doUrl.searchParams.set('role', role)
  doUrl.searchParams.delete('token')

  const stub = c.env.YJS_ROOMS.get(c.env.YJS_ROOMS.idFromName(docId))
  return stub.fetch(new Request(doUrl.toString(), c.req.raw))
})

app.get(
  '/ws/canvas/:docId',
  wsRoute(
    (env) => env.CANVAS_ROOMS,
    () => ({ role: 'member' }),
  ),
)

app.get(
  '/ws/presence/:scopeId',
  wsRoute(
    (env) => env.PRESENCE_ROOMS,
    (auth) => ({
      ...(auth.claims.name ? { userName: auth.claims.name } : {}),
      ...(auth.claims.email ? { userEmail: auth.claims.email } : {}),
      ...(auth.claims.image ? { userImageUrl: auth.claims.image } : {}),
    }),
  ),
)

app.get(
  '/ws/cron/:roomId',
  wsRoute(
    (env) => env.CRON_ROOMS,
    // Owner-only write access. Cron tasks are owner-billed, so only the app
    // owner may trigger / pause / resume them. Everyone else falls through with
    // no role and is a read-only viewer (CronRoom enforces that server-side).
    // The scaffold default granted 'member' to any signed-in user, which would
    // let them fire owner-billed work.
    (auth, env): Record<string, string> =>
      auth.userId === env.OWNER_USER_ID ? { role: 'admin' } : {},
  ),
)

// Jobs are owner-billed generation and JobRoom does not role-gate its messages,
// so only the owner may connect (watch / enqueue / cancel / retry). Non-owners
// are rejected outright rather than merely denied a role.
app.get('/ws/jobs/:roomId', async (c) => {
  const token = new URL(c.req.url).searchParams.get('token')
  const auth = token ? (await verifyJwt(jwtConfig(c.env), token)).result : null
  if (!auth) return new Response('Unauthorized', { status: 401 })
  if (auth.userId !== c.env.OWNER_USER_ID) return new Response('Forbidden', { status: 403 })
  return wsRoute((env) => env.JOB_ROOMS)(c)
})

// ---------------------------------------------------------------------------
// Server actions
// ---------------------------------------------------------------------------

app.post('/api/actions/:name', async (c) => {
  const auth = await resolveAuth(c.req.raw, c.env)
  if (!auth) return c.json({ error: 'Unauthorized' }, 401)
  const name = c.req.param('name')
  const action = actions[name]
  if (!action) return c.json({ error: 'Action not found' }, 404)
  const params = await c.req.json<Record<string, unknown>>()
  const callerJwt = c.req.header('Authorization')!.slice(7)
  const tools = createActionTools(c.env, auth.userId, callerJwt)
  const result = await action({ userId: auth.userId, params, tools, env: c.env, callerJwt })
  return c.json(result as unknown as Record<string, unknown>)
})

// ---------------------------------------------------------------------------
// Scout generation API — owner-gated (single-user app; the owner is unmetered
// and the only writer). Both routes verify the JWT subject is OWNER_USER_ID so
// no other signed-in user can spend owner-billed AI / search.
// ---------------------------------------------------------------------------

async function requireOwner(c: any): Promise<VerifyResult | Response> {
  const auth = await resolveAuth(c.req.raw, c.env)
  if (!auth) return c.json({ error: 'Sign in required' }, 401)
  if (auth.userId !== c.env.OWNER_USER_ID) return c.json({ error: 'Owner only' }, 403)
  return auth
}

// scout's-read: a rough topic becomes a sharp, concrete scope. Sync, Haiku.
app.post('/api/scouts-read', async (c) => {
  const gate = await requireOwner(c)
  if (gate instanceof Response) return gate
  const body = await c.req.json<{ topic?: string }>().catch(() => ({}) as { topic?: string })
  const topic = (body.topic ?? '').trim()
  if (!topic) return c.json({ error: 'A topic is required' }, 400)
  try {
    const result = await runScoutsRead(c.env, topic)
    return c.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: `Scout could not read that topic: ${message}` }, 502)
  }
})

// generate: create a draft issue, then enqueue the generate-issue job (send-now).
// Non-blocking; the UI watches the draft issue go ready over live records.
app.post('/api/generate', async (c) => {
  const gate = await requireOwner(c)
  if (gate instanceof Response) return gate
  const auth = gate
  const body = await c.req
    .json<{ newsletterId?: string }>()
    .catch(() => ({}) as { newsletterId?: string })
  const newsletterId = (body.newsletterId ?? '').trim()
  if (!newsletterId) return c.json({ error: 'newsletterId is required' }, 400)

  const callerJwt = c.req.header('Authorization')!.slice(7)
  const tools = createActionTools(c.env, auth.userId, callerJwt)

  // Confirm the newsletter exists and belongs to the owner before spending.
  const found = await tools.get('newsletters', newsletterId)
  if (!found.success || !found.data?.record) {
    return c.json({ error: 'Newsletter not found' }, 404)
  }

  // Number the issue from the count of existing issues for this newsletter.
  const existing = await tools.query('issues', { where: { newsletterId } })
  const existingRows = existing.success && Array.isArray(existing.data?.records) ? existing.data.records : []

  // Double-submit guard: if a draft is already in flight for this newsletter
  // (a double-click), return it instead of creating a second draft + a second
  // Job, which would mean two emails and two charges.
  const inFlight = existingRows.find((r) => r.data.status === 'draft')
  if (inFlight) {
    return c.json({ issueId: inFlight.recordId, jobId: null, alreadyGenerating: true })
  }

  const number = existingRows.length + 1

  const created = await tools.create('issues', {
    newsletterId,
    number,
    status: 'draft',
    emailStatus: 'pending',
    version: 1,
  })
  if (!created.success || !created.data?.recordId) {
    return c.json({ error: 'Could not create the draft issue' }, 500)
  }
  const issueId = created.data.recordId

  const jobId = await enqueueJob(
    c.env.JOB_ROOMS,
    `app:${c.env.APP_NAME}`,
    'generate-issue',
    { newsletterId, issueId, trigger: 'manual' },
    { maxAttempts: 1, enqueuedBy: auth.userId },
  )

  return c.json({ issueId, jobId })
})

// ---------------------------------------------------------------------------
// Companion — agentic chat over an issue, plus regenerate-as-version.
//
// Both routes are owner-gated. The chat turn grounds in the current issue and
// the reader profile, gives Laila two web tools (look_it_up, read_source) she
// reasons about when the issue lacks a fact, streams Sonnet, and persists both
// the user and the assistant message. The profile is updated from the exchange.
// ---------------------------------------------------------------------------

interface CompanionContext {
  newsletter: { recordId: string; data: Record<string, unknown> }
  issue: { recordId: string; data: Record<string, unknown> }
  history: ChatTurn[]
}

/** Load the issue, its newsletter, and the issue's chat history (owner context). */
async function loadCompanionContext(
  tools: ActionTools,
  issueId: string,
): Promise<CompanionContext | { error: string; status: 404 }> {
  const issueRes = await tools.get<Record<string, unknown>>('issues', issueId)
  if (!issueRes.success || !issueRes.data?.record) return { error: 'Issue not found', status: 404 }
  const issueRecord = issueRes.data.record
  const newsletterId = String(issueRecord.data.newsletterId ?? '')

  const nlRes = await tools.get<Record<string, unknown>>('newsletters', newsletterId)
  if (!nlRes.success || !nlRes.data?.record) return { error: 'Newsletter not found', status: 404 }

  const chatRes = await tools.query<Record<string, unknown>>('chats', { where: { issueId } })
  const rows = chatRes.success && Array.isArray(chatRes.data?.records) ? chatRes.data.records : []
  // The chat row's timestamp comes from the record envelope (createdAt, ISO),
  // not the data: the chats schema stores no createdAt column.
  const history: ChatTurn[] = rows
    .map((r) => ({
      chatId: r.recordId,
      role: r.data.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: typeof r.data.content === 'string' ? r.data.content : '',
      createdAt: Date.parse(r.createdAt) || 0,
    }))
    .filter((t) => t.content.trim())

  return {
    newsletter: { recordId: nlRes.data.record.recordId, data: nlRes.data.record.data },
    issue: { recordId: issueRecord.recordId, data: issueRecord.data },
    history,
  }
}

/** Pull the companion's view of the issue (title, lead, real sources) from a row. */
function issueForCompanion(data: Record<string, unknown>): CompanionIssue {
  const sections = Array.isArray(data.sections) ? (data.sections as IssueSection[]) : []
  return {
    title: typeof data.title === 'string' ? data.title : 'this issue',
    lead: typeof data.lead === 'string' ? data.lead : '',
    sections,
  }
}

/** Persist one chat row (owner context) and return its id so the caller can embed it. */
async function persistChatTurn(
  tools: ActionTools,
  args: {
    issueId: string
    newsletterId: string
    role: 'user' | 'assistant'
    content: string
    // The assistant turn's structured render (text + tool blocks). `content`
    // stays the fallback; user rows omit this and the column defaults to [].
    parts?: ChatPart[]
  },
): Promise<string | undefined> {
  // The chats schema has no createdAt column; the record envelope timestamps it.
  const created = await tools.create('chats', {
    issueId: args.issueId,
    newsletterId: args.newsletterId,
    role: args.role,
    content: args.content,
    ...(args.parts && args.parts.length ? { parts: args.parts } : {}),
  })
  return created.success ? created.data?.recordId : undefined
}

/**
 * The single profile row for the owner, with its recordId. The collection is
 * userBound and single-owner, so the owner context returns at most one row.
 * `tools.create` mints its own recordId (it does not honor the owner id), so we
 * query for the existing row rather than getting it by a deterministic key.
 */
async function getProfileRow(
  tools: ActionTools,
): Promise<{ recordId: string; profile: ReaderProfile } | null> {
  const res = await tools.query<Record<string, unknown>>('profile', {})
  const rows = res.success && Array.isArray(res.data?.records) ? res.data.records : []
  // Pick the oldest row by envelope createdAt so the read stays stable even if a
  // rare duplicate profile row ever exists (no split-brain memory across reads).
  const row = [...rows].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))[0]
  if (!row) return null
  return { recordId: row.recordId, profile: profileFromRow(row.data) }
}

/** Read the owner's profile, or an empty profile when no row exists yet. */
async function readProfile(tools: ActionTools): Promise<ReaderProfile> {
  return (await getProfileRow(tools))?.profile ?? emptyProfile()
}

/**
 * The memory write: one cheap gated Haiku call extracts durable deltas from the
 * latest exchange, merged into the profile under the deterministic caps + dedupe
 * in src/lib/profile. Writes the single row ONLY when the merge changed
 * something. Runs in waitUntil, so a failure never affects the reply. Best-effort.
 */
async function updateProfileFromExchange(
  env: Env,
  tools: ActionTools,
  exchange: { userMessage: string; assistantReply: string },
): Promise<void> {
  const anthropic = createDeepSpaceAI(env, 'anthropic')
  const { text } = await generateText({
    model: anthropic(MODELS.haiku),
    system: profileExtract,
    prompt: `Reader: ${exchange.userMessage}\nLaila: ${exchange.assistantReply}`,
    maxOutputTokens: MODELS.profileExtractMaxOutputTokens,
  })
  const extraction = parseExtraction(text)
  if (!extraction.addFacts.length && !extraction.addInterests.length && !extraction.displayName && !extraction.tonePref) {
    return
  }

  const existing = await getProfileRow(tools)
  const { profile, changed } = mergeProfile(existing?.profile ?? emptyProfile(), extraction)
  if (!changed) return

  if (existing) {
    await tools.update('profile', existing.recordId, profileToRow(profile))
  } else {
    await tools.create('profile', profileToRow(profile))
  }
}

// Result-size caps so a tool result stays cheap for the next model step.
const LOOKUP_MAX_SOURCES = 5
const LOOKUP_MAX_ANSWER_CHARS = 4000
const READ_SOURCE_MAX_CHARS = 4000

interface ExaCitation {
  url?: unknown
  title?: unknown
}
interface ExaAnswerData {
  answer?: unknown
  citations?: unknown
}
interface ExaContentResult {
  url?: unknown
  title?: unknown
  text?: unknown
}
interface ExaContentsData {
  results?: unknown
}

function asStr(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

/** A readable host label for a source when the page gives no title. */
function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * The two web tools Laila reasons about. Both are developer-billed (exa is the
 * default 'developer' integration, so callIntegration forwards APP_OWNER_JWT and
 * the owner pays, pass-through). Each executor is honest and never throws: any
 * non-success or empty upstream becomes a short structured "no result" the model
 * can read and keep going from, never an exception that kills the turn. Results
 * are capped here so the next step stays cheap. The shapes are a contract the
 * frontend reads for live source chips: do not change them.
 */
function createCompanionTools(tools: ActionTools) {
  return {
    look_it_up: tool({
      description:
        'Look up a fact the current issue does not contain (a price, a spec, a number, a recent development). Returns a short synthesized answer with its cited sources.',
      inputSchema: z.object({
        query: z.string().describe('A focused question, e.g. "current price of the Framework 13 base model".'),
      }),
      execute: async ({ query }): Promise<{ answer: string; sources: { name: string; url: string }[] }> => {
        try {
          // text:true so citations carry their page text; query is the question.
          const res = await tools.integration<ExaAnswerData>('exa/answer', { query, text: true })
          if (!res.success || !res.data) return { answer: 'Could not look that up right now.', sources: [] }
          const answer = asStr(res.data.answer).slice(0, LOOKUP_MAX_ANSWER_CHARS)
          const citations = Array.isArray(res.data.citations) ? (res.data.citations as ExaCitation[]) : []
          const sources = citations
            .map((c) => {
              const url = asStr(c.url)
              return url ? { name: asStr(c.title) || hostLabel(url), url } : null
            })
            .filter((s): s is { name: string; url: string } => s !== null)
            .slice(0, LOOKUP_MAX_SOURCES)
          if (!answer && sources.length === 0) return { answer: 'Found nothing useful for that.', sources: [] }
          return { answer, sources }
        } catch {
          return { answer: 'Could not look that up right now.', sources: [] }
        }
      },
    }),
    read_source: tool({
      description:
        'Read the clean full text of one web page to go deeper on a url the issue cites or that look_it_up surfaced. Returns the page text, capped.',
      inputSchema: z.object({
        url: z.string().describe('The exact url of the page to read.'),
      }),
      execute: async ({ url }): Promise<{ url: string; name: string; text: string }> => {
        try {
          const res = await tools.integration<ExaContentsData>('exa/contents', {
            urls: [url],
            text: { maxCharacters: READ_SOURCE_MAX_CHARS },
          })
          const results = res.success && res.data && Array.isArray(res.data.results)
            ? (res.data.results as ExaContentResult[])
            : []
          const first = results[0]
          const text = asStr(first?.text).slice(0, READ_SOURCE_MAX_CHARS)
          const name = asStr(first?.title) || hostLabel(url)
          if (!text) return { url, name, text: 'Could not read that page right now.' }
          return { url, name, text }
        } catch {
          return { url, name: hostLabel(url), text: 'Could not read that page right now.' }
        }
      },
    }),
  }
}

// companion: the streaming, agentic chat turn.
app.post('/api/companion', async (c) => {
  const gate = await requireOwner(c)
  if (gate instanceof Response) return gate
  const auth = gate
  const body = await c.req
    .json<{ issueId?: string; message?: string }>()
    .catch(() => ({}) as { issueId?: string; message?: string })
  const issueId = (body.issueId ?? '').trim()
  const message = (body.message ?? '').trim()
  if (!issueId) return c.json({ error: 'issueId is required' }, 400)
  if (!message) return c.json({ error: 'A message is required' }, 400)

  const callerJwt = c.req.header('Authorization')!.slice(7)
  const tools = createActionTools(c.env, auth.userId, callerJwt)

  const ctx = await loadCompanionContext(tools, issueId)
  if ('error' in ctx) return c.json({ error: ctx.error }, ctx.status)

  const cfg = toConfig(ctx.newsletter.data)
  const issue = issueForCompanion(ctx.issue.data)
  // The one profile row, read at the top of the turn (single DB read, no LLM).
  const profile = await readProfile(tools)
  const assembled = await assembleContext(c.env, { history: ctx.history, userMessage: message })

  const system = buildCompanionPrompt({
    issue,
    voiceLabel: voiceLabelFor(cfg),
    profile,
  })

  // Owner-billed Sonnet (single-user app, owner is the JWT subject; omit
  // authToken so it falls back to APP_OWNER_JWT). Laila reasons about two
  // owner-billed web tools when the issue lacks a fact; she does not read or
  // write records. Cap the live message that goes into the prompt so a multi-KB
  // paste can't blow the input budget. The full message is still persisted.
  const promptMessage = message.slice(0, 6000)

  const anthropic = createDeepSpaceAI(c.env, 'anthropic')
  const result = streamText({
    model: anthropic(MODELS.sonnet),
    system,
    messages: [...assembled.history, { role: 'user', content: promptMessage }],
    tools: createCompanionTools(tools),
    maxOutputTokens: MODELS.companionMaxOutputTokens,
    // A few tool round-trips, then a final answer.
    stopWhen: stepCountIs(MODELS.companionMaxSteps),
    abortSignal: c.req.raw.signal,
    onFinish: async ({ text, steps }) => {
      // Persist both turns (fast DB writes that feed the live UI), user row
      // first so history never reads an assistant with no prompt. The profile
      // extraction is best-effort memory: it runs in waitUntil so it never
      // delays or hangs the reply the reader already saw.
      const newsletterId = ctx.newsletter.recordId
      // Save the full visible reply across every step, not just the final step's
      // text: if Laila says a line before calling a tool, the reader saw it
      // stream, so the persisted thread must keep it too.
      const reply = (steps?.length ? steps.map((s) => s.text).join('') : text).trim()
      // The structured render of the turn, built from the same steps in order:
      // text segments interleaved with the tool calls (with their chip sources),
      // so a reloaded thread shows Laila's tool notes exactly as they streamed.
      const parts = steps?.length ? partsFromSteps(steps) : []
      await persistChatTurn(tools, { issueId, newsletterId, role: 'user', content: message })
      if (reply) await persistChatTurn(tools, { issueId, newsletterId, role: 'assistant', content: reply, parts })

      if (reply) {
        c.executionCtx.waitUntil(
          updateProfileFromExchange(c.env, tools, { userMessage: message, assistantReply: reply }).catch(() => {}),
        )
      }
    },
  })

  return result.toUIMessageStreamResponse({ sendReasoning: false })
})

// companion/regenerate: re-run the compose stage with the conversation as extra
// instructions and write a NEW issue version. The original issue is preserved.
app.post('/api/companion/regenerate', async (c) => {
  const gate = await requireOwner(c)
  if (gate instanceof Response) return gate
  const auth = gate
  const body = await c.req
    .json<{ issueId?: string; message?: string }>()
    .catch(() => ({}) as { issueId?: string; message?: string })
  const issueId = (body.issueId ?? '').trim()
  const latestUser = (body.message ?? '').trim()
  if (!issueId) return c.json({ error: 'issueId is required' }, 400)

  const callerJwt = c.req.header('Authorization')!.slice(7)
  const tools = createActionTools(c.env, auth.userId, callerJwt)

  const ctx = await loadCompanionContext(tools, issueId)
  if ('error' in ctx) return c.json({ error: ctx.error }, ctx.status)

  const cfg = toConfig(ctx.newsletter.data)
  const issue = issueForCompanion(ctx.issue.data)
  if (issue.sections.length === 0) {
    return c.json({ error: 'This issue has no stories to revise yet' }, 400)
  }

  let composed
  try {
    composed = await regenerateFromConversation(c.env, {
      cfg,
      issue,
      history: ctx.history,
      latestUser,
    })
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err)
    return c.json({ error: `Regenerate failed: ${m}` }, 502)
  }
  if (!composed.issue) {
    return c.json({ error: 'The writer returned no usable revision. Try again with a clearer ask.' }, 502)
  }

  // Write the revision as a new version pointing back at the original. The
  // original row is never touched. Number is shared with the original so the
  // history groups versions of the same edition together.
  const original = ctx.issue.data
  const newsletterId = ctx.newsletter.recordId
  const baseNumber = typeof original.number === 'number' ? original.number : 1
  const baseVersion = typeof original.version === 'number' ? original.version : 1
  const generatedAt = Date.now()

  const created = await tools.create('issues', {
    newsletterId,
    number: baseNumber,
    title: composed.issue.title,
    lead: composed.issue.lead,
    sections: composed.issue.sections,
    status: 'ready',
    emailStatus: 'skipped',
    version: baseVersion + 1,
    parentIssueId: issueId,
    modelUsed: MODELS.sonnet,
    generatedAt,
  })
  if (!created.success || !created.data?.recordId) {
    return c.json({ error: 'Could not save the revised issue' }, 500)
  }
  const newIssueId = created.data.recordId

  return c.json({ issueId: newIssueId, version: baseVersion + 1 })
})

// config-health: honest checks (owner email set, email deliverable, search
// reachable, model wired, scheduler queued, storage reachable) that feed the
// Settings panel and the rail dot. Thin and owner-gated; nothing here throws (a
// failed check is a status, never a crash), so the panel always renders the truth.
//
// Every row has a REAL basis and none fakes a green: owner/email/storage from a
// records read, model from the owner credential being wired (we do not bill a
// live model ping on every open), scheduler from the cron binding + a count of
// active beats queued for a future run. The integrations check is an owner-BILLED
// Exa search, so it runs only with ?probe=1 (an explicit Settings open or
// refresh). The rail dot polls without the flag, so it never spends a search; it
// gets integrations: 'unknown' and the client caches a recent deep result.
app.get('/api/config-health', async (c) => {
  const gate = await requireOwner(c)
  if (gate instanceof Response) return gate
  const auth = gate
  const callerJwt = c.req.header('Authorization')!.slice(7)
  const tools = createActionTools(c.env, auth.userId, callerJwt)

  // owner + storage: read the owner's email off the users row. A successful read
  // is also direct proof the records store is reachable (the storage signal).
  let email = ''
  let recordsReachable = false
  try {
    const found = await tools.get<{ email?: unknown }>('users', c.env.OWNER_USER_ID)
    recordsReachable = found.success
    const raw = found.success ? found.data?.record?.data?.email : undefined
    email = typeof raw === 'string' ? raw.trim() : ''
  } catch {
    email = ''
  }
  const owner = ownerCheck(email)
  const emailHealth = emailCheck(owner.status, c.env.EMAIL_FROM)

  // model: the owner-billed proxy is wired when the owner credential is present.
  // We do not ping a model here (that would bill the owner on every open).
  const model = modelCheck(Boolean(c.env.APP_OWNER_JWT))

  // scheduler: cron DO bound + count of active beats queued for a future run.
  let scheduled = 0
  try {
    const beats = await tools.query<{ status?: unknown; nextSendAt?: unknown }>('newsletters', {})
    const rows = beats.success && Array.isArray(beats.data?.records) ? beats.data.records : []
    scheduled = countScheduled(rows as { data?: { status?: unknown; nextSendAt?: unknown } }[], Date.now())
  } catch {
    scheduled = 0
  }
  const scheduler = schedulerCheck(Boolean(c.env.CRON_ROOMS), scheduled)

  const storage = storageCheck(recordsReachable)

  // integrations: one owner-billed Exa probe, only on ?probe=1. Success -> ok.
  // A thrown error or a success:false / 502-masked envelope -> down with the
  // surfaced reason. Without the flag we report 'unknown' and skip the spend.
  let integrations: ConfigHealth['integrations']
  if (c.req.query('probe') === '1') {
    try {
      const res = await tools.integration<unknown>('exa/search', { query: 'scout config health probe', numResults: 1 })
      integrations = res.success ? { status: 'ok', reason: '' } : { status: 'down', reason: probeReason(res) }
    } catch (err) {
      integrations = { status: 'down', reason: probeReason(err) }
    }
  } else {
    integrations = {
      status: 'unknown',
      reason: 'Not checked yet. Open Settings or refresh to run a live search probe.',
    }
  }

  const body: ConfigHealth = { owner, email: emailHealth, integrations, model, scheduler, storage }
  return c.json(body)
})

// ---------------------------------------------------------------------------
// Scoped R2 files → platform-worker
//
// The app has no local R2 binding by design; the platform-worker holds a
// shared `APP_FILES` bucket and scopes keys per-app via the `?scope=`
// query string:
//
//   POST   /api/files/upload?scope=app    → uploads under apps/<APP_NAME>/
//   POST   /api/files/upload              → uploads under apps/<APP_NAME>/users/<userId>/
//   GET    /api/files                     → list (same scoping)
//   GET    /api/files/<key>               → public read (no auth)
//   DELETE /api/files/<key>               → delete (auth required, scope-checked)
//
// Use `?scope=app` for content that belongs to the app as a whole (library
// preview images, AI-generated assets, etc.). Use the default user scope
// for per-user uploads (avatars, project assets). All write paths require
// a signed user JWT; reads are public.
// ---------------------------------------------------------------------------

app.all('/api/files/*', async (c) => {
  const auth = await resolveAuth(c.req.raw, c.env)
  const userId = auth?.userId ?? null

  const url = new URL(c.req.url)
  const platformUrl = new URL(c.req.url)
  platformUrl.pathname = url.pathname.replace('/api/files', '/internal/files')

  const headers = new Headers(c.req.raw.headers)
  // Strip any caller-supplied identity before re-asserting from the verified
  // JWT. platform-worker trusts `x-user-id` (gated by the HMAC'd app-identity
  // token) to scope `?scope=self` keys, so leaking a spoofed header here would
  // let an unauthenticated browser read another user's files.
  headers.delete('x-user-id')
  headers.set('x-app-identity-token', c.env.APP_IDENTITY_TOKEN)
  headers.set('x-app-id', c.env.DEEPSPACE_APP_ID)
  if (userId) headers.set('x-user-id', userId)

  const resp = await platformWorkerFetch(
    c.env,
    new Request(platformUrl.toString(), {
      method: c.req.method,
      headers,
      body: c.req.raw.body,
    }),
  )

  // Rewrite URLs in JSON responses to use the app's origin
  const contentType = resp.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const body = (await resp.json()) as Record<string, unknown>
    const rewriteUrl = (u: string) => u.replace(/^https?:\/\/[^/]+/, url.origin)
    if (typeof body.url === 'string') body.url = rewriteUrl(body.url)
    if (Array.isArray(body.files)) {
      for (const f of body.files as Array<Record<string, unknown>>) {
        if (typeof f.url === 'string') f.url = rewriteUrl(f.url)
      }
    }
    return c.json(body, resp.status as any)
  }

  return new Response(resp.body, { status: resp.status, headers: resp.headers })
})

// ---------------------------------------------------------------------------
// /_deepspace/* — same-origin proxy to api-worker for authenticated SDK
// hooks. Attaches APP_IDENTITY_TOKEN + DEEPSPACE_APP_ID so the browser never sees
// the platform secret. Every request requires a signed user JWT.
//
// SECURITY: exact (method, path) allowlist — not a prefix match. A prefix
// match leaks deploy/CLI surfaces like POST /api/subscriptions/sync into the
// browser context, where an XSS or compromised user session can become a
// confused deputy. Adding a new browser hook in the SDK requires explicitly
// extending the BROWSER_PROXY_ROUTES tuple below.
// ---------------------------------------------------------------------------

interface ProxyRoute {
  method: string
  path: string
  /** Skip the user-JWT gate. Default false. Pricing tables are public. */
  publicRead?: boolean
  /** Inject `?appId=...` (from env) into the forwarded URL. Default false. */
  injectAppId?: boolean
}

const BROWSER_PROXY_ROUTES: ReadonlyArray<ProxyRoute> = [
  // useSubscription — read state, subscribe, manage billing.
  { method: 'GET',  path: '/_deepspace/subscriptions/me' },
  { method: 'POST', path: '/_deepspace/subscriptions/checkout' },
  { method: 'POST', path: '/_deepspace/subscriptions/portal' },
  // useCheckout (one-time charges)
  { method: 'POST', path: '/_deepspace/charges/create' },
  { method: 'GET',  path: '/_deepspace/charges/me' },
]

app.all('/_deepspace/*', async (c) => {
  const url = new URL(c.req.url)
  const method = c.req.method
  const route = BROWSER_PROXY_ROUTES.find(
    (r) => r.method === method && r.path === url.pathname,
  )
  if (!route) {
    return c.json({ error: 'not_found' }, 404)
  }

  // Public-read routes (pricing tables) skip the JWT gate. Everything else
  // requires a signed-in user.
  let auth: Awaited<ReturnType<typeof resolveAuth>> | null = null
  if (!route.publicRead) {
    auth = await resolveAuth(c.req.raw, c.env)
    if (!auth?.userId) return c.json({ error: 'unauthorized' }, 401)
  }

  // Inject appId into the query string when the route needs it. We can't
  // rely on the HMAC header for routes the platform serves without HMAC
  // (e.g. /plans is public). Use URLSearchParams.set so we OVERWRITE any
  // caller-supplied appId — otherwise a request to
  // `/_deepspace/subscriptions/plans?appId=other_app` would forward a
  // duplicate-key query string and the platform would pick whichever value
  // its parser sees first.
  const forwardedParams = new URLSearchParams(url.search)
  if (route.injectAppId) {
    forwardedParams.set('appId', c.env.DEEPSPACE_APP_ID)
  }
  const queryString = forwardedParams.toString()
  const apiPath =
    url.pathname.replace('/_deepspace/', '/api/') + (queryString ? `?${queryString}` : '')

  const headers = new Headers(c.req.raw.headers)
  headers.delete('x-user-id')
  headers.set('x-app-identity-token', c.env.APP_IDENTITY_TOKEN)
  headers.set('x-app-id', c.env.DEEPSPACE_APP_ID)
  if (auth?.userId) headers.set('x-user-id', auth.userId)

  return apiWorkerFetch(c.env, apiPath, {
    method,
    headers,
    body: ['GET', 'HEAD'].includes(method) ? undefined : c.req.raw.body,
  })
})

// ---------------------------------------------------------------------------
// Static assets (SPA fallback)
// ---------------------------------------------------------------------------

app.get('*', async (c) => {
  const response = await c.env.ASSETS.fetch(c.req.raw)
  if (response.status === 404) {
    const url = new URL(c.req.url)
    url.pathname = '/index.html'
    return c.env.ASSETS.fetch(new Request(url.toString(), c.req.raw))
  }
  return response
})

// =============================================================================
// Action Tools — route to app's own RecordRoom DO
// =============================================================================

function createActionTools(env: Env, userId: string, callerJwt: string): ActionTools {
  const stub = env.RECORD_ROOMS.get(env.RECORD_ROOMS.idFromName(`app:${env.APP_NAME}`))

  // Internal helper — DO returns `ActionResult<unknown>`. Callers below
  // cast to the precisely-typed result for each operation. The cast is
  // safe because the wire shape is set by the SDK's tools-api handler.
  async function execTool<TData>(
    tool: string,
    params: Record<string, unknown>,
  ): Promise<ActionResult<TData>> {
    const res = await stub.fetch(new Request('https://internal/api/tools/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': userId,
        'X-App-Action': 'true',
      },
      body: JSON.stringify({ tool, params }),
    }))
    return res.json() as Promise<ActionResult<TData>>
  }

  async function callIntegration<T>(
    endpoint: string,
    data?: unknown,
  ): Promise<ActionResult<T>> {
    const integrationName = endpoint.split('/')[0]
    const billingMode = integrations[integrationName]?.billing ?? 'developer'

    // Use the owner JWT for developer-billed calls, the caller's JWT otherwise.
    // The api-worker bills the JWT subject — no client-supplied override.
    const jwt = billingMode === 'developer' ? env.APP_OWNER_JWT : callerJwt

    const res = await apiWorkerFetch(env, `/api/integrations/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify(data ?? {}),
    })
    return res.json() as Promise<ActionResult<T>>
  }

  return {
    create: (collection, data) => execTool('records.create', { collection, data }),
    update: (collection, recordId, data) =>
      execTool('records.update', { collection, recordId, data }),
    remove: (collection, recordId) => execTool('records.delete', { collection, recordId }),
    get: (collection, recordId) => execTool('records.get', { collection, recordId }),
    query: (collection, options) => execTool('records.query', { collection, ...options }),
    integration: callIntegration,
    registerUser: (opts) => execTool('users.register', { ...opts }),
  }
}

export default app
