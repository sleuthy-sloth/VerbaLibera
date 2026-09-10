import { test, expect } from "@playwright/test";
import {
  completeFrenchL0,
  completeItalianL0,
  completeItalianL1,
} from "./helpers/complete-l0";

const runtimePlayer = (page: import("@playwright/test").Page) =>
  page.getByRole("navigation", { name: "Course path" });

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
  // The v2 course path must be present and honest: later lessons stay locked.
  await expect(runtimePlayer(page)).toBeVisible();
  const l1 = page.getByRole("button", {
    name: "Names and introductions",
    exact: true,
  });
  await expect(l1).toBeDisabled();

  // Completing First words unlocks Names and introductions.
  await completeItalianL0(page);
  await expect(l1).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "First words", exact: true }),
  ).toBeEnabled();

  // Practice inside the unlocked lesson: choose the meet-the-word answer.
  await l1.click();
  await page.getByRole("button", { name: "Begin practice", exact: true }).click();
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("radio", { name: "sono", exact: true })).toBeVisible();
  await page.getByRole("radio", { name: "sono", exact: true }).check();
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "correct" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next step", exact: true }).click();

  // Returning from the lesson goes back to the course path, not a stale lesson.
  await page.getByRole("button", { name: "All lessons", exact: true }).click();
  await expect(runtimePlayer(page)).toBeVisible();

  // Offline install works on the v2 path and survives a cold start.
  await page
    .getByRole("button", { name: "Download for offline study", exact: true })
    .click();
  await expect(
    page.getByText("Downloaded on this device", { exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await context.setOffline(true);
  await page.goto("/study.html?language=italian");
  await expect(
    page.getByRole("heading", { name: "Italian foundations", exact: true }),
  ).toBeVisible();
  await expect(runtimePlayer(page)).toBeVisible();
  // Progress survived: Names and introductions is still unlocked offline.
  await expect(
    page.getByRole("button", { name: "Names and introductions", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Names and introductions", exact: true })
    .click();
  await page.getByRole("button", { name: "Begin practice", exact: true }).click();
  // The resumed lesson continues at the first incomplete step — the two steps
  // answered online are still counted, so practice picks up on the third.
  await expect(
    page.getByRole("heading", {
      name: "Give the English meaning: Sono italiana.",
      exact: true,
    }),
  ).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("2 of 7 steps completed")).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Names and introductions", exact: true })
    .click();
  await page.getByRole("button", { name: "Begin practice", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Give the English meaning: Sono italiana.",
      exact: true,
    }),
  ).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("2 of 7 steps completed")).toBeVisible();
});

test("French references and mobile navigation are usable", async ({ page }) => {
  await page.goto("/courses/french");
  await page.getByRole("link", { name: "Grammar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "People and être", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Vocabulary", exact: true }).click();
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
  await page.getByLabel("Learning language").selectOption("italian");
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
  await completeFrenchL0(page);
  // Legacy course: unlock is demonstrated by an enabled L1 and Begin practice.
  await page
    .getByRole("button", { name: "Names and introductions", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Begin practice", exact: true }),
  ).toBeEnabled();

  // Thinking sequence on the legacy player: bridge choice → think (Marc) →
  // notice (-e) → think (Marie) → build (order) → transfer (Sophie) →
  // meaning → cloze → reading.
  await page.getByRole("button", { name: "Begin practice", exact: true }).click();
  await page.getByRole("radio", { name: "suis", exact: true }).check();
  await page.getByRole("button", { name: "Check answer", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("correct");
  await page
    .getByRole("button", { name: "Save and continue", exact: true })
    .click();
  for (const answer of ["Je suis Marc.", "Je suis française.", "Je suis Sophie."]) {
    if (answer === "Je suis française.") {
      // The notice step asks what changed between française and français —
      // pick the -e ending before checking.
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
  await expect(
    page.getByRole("button", { name: "People and être", exact: true }),
  ).toBeEnabled();
  await page.getByRole("link", { name: "Dialogues", exact: true }).click();
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

test("Italian lesson audio plays and the listening step can be reached", async ({
  page,
}) => {
  await page.goto("/courses/italian");
  await completeItalianL0(page);
  // Names and introductions carries an optional listening step at the end.
  await completeItalianL1(page);
  // Audio is real: the player can start playback and slow replay changes rate.
  const audio = page.getByLabel("Lesson audio", { exact: true });
  await expect(audio).toBeVisible();
  await audio.evaluate(async (element: HTMLAudioElement) => {
    await element.play();
  });
  await expect
    .poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime))
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Retry audio", exact: true }).click();
  await expect(audio).toBeVisible();
  // Revealing the transcript marks the attempt assisted, never independent.
  await page.getByRole("button", { name: "Show transcript", exact: true }).click();
  // The notice used to read "Assisted practice — help was shown on this step,
  // so this attempt will not count toward independent review." It now says what
  // happens next in plain words, and is scoped rather than matched by role
  // (the player has more than one live region while a step is graded).
  await expect(
    page.getByText(/already seen the answer on this step/i),
  ).toBeVisible();
});
