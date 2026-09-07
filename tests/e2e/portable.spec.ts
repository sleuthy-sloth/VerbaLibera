import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const artifact = join(
  process.cwd(),
  "dist/portable/VerbaLibera-Portable.html",
);

async function openFirstLesson(page: Page) {
  await page.getByRole("button", { name: "Open next lesson" }).click();
  await expect(page.getByLabel("Model audio")).toHaveAttribute(
    "src",
    /^blob:/,
  );
  await page.getByRole("button", { name: "Begin practice" }).click();
  await page.getByRole("radio", { name: "Hello." }).check();
  await page.getByRole("button", { name: "Check answer" }).click();
  await page.getByRole("button", { name: "Save and continue" }).click();
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
  await openFirstLesson(page);
  await expect(page.getByText(/1 practice result on this device/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/1 practice result on this device/)).toBeVisible();
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
  await openFirstLesson(page);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export practice backup" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).not.toBeNull();
  const backup = JSON.parse(await readFile(path!, "utf8"));
  expect(backup.format).toBe(1);
  expect(backup.events).toHaveLength(1);
  expect(backup.events[0].packId).toBe("it-foundations");
});
