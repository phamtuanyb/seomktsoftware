import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.WEB_PORT ?? 3006);
const baseURL = process.env.WEB_BASE_URL ?? `http://127.0.0.1:${port}`;

/**
 * Sprint 14.2 — browser e2e smoke. Boots the Next dev server (assumes the
 * NestJS API is reachable on the URL configured by NEXT_PUBLIC_API_URL).
 *
 * CI runs against the production build (`next start`) to catch issues that
 * only show up after compilation; locally `pnpm test:e2e` uses dev server.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.PLAYWRIGHT_SKIP_WEB_SERVER
    ? undefined
    : {
        command: process.env.CI
          ? `pnpm --filter @mkt-seo/web start`
          : `pnpm --filter @mkt-seo/web dev`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
