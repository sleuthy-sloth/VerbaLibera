import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const artifact = join(
  process.cwd(),
  "dist/portable/VerbaLibera-Portable.html",
);

async function openFirstLesson(page: Page, runtime: boolean) {
  const first = page.getByRole("button", { name: "First words", exact: true });
  await expect(first).toBeEnabled();
  await first.click();
  if (runtime) {
    await page.getByRole("button", { name: "Begin practice", exact: true }).click();
    // Information step saves before the first practice activity: assert the
    // activity is reachable rather than a legacy Model audio element.
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByRole("radio", { name: "Hello.", exact: true })).toBeVisible();
    await page.getByRole("radio", { name: "Hello.", exact: true }).check();
    await page.getByRole("button", { name: "Check", exact: true }).click();
    await expect(
      page.locator('[role="status"][data-outcome]').first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Next step", exact: true }).click();
  } else {
    await page.getByRole("button", { name: "Open next lesson" }).click();
    await expect(page.getByLabel("Model audio")).toHaveAttribute("src", /^blob:/);
    await page.getByRole("button", { name: "Begin practice" }).click();
    await page.getByRole("radio", { name: "Hello." }).check();
    await page.getByRole("button", { name: "Check answer" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
  }
}

test("opens from one file, stays offline, and reloads durable progress", async ({
  context,
  page,
}) => {
  const networkRequests: string[] = [];
  await context.route(/^https?:/, async (route) => {
    networkRequests.push(route.request().url());
    await route.abort();
  });

  await page.goto(pathToFileURL(artifact).href);
  await expect(
    page.getByRole("heading", { name: "Italian foundations", exact: true }),
  ).toBeVisible();
  // The course artwork travels in the single file too: the banner is embedded as
  // a data URL and handed to the shell as a blob, so it renders with every http
  // request aborted above.
  const banner = page.locator("img.course-banner");
  await expect(banner).toHaveAttribute("src", /^blob:/);
  await expect
    .poll(() => banner.evaluate((img: HTMLImageElement) => img.naturalWidth), { timeout: 15000 })
    .toBeGreaterThan(0);
  await openFirstLesson(page, true);

  // The v2 runtime player shows completed steps on its own progress bar
  // ("2 of 8 steps completed"). Reload and reopen the same lesson to prove
  // the portable build persisted the progress across a fresh page load.
  await expect(page.getByText(/of 8 steps completed/)).toContainText("2 of 8");
  await page.reload();
  await page.getByRole("button", { name: "First words", exact: true }).click();
  await page.getByRole("button", { name: "Begin practice", exact: true }).click();
  await expect(page.getByText(/of 8 steps completed/)).toContainText("2 of 8");
  await page.getByRole("button", { name: "All lessons" }).click();
  expect(networkRequests).toEqual([]);
});

test("warns and exports valid progress when IndexedDB is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      value: undefined,
    });
  });
  await page.goto(pathToFileURL(artifact).href);
  await expect(page.getByRole("alert")).toContainText(
    "Progress is temporary in this browser",
  );
  await openFirstLesson(page, true);

  // The export control lives on the course-path view (RuntimeCourseWorkspace),
  // so step back out of the lesson to reach it.
  await page.getByRole("button", { name: "All lessons" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export practice backup" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).not.toBeNull();
  const backup = JSON.parse(await readFile(path!, "utf8"));
  // The v2 runtime records a step-completed event per step plus a practice
  // attempt per graded activity, so a two-step lesson exports more than one
  // event. Assert the envelope is valid and carries the right pack instead of
  // pinning the old v1 single-save shape.
  const saved = [
    ...(backup.events ?? []),
    ...(backup.lessonEvents ?? []),
  ];
  expect(saved.length).toBeGreaterThan(0);
  expect(saved.every((e) => e.packId === "it-foundations")).toBe(true);
});

test('the approved lesson scenes are embedded in the single file', async () => {
  // The portable shell resolves media through `environment.resolveMedia`, which
  // throws on an asset the file does not carry — so a scene the app can render has
  // to be inside it. Read from the built artifact rather than re-derived from the
  // source, which is the same rule the banner check follows.
  const html = await readFile(artifact, "utf8");
  for (const name of [
    "ordering-coffee",
    "asking-for-the-bill",
    "hotel-checkin",
    "directions",
    "station-counter",
  ]) {
    expect(html, `/images/scenes/${name}.jpg is not embedded in the portable file`).toContain(
      `/images/scenes/${name}.jpg`,
    );
  }
  // Embedded, not linked: the audit already refuses an external media reference,
  // and this names the folder so a future scene cannot be added as a path.
  expect(html).not.toMatch(/<img[^>]*src="\/images\/scenes\//);
});
