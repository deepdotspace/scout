/**
 * Multi-context auth spec — verifies two distinct test accounts each sign in
 * via the email path (POST /api/auth/sign-in/email, never the Continue-with-
 * GitHub button) into separate browser contexts, and each independently
 * reaches Scout's signed-in shell.
 *
 * Scout is a single-owner app: the shell (`app-shell`) lives behind <AuthGate>,
 * so it only renders for a signed-in session. Two contexts each reaching it
 * proves the email login flow works and the sessions are isolated.
 *
 * The v2 redesign removed the user's name from the chrome (the sidebar foot is
 * now Day/Night + Settings, not a profile row), so this spec asserts on the
 * gated shell mounting per context rather than on a rendered display name.
 *
 * Accounts (already provisioned, looked up by `name` in
 * ~/.deepspace/test-accounts.json): rt-collab-a, rt-collab-b. The `users`
 * fixture handles sign-in caching (per-account storageState), context creation,
 * and cleanup.
 */
import { test, expect } from 'deepspace/testing'

test('two accounts sign in via the email path and each reaches the shell', async ({ users }) => {
  const [a, b] = await users(['rt-collab-a', 'rt-collab-b'])

  await Promise.all([a.page.goto('/'), b.page.goto('/')])

  // The shell is gated behind <AuthGate>; a signed-in session sees it.
  await expect(a.page.getByTestId('app-shell')).toBeVisible({ timeout: 15_000 })
  await expect(b.page.getByTestId('app-shell')).toBeVisible({ timeout: 15_000 })

  // The two contexts are distinct signed-in sessions (different accounts).
  expect(a.email).not.toBe(b.email)
})
