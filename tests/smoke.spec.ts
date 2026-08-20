import { test, expect } from '@playwright/test'
import { captureConsoleErrors } from './helpers/errors'

/**
 * Wait for the React app to mount. `app-root` is the always-present mount point:
 * it wraps BOTH branches of the root split (the public landing and the gated
 * studio), so it is visible whether or not the visitor is signed in.
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

  test('signed-out visitor at the root gets the landing, not the sign-in wall', async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    // `/` is the URL people open first, so a signed-out visitor is redirected to
    // the public landing. Sign-in is what "Open the studio" raises, not the door.
    await expect(page).toHaveURL(/\/welcome\/?$/, { timeout: 15000 })
    await expect(page.getByRole('heading', { name: /send a scout into the noise/i })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByRole('button', { name: /open the studio/i }).first()).toBeVisible()
  })

  test('signed-out visitor deep-linking into the studio is gated by the sign-in overlay', async ({
    page,
  }) => {
    await page.goto('/issues')
    await waitForApp(page)
    // Deep links keep the overlay at their own URL so the destination survives
    // sign-in. Single-owner app: nothing here is reachable until signed in.
    await expect(page.getByText(/sign in/i).first()).toBeVisible({ timeout: 15000 })
    await expect(page).toHaveURL(/\/issues\/?$/)
  })
})
