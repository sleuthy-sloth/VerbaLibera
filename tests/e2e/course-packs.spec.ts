import { test, expect } from "@playwright/test";
import { completeFrenchL0, completeItalianL0 } from "./helpers/complete-l0";
test("Italian teaches, checks locally, saves practice and survives an offline cold start", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "Playwright service-worker offline automation is Chromium-only; see docs/astra/testing.md.",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/courses/italian");
  await expect(
    page.getByRole("heading", { name: "Italian foundations", exact: true }),
  ).toBeVisible();
  // L1 practice is prerequisite-gated behind L0: complete first words first.
  await completeItalianL0(page);
  await page
    .getByRole("button", { name: "Names and introductions", exact: true })
    .click();
  await expect(page.getByText("Io sono Anna.", { exact: true }).first()).toBeVisible();
  // Spy audio playback: Begin practice must autoplay the lesson model.
  await page.evaluate(() => {
    (window as unknown as { __plays: string[] }).__plays = [];
    const orig = HTMLAudioElement.prototype.play;
    HTMLAudioElement.prototype.play = function () {
      (window as unknown as { __plays: string[] }).__plays.push(this.src);
      return orig.call(this);
    };
  });
  await page
    .getByRole("button", { name: "Begin practice", exact: true })
    .click();
  await expect
    .poll(
      () =>
        page.evaluate(
          () => (window as unknown as { __plays: string[] }).__plays.join("|"),
        ),
      { timeout: 15000 },
    )
    .toContain("it-identity-foundation-model.wav");
  // Hear-it-first: the model autoplays on Begin practice (asserted above),
  // then practice opens on the meet-the-word choice, not a blank textbox.
  // The listen-first strip names the sentence just heard and offers a replay,
  // so the learner knows the audio and Practice 1 are connected.
  await expect(
    page.getByText("Which Italian word means", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText(/You just heard/)).toBeVisible();
  await expect(page.getByText("«Io sono Anna.»")).toBeVisible();
  await expect(
    page.getByLabel("Replay the model sentence"),
  ).toBeVisible();
  await page.getByRole("radio", { name: "sono", exact: true }).check();
  await page.getByRole("button", { name: "Check answer", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("correct");
  await page
    .getByRole("button", { name: "Save and continue", exact: true })
    .click();
  await expect(
    // L0's 7 saves plus this one.
    page.getByText(/8 practice results on this device/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Course", exact: true }).click();
  await page
    .getByRole("button", { name: "Download for offline study", exact: true })
    .click();
  await expect(
    page.getByText(
      "Downloaded on this device", { exact: true },
    ),
  ).toBeVisible({ timeout: 30000 });
  await context.setOffline(true);
  await page.goto("/study.html?language=italian");
  await expect(
    page.getByRole("heading", { name: "Italian foundations", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/8 practice results on this device/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Names and introductions", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Begin practice", exact: true })
    .click();
  await expect(
    page.getByText("Which Italian word means", { exact: false }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "sono", exact: true }).check();
  await page.getByRole("button", { name: "Check answer", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("correct");
  await page
    .getByRole("button", { name: "Save and continue", exact: true })
    .click();
  await expect(
    page.getByText(/9 practice results on this device/),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText(/9 practice results on this device/),
  ).toBeVisible();
});
test("French references and mobile navigation are usable", async ({ page }) => {
  await page.goto("/courses/french");
  await page.getByRole("button", { name: "Grammar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "People and être", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Vocabulary", exact: true }).click();
  await page.getByLabel("Search vocabulary").fill("frère");
  await expect(page.getByText("a brother", { exact: true })).toBeVisible();
  for (const width of [320, 390, 430, 844]) {
    await page.setViewportSize({ width, height: width === 844 ? 390 : 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByLabel("Foundation language").selectOption("italian");
  await expect(page).toHaveURL(/courses\/italian/);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Italian foundations", exact: true }),
  ).toBeVisible();
});

test("a complete French lesson unlocks the next lesson and a dialogue can recover", async ({
  page,
}) => {
  await page.goto("/courses/french");
  // L1 practice is prerequisite-gated behind L0: complete first words first.
  await completeFrenchL0(page);
  await page
    .getByRole("button", { name: "Names and introductions", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Begin practice", exact: true })
    .click();
  // Thinking sequence: bridge choice → think (Marc) → notice (-e) →
  // think (Marie) → build (order) → transfer (Sophie, untaught) →
  // meaning → cloze → reading.
  await page.getByRole("radio", { name: "suis", exact: true }).check();
  await page.getByRole("button", { name: "Check answer", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("correct");
  await page
    .getByRole("button", { name: "Save and continue", exact: true })
    .click();
  for (const answer of ["Je suis Marc.", "Je suis française.", "Je suis Sophie."]) {
    if (answer === "Je suis française.") {
      await page
        .getByRole("radio", {
          name: "The woman's word ends in -e; the man's does not.",
          exact: true,
        })
        .check();
      await page
        .getByRole("button", { name: "Check answer", exact: true })
        .click();
      await expect(page.getByRole("status")).toContainText("correct");
      await page
        .getByRole("button", { name: "Save and continue", exact: true })
        .click();
    }
    await page
      .getByRole("button", { name: /i've thought about it/i })
      .click();
    await page.getByLabel(/^(Your answer|Missing word)$/).fill(answer);
    await page.getByRole("button", { name: "Check answer", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("correct");
    await page
      .getByRole("button", { name: "Save and continue", exact: true })
      .click();
    if (answer === "Je suis française.") {
      for (const word of ["Je", "suis", "française."])
        await page.getByRole("button", { name: word, exact: true }).click();
      await page.getByRole("button", { name: "Check answer", exact: true }).click();
      await expect(page.getByRole("status")).toContainText("correct");
      await page
        .getByRole("button", { name: "Save and continue", exact: true })
        .click();
    }
  }
  await page.getByLabel(/^(Your answer|Missing word)$/).fill("I am French.");
  await page.getByRole("button", { name: "Check answer", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("correct");
  await page
    .getByRole("button", { name: "Save and continue", exact: true })
    .click();
  await page.getByLabel(/^(Your answer|Missing word)$/).fill("suis");
  await page.getByRole("button", { name: "Check answer", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("correct");
  await page
    .getByRole("button", { name: "Save and continue", exact: true })
    .click();
  await page.getByLabel(/^(Your answer|Missing word)$/).fill("Anna");
  await page.getByRole("button", { name: "Check answer", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("correct");
  await page
    .getByRole("button", { name: "Save and continue", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Practice complete", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Back to course", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open next lesson", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "People and être", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Begin practice", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Dialogues", exact: true }).click();
  const meeting = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Meeting someone", exact: true }),
  });
  await meeting
    .getByRole("button", { name: "Je suis française.", exact: true })
    .click();
  await expect(meeting.getByRole("status")).toContainText("nationality");
  await meeting
    .getByRole("button", { name: "Je suis Marc.", exact: true })
    .click();
  await expect(
    meeting.getByText("Conversation complete. You reached the goal."),
  ).toBeVisible();
});

for (const [language, answer] of [['italian', 'Io sono Anna.'], ['french', 'Je suis Anna.']]) {
  test(`${language} model audio plays and optional listening saves a separate recall`, async ({ page, context, browserName }) => {
    await page.goto(`/courses/${language}`);
    if (language === 'french') await completeFrenchL0(page);
    if (language === 'italian') await completeItalianL0(page);
    if (browserName === 'chromium') {
      await page.getByRole('button', { name: 'Download for offline study', exact: true }).click();
      await expect(page.getByText('Downloaded on this device', { exact: true })).toBeVisible();
      await context.setOffline(true);
      await page.goto(`/study.html?language=${language}`);
    }
    await page.getByRole('button', { name: 'Names and introductions', exact: true }).click();
    await page.getByRole('button', { name: 'Practice listening', exact: true }).click();
    const audio = page.getByLabel('Dictation audio', { exact: true });
    await audio.evaluate(async (element: HTMLAudioElement) => { await element.play(); });
    await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Use slow replay (0.75×)', exact: true }).click();
    expect(await audio.evaluate((element: HTMLAudioElement) => element.playbackRate)).toBe(0.75);
    await page.getByLabel('Your answer', { exact: true }).fill(answer);
    await page.getByRole('button', { name: 'Check answer', exact: true }).click();
    await page.getByRole('button', { name: 'Save and continue', exact: true }).click();
    // Both languages complete L0 first (7 device results) before this listening save.
    await expect(page.getByText('8 practice results on this device')).toBeVisible();
    await page.getByRole('button', { name: 'Grammar', exact: true }).click();
    // L0's concept summary also reports its own listening save: scope to L1.
    const grammar = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Names and introductions' }) });
    await expect(grammar.getByText(/listening: 1 successful, 0 missed recalls/)).toBeVisible();
    await context.setOffline(false);
  });
}
