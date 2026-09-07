import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /electron-.*\.spec\.ts/,
  timeout: 240_000,
  workers: 1,
  reporter: "list",
  use: {
    trace: "retain-on-failure",
  },
});
