import { defineConfig, devices } from "@playwright/test";

/**
 * The offline matrix on two engines.
 *
 * The main config runs Chromium, which is what the suite needs 95% of the time.
 * Service workers are not 95% of the time: the offline/installed path is the one
 * place where engine differences actually bite (registration, cache storage,
 * `Cache.put` of a range response, media playback out of a cache), and iOS is
 * WebKit. So the offline specs run on Chromium and WebKit, on their own port so
 * this config never reuses a dev server the main suite started — the trap that
 * made an earlier run test another tree's code.
 *
 *   npm run test:e2e:offline
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["offline.spec.ts", "offline-matrix.spec.ts"],
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3200",
    trace: "retain-on-failure",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev -- --port 3200",
        env: { WEBAUTHN_RP_ID: "localhost", WEBAUTHN_ORIGIN: "http://localhost:3200" },
        url: "http://localhost:3200",
        reuseExistingServer: false,
        timeout: 120_000,
      },
  projects: [
    {
      name: "offline-chromium",
      use: { ...devices["Desktop Chrome"] },
      testMatch: ["offline.spec.ts", "offline-matrix.spec.ts"],
    },
    {
      // `offline-matrix.spec.ts` only: it is written to run on both engines,
      // skipping (with the reason in the test) the cases Playwright's WebKit
      // cannot express. `offline.spec.ts` is built around navigating while the
      // network is emulated off, which Playwright WebKit fails on with an
      // internal error — so it stays a Chromium file rather than a file full of
      // skips.
      name: "offline-webkit",
      use: { ...devices["Desktop Safari"] },
      testMatch: ["offline-matrix.spec.ts"],
    },
  ],
});
