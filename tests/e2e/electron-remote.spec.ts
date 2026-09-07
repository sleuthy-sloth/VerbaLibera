import { test, expect, _electron as electron } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// B1 remote-authentication integration (R1).
//
// Proves the child server in remote mode verifies passkeys against the fixed
// loopback origin: after remote setup, /api/desktop/health echoes the
// WEBAUTHN_RP_ID / WEBAUTHN_ORIGIN the server process started with.
//
// Requires VL_E2E_REMOTE_DB: a connection string to a disposable PostgreSQL
// database (empty, dedicated, TLS-required for release acceptance). Skipped
// otherwise so ordinary CI stays green.
//
// Limits (tracked for Milestone C): this launches `electron .`, not the
// DMG-installed .app, and it asserts the server-side configuration rather
// than a full virtual-authenticator registration + sign-in ceremony.

const REPO = process.cwd();
const ELECTRON_BIN = path.join(
  REPO,
  "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron",
);
const APP_ORIGIN = "http://127.0.0.1:43127";

const REMOTE_DB = process.env.VL_E2E_REMOTE_DB ?? "";

test.skip(
  REMOTE_DB === "",
  "Needs VL_E2E_REMOTE_DB pointing at a disposable PostgreSQL database.",
);

test("remote setup boots the server with fixed-origin WebAuthn config", async () => {
  test.setTimeout(240_000);
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "vl-e2e-remote-"));
  const app = await electron.launch({
    executablePath: ELECTRON_BIN,
    args: [".", `--user-data-dir=${userDataDir}`],
    cwd: REPO,
    timeout: 120_000,
  });
  try {
    const setup = await app.firstWindow();
    await setup.waitForSelector("#remote-url", { timeout: 60_000 });
    await setup.fill("#remote-url", REMOTE_DB);
    await setup.click("#inspect-remote");
    await setup.waitForSelector("#approve-remote:not([hidden])", {
      timeout: 120_000,
    });
    await setup.click("#approve-remote");

    let main = app
      .windows()
      .find((w) => w.url().startsWith(APP_ORIGIN));
    if (!main) {
      main = await app.waitForEvent("window", { timeout: 120_000 });
    }
    await main.waitForURL("**/desktop/profiles", { timeout: 120_000 });

    const health = await main.evaluate(async (origin) => {
      const response = await fetch(`${origin}/api/desktop/health`, {
        headers: { origin },
      });
      return { status: response.status, body: await response.json() };
    }, APP_ORIGIN);
    expect(health.status).toBe(200);
    expect(health.body.webauthn).toEqual({
      rpID: "127.0.0.1",
      origin: APP_ORIGIN,
    });

    const settings = JSON.parse(
      fs.readFileSync(path.join(userDataDir, "settings.json"), "utf8"),
    ) as { active: { mode: string } };
    expect(settings.active.mode).toBe("remote");
  } finally {
    await app.close();
  }
});
