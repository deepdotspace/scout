import { defineConfig } from '@playwright/test'

/**
 * Port comes from $DEEPSPACE_PORT (set by `deepspace test [--port N]`),
 * defaulting to 5173. The same port is passed to vite via --strictPort so
 * a busy address fails fast rather than silently rebinding to 5174.
 *
 * To run multiple apps in parallel, give each one a different port:
 *   DEEPSPACE_PORT=5180 npx deepspace dev   (terminal 1, app A)
 *   DEEPSPACE_PORT=5181 npx deepspace dev   (terminal 2, app B)
 *   DEEPSPACE_PORT=5180 npx deepspace test  (terminal 3, against A)
 */
const PORT = Number(process.env.DEEPSPACE_PORT ?? 5173)
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  globalSetup: './helpers/global-setup.ts',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: BASE_URL,
    headless: true,
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort --host`,
    cwd: '..',
    url: BASE_URL,
    // Always start THIS app's own server. Never reuse whatever happens to be on
    // the port: in a multi-repo workspace a sibling app's dev server (e.g. on the
    // shared vite default 5173) would otherwise be silently tested instead of
    // ours, passing the generic smoke checks and failing only the app-specific
    // ones. With --strictPort a busy port now fails loudly; pass --port to pick a
    // free one (see the header note).
    reuseExistingServer: false,
    timeout: 30_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
