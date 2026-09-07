import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "portable.spec.ts",
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  use: {
    trace: "retain-on-failure",
  },
  projects: [
    { name: "portable-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "portable-webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
