import { test, expect, _electron as electron } from "@playwright/test";
import type { ElectronApplication, Page } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// C1 installed-artifact acceptance (Milestone C).
//
// Runs the PACKAGED .app (copied from the built DMG, not `electron .`)
// from an unrelated working directory with isolated user-data dirs:
// local first run, two-profile isolation across data dirs, a Lesson 0
// render with servable model audio, and quit/relaunch state recovery.
//
// Requires VL_E2E_INSTALLED_APP: path to the packaged .app bundle.
// Skipped otherwise (CI mac runners would need `electron:make` first).

const APP_BUNDLE = process.env.VL_E2E_INSTALLED_APP ?? "";
const APP_BIN = path.join(APP_BUNDLE, "Contents/MacOS/VerbaLibera");
const APP_ORIGIN = "http://127.0.0.1:43127";

test.skip(
  APP_BUNDLE === "",
  "Needs VL_E2E_INSTALLED_APP pointing at the packaged .app.",
);

async function launchInstalled(userDataDir: string) {
  return electron.launch({
    executablePath: APP_BIN,
    args: [`--user-data-dir=${userDataDir}`],
    // Unrelated working directory: the app must not depend on the repo.
    cwd: os.tmpdir(),
    timeout: 120_000,
  });
}

async function waitForProfiles(app: ElectronApplication): Promise<Page> {
  let main = app.windows().find((w) => w.url().startsWith(APP_ORIGIN));
  if (!main) {
    main = await app.waitForEvent("window", { timeout: 120_000 });
  }
  await main.waitForURL("**/desktop/profiles", { timeout: 120_000 });
  return main;
}

async function createProfile(main: Page, name: string): Promise<void> {
  await main.fill("#desktop-profile-name", name);
  await main.click('button[type="submit"]');
  await main.waitForSelector(`text=Continue as ${name}`, { timeout: 60_000 });
}

test("installed app: first run, isolation, lesson, and recovery", async () => {
  test.setTimeout(420_000);
  const dirA = fs.mkdtempSync(path.join(os.tmpdir(), "vl-e2e-installed-a-"));
  const dirB = fs.mkdtempSync(path.join(os.tmpdir(), "vl-e2e-installed-b-"));

  // Profile A in an isolated data dir.
  let app = await launchInstalled(dirA);
  try {
    const setup = await app.firstWindow();
    await setup.waitForSelector("#choose-local", { timeout: 120_000 });
    await setup.click("#choose-local");
    const main = await waitForProfiles(app);
    await createProfile(main, "Installed Ada");
    await main.click("text=Continue as Installed Ada");
    await main.waitForURL("**/dashboard", { timeout: 60_000 });

    // Lesson 0 renders with a servable model audio file.
    await main.goto(`${APP_ORIGIN}/courses/italian?start=1`);
    await expect(
      main.getByRole("heading", { name: "First words" }),
    ).toBeVisible({ timeout: 60_000 });
    const audioSrc = await main.evaluate(async () => {
      const el = document.querySelector("audio[data-model]");
      const src =
        el?.getAttribute("src") ??
        document.querySelector("audio")?.getAttribute("src") ??
        null;
      if (!src) return null;
      const response = await fetch(src);
      return { src, status: response.status };
    });
    expect(audioSrc).not.toBeNull();
    expect(audioSrc?.status).toBe(200);
  } finally {
    await app.close();
  }

  // Profile B in a second data dir proves isolation: no trace of Ada.
  app = await launchInstalled(dirB);
  try {
    const setup = await app.firstWindow();
    await setup.waitForSelector("#choose-local", { timeout: 120_000 });
    await setup.click("#choose-local");
    const main = await waitForProfiles(app);
    await expect(main.getByText("Installed Ada")).toHaveCount(0);
    await createProfile(main, "Installed Bo");
  } finally {
    await app.close();
  }

  // Relaunch A: Ada's progress recovered, Bo's store untouched.
  app = await launchInstalled(dirA);
  try {
    const main = await waitForProfiles(app);
    await main.waitForSelector("text=Continue as Installed Ada", {
      timeout: 60_000,
    });
    await expect(main.getByText("Installed Bo")).toHaveCount(0);
    const settings = JSON.parse(
      fs.readFileSync(path.join(dirA, "settings.json"), "utf8"),
    ) as { active: { mode: string } };
    expect(settings.active.mode).toBe("local");
  } finally {
    await app.close();
  }
});
