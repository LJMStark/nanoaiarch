import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration (Week 3.6).
 *
 * Scope today (smoke tier):
 *   Verify public routes render, 200 OK, no JS console errors. This is the
 *   minimum bar — boots the app, confirms next-intl + middleware + base
 *   layout don't throw.
 *
 * Scope tomorrow (when staging env is ready):
 *   Add user-flow tests: register → free credits → generate → upgrade →
 *   purchase → balance increment. Those require seeded test accounts and
 *   mocked Gemini / zpay endpoints, which are out of scope for Week 3.6.
 *
 * Browser dev: tests boot a real production-mode `pnpm start` server so we
 * exercise the same code path that ships, not the dev-mode HMR overlay.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html'], ['list']] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    // Default screenshot on failure; videos kept off for smoke speed.
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Use the production build to match what users actually hit. Set
    // PLAYWRIGHT_USE_DEV=1 locally for faster iteration with `next dev`.
    command: process.env.PLAYWRIGHT_USE_DEV
      ? 'pnpm dev'
      : 'pnpm build && pnpm start',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      // Stub env so production build can complete without secrets. Paths
      // that genuinely require these (auth callbacks, payment) are not
      // exercised by smoke tests.
      DATABASE_URL: 'postgresql://stub:stub@localhost:5432/stub',
      BETTER_AUTH_SECRET: 'e2e-stub-secret',
      NEXT_PUBLIC_BASE_URL: 'http://127.0.0.1:3000',
      ALLOW_LOCAL_BASE_URL_IN_PRODUCTION: 'true',
      CRON_SECRET: 'e2e-cron-secret',
    },
  },
});
