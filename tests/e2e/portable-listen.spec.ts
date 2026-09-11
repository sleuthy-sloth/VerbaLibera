import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Listen in the portable single file (roadmap 3A).
 *
 * The file has no network by construction (`connect-src 'none'`), so the audio
 * has to be inside it. Embedding is a build-time choice — all five tracks would
 * add ~37 MB of base64 to a file that is already 17 MB — so these two cases
 * cover both sides of it: a file built for the French audio plays it, and the
 * default file says plainly which tracks it cannot play instead of rendering a
 * player that fails.
 *
 * The audio file is built here by the real CLI (`--with-listen=french`) and
 * audited with the release checker, so what is tested is the flag as shipped,
 * not a hand-assembled bundle.
 */

const root = process.cwd();
const silent = join(root, "dist/portable/VerbaLibera-Portable.html");
const audio = join(root, "dist/portable/VerbaLibera-Portable-audio.html");

test.beforeAll(() => {
  test.setTimeout(240_000);
  if (!existsSync(silent)) {
    throw new Error(
      "Run `npm run portable:build` before this suite: the default artifact is what the " +
        "without-audio case reads.",
    );
  }
  execFileSync(process.execPath, [join(root, "node_modules/.bin/tsx"), "scripts/portable/build.ts", "--with-listen=french"], {
    cwd: root,
    stdio: "pipe",
  });
  execFileSync(
    process.execPath,
    [join(root, "node_modules/.bin/tsx"), "scripts/portable/verify.ts", audio],
    { cwd: root, stdio: "pipe" },
  );
  // The choice is visible in the artifact: the audio build is a third bigger.
  expect(statSync(audio).size).toBeGreaterThan(statSync(silent).size * 1.2);
});

async function openListen(page: Page, artifact: string) {
  // No network is routed anywhere: the file's own CSP forbids it, and a bundle
  // that quietly reached for a URL would fail right here.
  await page.goto(`${pathToFileURL(artifact).href}?language=french&view=listen`);
  await expect(page.getByRole("heading", { name: "Listen", exact: true })).toBeVisible();
  return page.getByRole("button", { name: "Names and introductions", exact: true });
}

test("a portable file built with the audio plays its Listen track offline", async ({ page }) => {
  const track = await openListen(page, audio);
  await expect(page.getByText(/This file carries 4\.9 MB of audio lessons/)).toBeVisible();
  await track.click();
  const player = page.getByLabel("Play the audio lesson: Names and introductions");
  await expect(player).toHaveAttribute("src", /^blob:/);
  // The lock-screen artwork travels in the single file too: the banner is
  // embedded and resolved to a blob, like the audio.
  const artwork = await page.evaluate(() => {
    const metadata = navigator.mediaSession?.metadata;
    return metadata ? metadata.artwork.map((a) => a.src) : null;
  });
  expect(artwork, "the portable file set no lock-screen artwork").not.toBeNull();
  expect(artwork![0]).toMatch(/^blob:/);
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
  await expect(page.getByText(/(resume from|resumed at) 3:00/i)).toBeVisible();
});

test("the default portable file says which tracks it cannot play", async ({ page }) => {
  const track = await openListen(page, silent);
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
