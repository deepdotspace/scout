import { test, expect } from '@playwright/test'
import { captureConsoleErrors } from './helpers/errors'

/**
 * Wait for the React app to mount. Scout is a single-owner gated app: the shell
 * lives behind <AuthGate>, so a signed-out visitor sees only the sign-in overlay.
 * `app-root` is the always-present mount point (it wraps the gate).
 */
async function waitForApp(page: import('@playwright/test').Page) {
  await page.waitForSelector('[data-testid="app-root"]', { timeout: 15000 })
}

test.describe('Smoke tests', () => {
  test('app loads without JS errors', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/')
    await waitForApp(page)
    expect(errors).toEqual([])
  })

  test('app shell mounts', async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await expect(page.getByTestId('app-root')).toBeVisible()
  })

  test('signed-out visitor is gated by the sign-in overlay', async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    // Single-owner app: nothing is reachable until signed in. The SDK overlay
    // exposes an email field on the email sign-in path.
    await expect(page.getByText(/sign in/i).first()).toBeVisible({ timeout: 15000 })
  })
})
