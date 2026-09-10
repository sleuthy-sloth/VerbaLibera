import { test, expect } from "@playwright/test";

for (const course of ["spanish", "portuguese", "german"]) {
  test(`${course} long audio opens, decodes, plays and can be saved`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/listen?course=${course}`);
    await expect(page.getByRole("combobox")).toHaveValue(course);
    await page.getByRole("button", { name: "Introducing yourself", exact: true }).click();
    const player = page.locator("audio");
    await expect(player).toBeVisible();
    await player.evaluate(async (audio: HTMLAudioElement) => {
      audio.load();
      await new Promise<void>((resolve, reject) => {
        audio.addEventListener("loadedmetadata", () => resolve(), { once: true });
        audio.addEventListener("error", () => reject(new Error("Audio failed to decode")), { once: true });
      });
      await audio.play();
    });
    await expect.poll(() => player.evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeGreaterThan(0);
    expect(await player.evaluate((audio: HTMLAudioElement) => audio.duration)).toBeGreaterThan(480);
    await player.evaluate((audio: HTMLAudioElement) => audio.pause());
    const link = page.getByRole("link", { name: "Save audio for offline listening" });
    await expect(link).toHaveAttribute("download", "");
    await expect(link).toHaveAttribute("href", (await player.getAttribute("src"))!);
    await page.getByText("Read along (transcript)").click();
    await expect(page.getByRole("heading", { name: "Start with a greeting" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
}
// Listen tab: audio-only path lists lessons honestly, plays the authored
// French L1 track, and marks it listened on finish.
test("Listen tab plays the French L1 audio lesson and logs it heard", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Audio lessons" }).click();
  await expect(page).toHaveURL(/\/listen$/);
  await expect(
    page.getByRole("heading", { name: "Listen", exact: true }),
  ).toBeVisible();
  // Only L1 has a track; the rest say so honestly.
  await expect(
    page.getByRole("button", { name: "Names and introductions", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Audio being authored").first()).toBeVisible();
  await page
    .getByRole("button", { name: "Names and introductions", exact: true })
    .click();
  const player = page.getByLabel("Play the audio lesson: Names and introductions");
  await expect(player).toBeVisible();
  await expect(player).toHaveAttribute(
    "src",
    "/audio/french-foundations/fr-identity-listen.mp3",
  );
  await page.getByText("Read along (transcript)").click();
  await expect(page.getByText("Transfer: Sophie")).toBeVisible();
  // Finishing the track marks it heard — listened, never mastered.
  await player.evaluate((audio: HTMLAudioElement) => audio.dispatchEvent(new Event("ended")));
  await expect(page.getByRole("status")).toContainText("Listened");
  // The heard badge survives a reload on the lesson list.
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Names and introductions", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Listened", { exact: true })).toBeVisible();
});
