import { test, expect, _electron as electron } from "@playwright/test";
import type { ElectronApplication, Page } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// B3 storage transitions (R3).
//
// Pins: remote-first installs initialize local storage on switch; pending
// modes activate only after the new mode boots; a failed activation keeps
// the previous working configuration (no recovery trap, no merged stores);
// local → remote → local preserves local progress.
//
// Requires VL_E2E_REMOTE_DB: a connection string to a disposable PostgreSQL
// database (empty, dedicated). Skipped otherwise so ordinary CI stays green.

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

async function launchApp(userDataDir: string) {
  return electron.launch({
    executablePath: ELECTRON_BIN,
    args: [".", `--user-data-dir=${userDataDir}`],
    cwd: REPO,
    timeout: 120_000,
  });
}

async function setupLocal(app: ElectronApplication): Promise<Page> {
  const setup = await app.firstWindow();
  await setup.waitForSelector("#choose-local", { timeout: 60_000 });
  await setup.click("#choose-local");
  return waitForProfiles(app);
}

async function setupRemote(app: ElectronApplication, url: string): Promise<Page> {
  const setup = await app.firstWindow();
  await setup.waitForSelector("#remote-url", { timeout: 60_000 });
  await setup.fill("#remote-url", url);
  await setup.click("#inspect-remote");
  await setup.waitForSelector("#approve-remote:not([hidden])", {
    timeout: 120_000,
  });
  await setup.click("#approve-remote");
  return waitForRemoteApp(app);
}

async function waitForProfiles(app: ElectronApplication): Promise<Page> {
  let main = app.windows().find((w) => w.url().startsWith(APP_ORIGIN));
  if (!main) {
    main = await app.waitForEvent("window", { timeout: 120_000 });
  }
  await main.waitForURL("**/desktop/profiles", { timeout: 120_000 });
  return main;
}

/** Remote boots have no local profile picker: the window opens at /dashboard. */
async function waitForRemoteApp(app: ElectronApplication): Promise<Page> {
  let main = app.windows().find((w) => w.url().startsWith(APP_ORIGIN));
  if (!main) {
    main = await app.waitForEvent("window", { timeout: 120_000 });
  }
  await main.waitForURL("**/dashboard", { timeout: 120_000 });
  return main;
}

function readSettings(userDataDir: string) {
  return JSON.parse(
    fs.readFileSync(path.join(userDataDir, "settings.json"), "utf8"),
  ) as {
    active: { mode: string };
    pending?: { mode: string };
  };
}

async function scheduleStorageChange(
  main: Page,
  request: { mode: "local" } | { mode: "remote"; databaseUrl: string },
): Promise<void> {
  await main.evaluate(async (req) => {
    const api = (window as unknown as { verbalibera: unknown }).verbalibera as {
      scheduleStorageChange: (r: unknown) => Promise<unknown>;
    };
    await api.scheduleStorageChange(req);
  }, request);
}

test("remote-first install initializes local storage on switch", async () => {
  test.setTimeout(300_000);
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "vl-e2e-storage-"));
  const app = await launchApp(userDataDir);
  try {
    const main = await setupRemote(app, REMOTE_DB);
    expect(readSettings(userDataDir).active.mode).toBe("remote");

    await scheduleStorageChange(main, { mode: "local" });
    expect(readSettings(userDataDir).pending?.mode).toBe("local");
  } finally {
    await app.close();
  }

  const app2 = await launchApp(userDataDir);
  try {
    await waitForProfiles(app2);
    // The pending local mode booted (not recovery) and activated.
    const settings = readSettings(userDataDir);
    expect(settings.active.mode).toBe("local");
    expect(settings.pending).toBeUndefined();
    expect(fs.existsSync(path.join(userDataDir, "local-db.json"))).toBe(true);
    expect(fs.existsSync(path.join(userDataDir, "db", "pgdata"))).toBe(true);
  } finally {
    await app2.close();
  }
});

test("local to remote and back preserves local progress", async () => {
  test.setTimeout(420_000);
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "vl-e2e-storage-"));
  let app = await launchApp(userDataDir);
  try {
    const main = await setupLocal(app);
    await main.fill("#desktop-profile-name", "Storage Learner");
    await main.click('button[type="submit"]');
    await main.waitForSelector("text=Continue as Storage Learner", {
      timeout: 60_000,
    });
  } finally {
    await app.close();
  }

  app = await launchApp(userDataDir);
  try {
    const main = await waitForProfiles(app);
    await scheduleStorageChange(main, { mode: "remote", databaseUrl: REMOTE_DB });
    expect(readSettings(userDataDir).pending?.mode).toBe("remote");
  } finally {
    await app.close();
  }

  app = await launchApp(userDataDir);
  try {
    await waitForProfiles(app);
    expect(readSettings(userDataDir).active.mode).toBe("remote");
    const main = app.windows().find((w) => w.url().startsWith(APP_ORIGIN));
    if (!main) throw new Error("expected the application window");
    await scheduleStorageChange(main, { mode: "local" });
  } finally {
    await app.close();
  }

  app = await launchApp(userDataDir);
  try {
    const main = await waitForProfiles(app);
    expect(readSettings(userDataDir).active.mode).toBe("local");
    // The local profile from before the round trip survived.
    await main.waitForSelector("text=Continue as Storage Learner", {
      timeout: 60_000,
    });
  } finally {
    await app.close();
  }
});

test("failed activation keeps the previous working configuration", async () => {
  test.setTimeout(300_000);
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "vl-e2e-storage-"));
  let app = await launchApp(userDataDir);
  try {
    await setupLocal(app);
  } finally {
    await app.close();
  }

  // Plant an unsatisfiable pending switch: undecryptable URL material.
  const settingsPath = path.join(userDataDir, "settings.json");
  const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8")) as {
    version: number;
    active: { mode: string; schemaVersion: string };
  };
  fs.writeFileSync(
    settingsPath,
    JSON.stringify({
      version: 1,
      active: settings.active,
      pending: {
        mode: "remote",
        encryptedDatabaseUrl: "definitely-not-a-keychain-envelope",
        schemaVersion: settings.active.schemaVersion,
      },
    }),
  );

  app = await launchApp(userDataDir);
  try {
    // Old local mode boots (not recovery) with the pending request retained.
    await waitForProfiles(app);
    const after = readSettings(userDataDir);
    expect(after.active.mode).toBe("local");
    expect(after.pending?.mode).toBe("remote");
  } finally {
    await app.close();
  }
});
