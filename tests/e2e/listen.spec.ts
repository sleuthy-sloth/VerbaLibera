import { test, expect } from "@playwright/test";

for (const course of ["spanish", "portuguese", "german"]) {
  test(`${course} long audio opens, decodes, plays and can be saved`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/listen?course=${course}`);
    await expect(page.getByLabel("Course")).toHaveValue(course);
    await page.getByRole("button", { name: "Introducing yourself", exact: true }).click();
    // The card's own transport is the player now; the native element is the
    // layer underneath it (`tests/ListenPlayer.test.tsx` covers that layer).
    const player = page.locator("audio");
    await expect(page.getByRole("button", { name: "Play the audio lesson" })).toBeVisible();
    expect(await player.count()).toBe(1);
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
    // The card follows the element it is driving.
    await expect(page.getByRole("button", { name: "Pause the audio lesson" })).toBeVisible();
    // The lock screen is the surface a walker actually looks at, so the artwork
    // has to be in the media metadata, not just on the page. The player's own
    // square leads — a notification slot is small and square — and the course
    // banner follows it for a wider surface.
    const artwork = await page.evaluate(() => {
      const metadata = navigator.mediaSession?.metadata;
      return metadata
        ? { title: metadata.title, album: metadata.album, artwork: metadata.artwork.map((a) => ({ src: a.src, sizes: a.sizes })) }
        : null;
    });
    expect(artwork, `${course}: no media metadata`).not.toBeNull();
    expect(artwork!.album).toContain("foundations");
    expect(artwork!.artwork.length).toBe(2);
    expect(artwork!.artwork[0].src).toContain("/brand/player-lock.jpg");
    expect(artwork!.artwork[0].sizes).toBe("1024x1024");
    expect(artwork!.artwork[1].src).toContain(`/brand/courses/${course}.jpg`);
    expect(artwork!.artwork[1].sizes).toBe("2064x512");
    await player.evaluate((audio: HTMLAudioElement) => audio.pause());
    const link = page.getByRole("link", { name: "Save audio for offline listening" });
    await expect(link).toHaveAttribute("download", "");
    await expect(link).toHaveAttribute("href", (await player.getAttribute("src"))!);
    await page.getByText("Read along (transcript)").click();
    await expect(page.getByRole("heading", { name: "Start with a greeting" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
}

// The visual brief: a phone gets controls a walker can hit, and the card has to
// work with the keyboard as well as a thumb.
test("the player card is usable on a phone and from the keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/listen?course=french");
  await page.getByRole("button", { name: "Names and introductions", exact: true }).click();

  // Every transport control is a real target on a phone screen.
  for (const name of ["Play the audio lesson", "Back 15 seconds", "Forward 15 seconds"]) {
    const box = await page.getByRole("button", { name, exact: true }).boundingBox();
    expect(box, name).not.toBeNull();
    expect(box!.height, name).toBeGreaterThanOrEqual(44);
    expect(box!.width, name).toBeGreaterThanOrEqual(44);
  }
  // The scrubber is a large enough thumb, not a hairline.
  const bar = await page.getByRole("slider", { name: /seek within the audio lesson/i }).boundingBox();
  expect(bar!.height).toBeGreaterThanOrEqual(40);

  const player = page.locator("audio");
  await player.evaluate(async (audio: HTMLAudioElement) => {
    audio.load();
    await new Promise<void>((resolve) => {
      audio.addEventListener("loadedmetadata", () => resolve(), { once: true });
    });
  });

  // 15 seconds forward and back, on the file.
  await page.getByRole("button", { name: "Forward 15 seconds", exact: true }).click();
  expect(await player.evaluate((audio: HTMLAudioElement) => Math.round(audio.currentTime))).toBe(15);
  await page.getByRole("button", { name: "Back 15 seconds", exact: true }).click();
  expect(await player.evaluate((audio: HTMLAudioElement) => Math.round(audio.currentTime))).toBe(0);

  // The scrubber seeks, and announces where it landed.
  const scrubber = page.getByRole("slider", { name: /seek within the audio lesson/i });
  await scrubber.fill("240");
  expect(await player.evaluate((audio: HTMLAudioElement) => Math.round(audio.currentTime))).toBe(240);
  await expect(scrubber).toHaveAttribute("aria-valuetext", /4:00 of /);

  // Speed is reachable without a pointer, and it changes what plays.
  await page.getByLabel("Speed").selectOption("1.25");
  expect(await player.evaluate((audio: HTMLAudioElement) => audio.playbackRate)).toBe(1.25);

  // The card is a card, not a full-screen player: on a 390×844 phone it takes
  // well under the screen, and nothing overflows sideways.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const card = page.getByRole("region", { name: /audio lesson/i });
  // The transcript starts closed: if it did not, the card would be as tall as
  // the whole recording's transcript and the measurement below would be of the
  // wrong thing.
  expect(await page.locator("details").evaluate((el) => (el as HTMLDetailsElement).open)).toBe(false);
  const compact = await card.boundingBox();
  expect(compact!.height).toBeLessThan(844 * 0.75);

  // The transcript is a real disclosure, not always-open text: it starts closed
  // and adds its length when opened. The French track's first section comes
  // from its own generated transcript.
  await page.getByText("Read along (transcript)").click();
  await expect(page.getByRole("heading", { name: "Welcome", exact: true })).toBeVisible();
  const expanded = await card.boundingBox();
  expect(expanded!.height).toBeGreaterThan(compact!.height);
});

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
  await expect(player).toHaveCount(1);
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
  await expect(page.getByText(/(resume from|resumed at) 4:00/i)).toBeVisible();
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
  await expect(page.getByText(/resume from/i)).toHaveCount(0);
});

// The card's own artwork. The brief allows one restrained cover treatment; this
// is it, and what has to hold is that it is decoration, that it is really the
// shipped file, and that it does not land on top of the controls or push the
// card sideways on the width where a phone is.
test("the player card shows its own cover art without crowding the controls", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/listen?course=french");
  await page.getByRole("button", { name: "Names and introductions", exact: true }).click();

  const cover = page.locator('img[src*="player-card"]');
  await expect(cover).toBeVisible();
  // Decorative: the heading and the transport already say what is playing.
  await expect(cover).toHaveAttribute("alt", "");
  expect(await cover.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(800);
  expect(await cover.evaluate((img: HTMLImageElement) => img.naturalHeight)).toBe(449);

  const coverBox = (await cover.boundingBox())!;
  const headerBox = (await page.locator("section[aria-label^='Audio lesson'] header").boundingBox())!;
  const playBox = (await page.getByRole("button", { name: "Play the audio lesson" }).boundingBox())!;

  // A phone shows it at thumbnail size inside the header row it already had, so
  // the artwork costs the card no height. The card is a card, not a poster —
  // the same line `the player card is usable on a phone` holds.
  expect(coverBox.width).toBeLessThanOrEqual(100);
  expect(coverBox.y).toBeGreaterThanOrEqual(headerBox.y);
  expect(coverBox.y + coverBox.height).toBeLessThanOrEqual(headerBox.y + headerBox.height);
  const compact = (await page.locator("section[aria-label^='Audio lesson']").boundingBox())!;
  expect(compact.height).toBeLessThan(844 * 0.75);

  // Clear of every transport control, not just the first one.
  for (const name of ["Play the audio lesson", "Back 15 seconds", "Forward 15 seconds"]) {
    const box = (await page.getByRole("button", { name, exact: true }).boundingBox())!;
    const overlaps = coverBox.y + coverBox.height > box.y && coverBox.y < box.y + box.height;
    expect(overlaps, `${name} overlaps the cover art`).toBe(false);
  }
  expect(playBox.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  // Above a phone's width the whole picture opens up across the card, capped so
  // it stays a cover treatment rather than a hero image.
  await page.setViewportSize({ width: 1280, height: 900 });
  const wide = (await cover.boundingBox())!;
  // Re-measure the header here: the phone's box is stale once the page re-lays out.
  const wideHeader = (await page.locator("section[aria-label^='Audio lesson'] header").boundingBox())!;
  expect(wide.width).toBeGreaterThan(300);
  expect(wide.width).toBeLessThanOrEqual(420);
  expect(wide.y).toBeGreaterThanOrEqual(wideHeader.y);
  expect(wide.height).toBeLessThan(280);
});
