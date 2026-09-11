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
  await page.getByRole("link", { name: "Listen", exact: true }).click();
  await expect(page).toHaveURL(/\/listen$/);
  await expect(
    page.getByRole("heading", { name: "Listen", exact: true }),
  ).toBeVisible();
  // Only L1 has a track. The page lists what exists and says once, honestly,
  // how much is still being recorded — it used to render twenty-four
  // consecutive "Audio being authored" rows.
  await expect(
    page.getByRole("button", { name: "Names and introductions", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/more lessons? (is|are) being recorded/i)).toBeVisible();
  await expect(page.getByText("Audio being authored")).toHaveCount(0);
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

// Roadmap 3A: "persist playback position ... and resume behaviour". A long
// track that forgets the place is one a learner never finishes, so the position
// is saved locally and offered back after the app is reopened.
test("Listen resumes the French track where it was left, across a cold start", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/listen?course=french");
  await page
    .getByRole("button", { name: "Names and introductions", exact: true })
    .click();
  const player = page.getByLabel("Play the audio lesson: Names and introductions");
  await player.evaluate(async (audio: HTMLAudioElement) => {
    audio.load();
    await new Promise<void>((resolve, reject) => {
      audio.addEventListener("loadedmetadata", () => resolve(), { once: true });
      audio.addEventListener("error", () => reject(new Error("Audio failed to decode")), { once: true });
    });
    await audio.play();
  });

  // A real seek, then stop: the player has to notice both.
  await player.evaluate((audio: HTMLAudioElement) => {
    audio.currentTime = 240;
  });
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("verbalibera_listen_position:fr-identity-foundation")),
    )
    .toBe("240");
  await player.evaluate((audio: HTMLAudioElement) => audio.pause());

  // Cold start: the tab is gone, the page is loaded fresh, the learner picks
  // the same lesson again — and is offered the place they left.
  await page.goto("/listen?course=french");
  await page
    .getByRole("button", { name: "Names and introductions", exact: true })
    .click();
  // The player says where it picked up. In a real browser `preload="metadata"`
  // means the seek can have happened by the first paint, so either wording is
  // the same claim being kept.
  await expect(page.getByText(/(stopped at|resumed at) 4:00/i)).toBeVisible();
  const reopened = page.getByLabel("Play the audio lesson: Names and introductions");
  await reopened.evaluate(async (audio: HTMLAudioElement) => {
    await new Promise<void>((resolve) => {
      if (audio.readyState >= 1) resolve();
      else audio.addEventListener("loadedmetadata", () => resolve(), { once: true });
    });
  });
  await expect
    .poll(() => reopened.evaluate((audio: HTMLAudioElement) => Math.round(audio.currentTime)))
    .toBe(240);

  // "Start over" is a real answer, not decoration: the record clears and the
  // next visit starts at the beginning.
  await page.getByRole("button", { name: "Start over", exact: true }).click();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("verbalibera_listen_position:fr-identity-foundation"),
    ),
  ).toBeNull();
  await page.goto("/listen?course=french");
  await page
    .getByRole("button", { name: "Names and introductions", exact: true })
    .click();
  await expect(page.getByText(/you stopped at/i)).toHaveCount(0);
});
