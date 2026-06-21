/**
 * useConfigHealth: one honest source for the config-health report, shared by
 * the rail dot and the Settings panel so they never disagree. The dot reads
 * `health` (the rolled-up worst-case color); Settings reads the full `data`.
 *
 * Owner-gated on the worker, so we only fetch when signed in as the owner. A
 * fetch failure is itself an honest state (the panel shows it), never a crash.
 *
 * Cost-aware: the integrations check is an owner-billed Exa search. The rail
 * dot is in the shell (every page), so it must not spend a search per
 * navigation. We split the call:
 *   - The rail dot fetches light (no probe) and reads a short-lived module
 *     cache, so navigations reuse one result instead of re-billing.
 *   - Settings (probe: true) runs the live search probe on open, and its
 *     refresh forces a fresh probe past the cache.
 * A recent deep probe's integrations result is carried into the light cache so
 * the dot can show the real color instead of grey when one ran lately.
 */

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from 'deepspace'
import { fetchConfigHealth } from '../../lib/scout-api'
import type { ConfigHealth } from '../../lib/config-health'
import type { Health } from './Status'

interface ConfigHealthState {
  data: ConfigHealth | null
  loading: boolean
  /** A plain message when the report itself could not be loaded. */
  error: string | null
  /** The single dot color: the worst status across all checks. */
  health: Health
  refresh: () => void
}

/** Roll the checks up to one dot color: red if anything is down/missing, amber if
 *  email is in test mode or search is unchecked, green when all clear, grey while
 *  unknown. Model "configured" and scheduler "idle" / storage "local" are healthy
 *  informational states, not failures, so they do not pull the dot off green. */
export function rollUp(data: ConfigHealth | null): Health {
  if (!data) return 'unknown'
  if (
    data.owner.status === 'missing' ||
    data.email.status === 'misconfigured' ||
    data.integrations.status === 'down' ||
    data.model.status === 'missing' ||
    data.scheduler.status === 'down' ||
    data.storage.status === 'down'
  ) {
    return 'down'
  }
  if (data.email.status === 'testmode' || data.integrations.status === 'unknown') return 'warn'
  return 'ok'
}

/** Module cache shared across mounts. Keeps the rail dot from re-billing. */
const CACHE_TTL = 5 * 60_000
let cache: { data: ConfigHealth; fetchedAt: number } | null = null

export function useConfigHealth(options: { probe?: boolean } = {}): ConfigHealthState {
  const probe = options.probe ?? false
  const { isSignedIn } = useAuth()
  const [data, setData] = useState<ConfigHealth | null>(() => cache?.data ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  // refresh always re-runs the live probe and bypasses the cache.
  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    if (!isSignedIn) {
      setData(null)
      setError(null)
      setLoading(false)
      return
    }

    // A fresh cache satisfies the light (rail-dot) path without any fetch. A
    // manual refresh (nonce > 0) and the deep-probe path always go to network.
    const fresh = cache && Date.now() - cache.fetchedAt < CACHE_TTL
    if (!probe && nonce === 0 && fresh) {
      setData(cache!.data)
      return
    }

    let alive = true
    setLoading(true)
    setError(null)
    fetchConfigHealth(probe)
      .then((d) => {
        // Carry a recent deep probe's integrations result forward so the light
        // path shows the real color, not grey, until the probe result ages out.
        const merged =
          !probe && cache && cache.data.integrations.status !== 'unknown'
            ? { ...d, integrations: cache.data.integrations }
            : d
        cache = { data: merged, fetchedAt: Date.now() }
        if (alive) setData(merged)
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : 'Could not load config health.')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [isSignedIn, nonce, probe])

  return { data, loading, error, health: rollUp(data), refresh }
}
