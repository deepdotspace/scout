/**
 * Cron arming — the one thing that makes scheduled generation actually run.
 *
 * The SDK's CronRoom does NOT arm its alarm in the constructor. Arming happens
 * inside its private ensureInitialized(), which runs only when the DO is
 * touched: fetch(), a WebSocket connect, or an alarm. Registering tasks in
 * src/cron.ts is therefore not enough — until something addresses the DO, no
 * alarm is ever scheduled and no task ever fires.
 *
 * Scout has no client that opens the cron monitor (the owner-gated
 * /ws/cron/:roomId socket is the only route to the room and nothing opens it),
 * so the worker has to poke the room itself. Once poked the room self-sustains:
 * onAlarm() re-arms at the end of every tick, and the alarm survives redeploys.
 * That makes arming a one-shot-per-isolate job, not a per-request one.
 */

/**
 * The name the CronRoom DO is addressed by.
 *
 * Deliberately `app:<APP_NAME>` — the key every other server-side room in this
 * app uses (RecordRoom and JobRoom in worker.ts, SCOPE_ID in constants.ts) and
 * the id the /ws/cron/:roomId monitor is opened with.
 *
 * It is NOT `app:<DEEPSPACE_APP_ID>`. In this app those are two different
 * strings (`scout` vs `app_01KZ...`), so addressing the wrong one would arm a
 * second, empty CronRoom whose task table nothing ever reads — an arming call
 * that returns 200 and still leaves the real scanner dead.
 */
export function cronRoomName(appName: string): string {
  return `app:${appName}`
}

/**
 * A once-per-isolate arming latch.
 *
 * Returns a function that runs `ping` the first time it is called and returns
 * the in-flight promise; every later call returns null (nothing to wait on).
 * If the ping rejects, the latch is released so a later request in the same
 * isolate retries — a long-lived isolate must never be the reason the alarm
 * stays unarmed.
 *
 * A rejected ping means the DO was unreachable. A *404 response* is not a
 * failure: CronRoom.fetch() arms the room and then falls through to BaseRoom,
 * which has no HTTP route for a bare path and answers 404. The arming already
 * happened by then, so a resolved 404 correctly keeps the latch closed.
 */
export function createCronArmer(): (ping: () => Promise<unknown>) => Promise<void> | null {
  let armed = false
  return (ping) => {
    if (armed) return null
    armed = true
    return ping().then(
      () => undefined,
      (err) => {
        armed = false
        console.error('[cron-arm] could not arm the cron room; will retry:', err)
      },
    )
  }
}
