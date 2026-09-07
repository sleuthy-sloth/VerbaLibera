import { test, expect, _electron as electron } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REPO = process.cwd();
const ELECTRON_BIN = path.join(
  REPO,
  "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron",
);

async function launchApp(userDataDir: string) {
  return electron.launch({
    executablePath: ELECTRON_BIN,
    args: [".", `--user-data-dir=${userDataDir}`],
    cwd: REPO,
    timeout: 120_000,
  });
}

test("local first run creates a profile and survives relaunch", async () => {
  test.setTimeout(240_000);
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "vl-e2e-"));
  const app = await launchApp(userDataDir);
  try {
    // Setup window (packaged file:// document) offers local storage.
    const setup = await app.firstWindow();
    await setup.waitForSelector("#choose-local", { timeout: 60_000 });
    await setup.click("#choose-local");
    // Setup closes its window once local storage is ready; the main
    // window opens at the profile picker.
    await Promise.race([
      setup
        .waitForFunction(
          () =>
            document
              .getElementById("status")
              ?.textContent?.includes("Starting"),
          null,
          { timeout: 180_000 },
        )
        .catch(() => null),
      setup.waitForEvent("close", { timeout: 180_000 }).catch(() => null),
    ]);

    let profiles = app
      .windows()
      .find((w) => w.url().startsWith("http://127.0.0.1:43127"));
    if (!profiles) {
      profiles = await app.waitForEvent("window", { timeout: 120_000 });
    }
    await profiles.waitForURL("**/desktop/profiles", { timeout: 120_000 });
    await profiles.fill("#desktop-profile-name", "E2E Learner");
    await profiles.click('button[type="submit"]');
    await profiles.waitForSelector("text=Continue as E2E Learner", {
      timeout: 60_000,
    });
    await profiles.click("text=Continue as E2E Learner");
    await profiles.waitForURL("**/dashboard", { timeout: 60_000 });

    // Sandboxed renderer policy holds in the real window.
    const prefs = await app.evaluate(({ BrowserWindow }) => {
      const windows = BrowserWindow.getAllWindows();
      return windows.map((w) =>
        (
          w.webContents as unknown as {
            getLastWebPreferences: () => Record<string, unknown>;
          }
        ).getLastWebPreferences(),
      );
    });
    expect(prefs.length).toBeGreaterThan(0);
    for (const p of prefs as Array<Record<string, unknown>>) {
      expect(p).toMatchObject({
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
      });
    }

    // Settings file records a local installation.
    const settings = JSON.parse(
      fs.readFileSync(path.join(userDataDir, "settings.json"), "utf8"),
    ) as { active: { mode: string } };
    expect(settings.active.mode).toBe("local");
  } finally {
    await app.close();
  }

  // Relaunch with the same user data: the profile persists.
  const relaunch = await launchApp(userDataDir);
  try {
    const profiles = await relaunch.firstWindow();
    await profiles.waitForURL("**/desktop/profiles", { timeout: 120_000 });
    await profiles.waitForSelector("text=Continue as E2E Learner", {
      timeout: 60_000,
    });
  } finally {
    await relaunch.close();
  }
});
