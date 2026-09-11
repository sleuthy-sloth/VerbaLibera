import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { buildPortableHtml } from "../../scripts/portable/build";
import { auditPortableHtml } from "../../scripts/portable/verify";

/**
 * Listen in the portable single file (roadmap 3A).
 *
 * The file has no network by construction (`connect-src 'none'`), so the audio
 * has to be inside it. Embedding is a build-time choice — all five tracks would
 * add ~37 MB of base64 to a file that is already 17 MB — so these two cases
 * cover both sides of it: a build asked for the French audio plays it, and the
 * default build says plainly which tracks it cannot play instead of rendering a
 * player that fails.
 *
 * Building here rather than relying on a prebuilt artifact keeps the claim
 * honest: what is tested is the builder in this working tree.
 */

const root = process.cwd();
const artifacts: Record<"silent" | "audio", string> = {
  silent: join(root, "dist/portable-e2e/VerbaLibera-Portable.html"),
  audio: join(root, "dist/portable-e2e/VerbaLibera-Portable-audio.html"),
};

let built = false;

test.beforeAll(async () => {
  test.setTimeout(180_000);
  if (built) return;
  mkdirSync(join(root, "dist/portable-e2e"), { recursive: true });
  const silent = await buildPortableHtml(root);
  const audio = await buildPortableHtml(root, { withListen: ["french"] });
  auditPortableHtml(silent);
  auditPortableHtml(audio);
  // The choice is visible in the artifact: the audio build is a third bigger.
  expect(audio.length).toBeGreaterThan(silent.length * 1.2);
  writeFileSync(artifacts.silent, silent);
  writeFileSync(artifacts.audio, audio);
  built = true;
});

async function openListen(page: Page, artifact: string) {
  // No network is routed away on purpose: the file's own CSP forbids it, and a
  // bundle that quietly reached for a URL would fail right here.
  await page.goto(`${pathToFileURL(artifact).href}?language=french&view=listen`);
  await expect(page.getByRole("heading", { name: "Listen", exact: true })).toBeVisible();
  return page.getByRole("button", { name: "Names and introductions", exact: true });
}

test("a portable file built with the audio plays its Listen track offline", async ({ page }) => {
  const track = await openListen(page, artifacts.audio);
  await expect(page.getByText(/This file carries 4\.9 MB of audio lessons/)).toBeVisible();
  await track.click();
  const player = page.getByLabel("Play the audio lesson: Names and introductions");
  await expect(player).toHaveAttribute("src", /^blob:/);
  await player.evaluate(async (audio: HTMLAudioElement) => {
    audio.load();
    await new Promise<void>((resolve, reject) => {
      audio.addEventListener("loadedmetadata", () => resolve(), { once: true });
      audio.addEventListener("error", () => reject(new Error("Embedded audio failed to decode")), { once: true });
    });
    await audio.play();
  });
  expect(await player.evaluate((audio: HTMLAudioElement) => audio.duration)).toBeGreaterThan(480);

  // Seek, then reopen the file: the position was kept in the file's own storage.
  await player.evaluate((audio: HTMLAudioElement) => {
    audio.currentTime = 180;
  });
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("verbalibera_listen_position:fr-identity-foundation")),
    )
    .toBe("180");
  await player.evaluate((audio: HTMLAudioElement) => audio.pause());
  await page.reload();
  await page.getByRole("button", { name: "Names and introductions", exact: true }).click();
  await expect(page.getByText(/(stopped at|resumed at) 3:00/i)).toBeVisible();
});

test("the default portable file says which tracks it cannot play", async ({ page }) => {
  const track = await openListen(page, artifacts.silent);
  await expect(
    page.getByText(/built without the audio lessons, so Listen shows what exists/),
  ).toBeVisible();
  await expect(page.getByText("Not in this file").first()).toBeVisible();
  await track.click();
  // No dead player: the row explains itself, and there is nothing to play.
  await expect(page.getByText(/Not in this file — it was built without the audio/)).toBeVisible();
  await expect(page.locator("audio")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /All audio lessons/ })).toBeVisible();
});
