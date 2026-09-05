import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3100',
    trace: 'on-first-retry',
  },
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'npm run dev -- --port 3100',
    env: { WEBAUTHN_RP_ID: 'localhost', WEBAUTHN_ORIGIN: 'http://localhost:3100' },
    url: 'http://localhost:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
