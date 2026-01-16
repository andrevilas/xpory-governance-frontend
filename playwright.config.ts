import { defineConfig } from '@playwright/test';

const playwrightPort = process.env.PLAYWRIGHT_PORT ?? '8081';
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${playwrightPort}`;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  webServer: {
    command: `npm run dev -- --host 0.0.0.0 --port ${playwrightPort} --strictPort`,
    url: baseUrl,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  use: {
    baseURL: baseUrl,
    headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
