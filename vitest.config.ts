import { defineConfig } from 'vitest/config'

/*
 * Unit-test config, deliberately separate from vite.config.ts. The app's vite
 * config loads the Cloudflare Workers + generouted plugins, which are for
 * building/serving the app and break vitest's dep pre-bundling. The unit specs
 * cover pure pipeline modules (parsing, sift, persona resolution) in a plain
 * node environment. Playwright smoke/api/e2e specs run via `deepspace test`,
 * not vitest, so they are excluded here.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
})
