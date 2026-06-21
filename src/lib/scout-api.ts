/**
 * Thin client for Scout's owner-gated worker endpoints. These routes live on the
 * app's own worker (same origin as the page), so the path is relative. Both need
 * the signed user JWT (the worker checks the subject is the owner), so we attach
 * it here. Errors surface the worker's real `error` message, never a blank.
 */

import { getAuthToken } from 'deepspace'
import type { ScoutsRead } from './ai'
import type { ConfigHealth } from './config-health'

async function post<T>(path: string, body: unknown): Promise<T> {
  const token = await getAuthToken()
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as Partial<T> & { error?: string }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data as T
}

async function get<T>(path: string): Promise<T> {
  const token = await getAuthToken()
  const res = await fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  const data = (await res.json().catch(() => ({}))) as Partial<T> & { error?: string }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data as T
}

/**
 * The single honest config-health report (owner email, email deliverable,
 * integrations reachable). The integrations check is an owner-billed Exa
 * search, so it runs only with `probe` set (an explicit Settings open or
 * refresh); the light call the rail dot makes leaves integrations 'unknown'.
 */
export function fetchConfigHealth(probe = false): Promise<ConfigHealth> {
  return get<ConfigHealth>(`/api/config-health${probe ? '?probe=1' : ''}`)
}

/** Turn a rough topic into a sharpened scope (Haiku). */
export function scoutsRead(topic: string): Promise<ScoutsRead> {
  return post<ScoutsRead>('/api/scouts-read', { topic })
}

/** Kick off a send-now generation for a newsletter. Returns the draft issue id. */
export function generateIssue(newsletterId: string): Promise<{ issueId: string; jobId: string }> {
  return post<{ issueId: string; jobId: string }>('/api/generate', { newsletterId })
}
