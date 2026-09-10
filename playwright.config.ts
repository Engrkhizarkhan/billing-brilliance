import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // These end-to-end scenarios intentionally mutate a shared disposable
  // database and exercise authentication throttling. Keep them serial so one
  // browser cannot invalidate or rate-limit another scenario's control flow.
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:8080',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  outputDir: 'test-results',
});
