import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import {
  completeFrenchL0,
  completeItalianL0,
  completeItalianL1,
} from "./helpers/complete-l0";

const runtimePlayer = (page: import("@playwright/test").Page) =>
  page.getByRole("navigation", { name: "Course path" });

// Both players mark the outcome on the feedback panel itself.
const OUTCOME = '[role="status"][data-outcome]';

/**
 * The migrated German pack, read from disk so this walk cannot drift from the
 * content: the notice text and the graded answer are the ones the course page
 * loads.
 */
const german = JSON.parse(readFileSync("courses/german/manifest.json", "utf8"));
const germanLesson1 = german.lessons[0];
const germanIntro = german.activities.find(
  (activity: { id: string }) => activity.id === `${germanLesson1.id}-intro`,
);
const germanMeet = germanLesson1.legacyExercises.find(
  (exercise: { id: string }) => exercise.id === "de-first-words-foundation-meet",
);

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
    page.locator('[role="status"][data-outcome]').first(),
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
  // The v2 shell keeps concepts and vocabulary in one disclosure rather than
  // separate Review/Vocabulary/Grammar views with a search box, so this asserts
  // what the shell actually offers — a reference the learner can open on a phone.
  await page.getByText("Grammar and vocabulary", { exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "People and être", exact: true }),
  ).toBeVisible();
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

test("a complete French lesson unlocks the next lesson and survives a reload", async ({
  page,
}) => {
  await page.goto("/courses/french");
  await completeFrenchL0(page);
  // One lesson complete, and exactly one: the path is the learner's record.
  await expect(page.getByText("1 of 25")).toBeVisible();
  expect(await page.getByText("Complete — select to review").count()).toBe(1);
  const second = page.getByRole("button", {
    name: "Names and introductions",
    exact: true,
  });
  await expect(second).toBeEnabled();
  // The unlock is stored, not just held in memory for this page view.
  await page.reload();
  await expect(page.getByText("1 of 25")).toBeVisible();
  expect(await page.getByText("Complete — select to review").count()).toBe(1);
  await expect(second).toBeEnabled();
  await second.click();
  await expect(
    page.getByRole("button", { name: "Begin practice", exact: true }),
  ).toBeEnabled();
});

test("French L1 completes end to end on the v2 player", async ({ page }) => {
  await page.goto("/courses/french");
  await completeFrenchL0(page);
  await page
    .getByRole("button", { name: "Names and introductions", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Begin practice", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Begin practice", exact: true })
    .click();

  // The authored order, which the v1→v2 migration preserved: notice → bridge
  // selection → prediction (Marc) → notice → prediction (Marie) → build →
  // prediction (Sophie) → meaning → cloze → reading.
  const check = async () => {
    await page.getByRole("button", { name: "Check", exact: true }).click();
    // Pin the outcome state rather than the wording: the learner-facing
    // acknowledgement rotates, and the grader's category is no longer shown.
    await expect(page.locator(OUTCOME).first()).toHaveAttribute(
      "data-outcome",
      "correct",
    );
    await page.getByRole("button", { name: /^(Next step|Continue)$/ }).click();
  };
  // Retype a prediction: it is gated, so clear the pause first.
  const predict = async (text: string) => {
    await expect(page.getByText(/think first/i)).toBeVisible();
    expect(await page.getByLabel("Your answer").count()).toBe(0);
    await page.getByRole("button", { name: /i've thought about it/i }).click();
    await page.getByLabel("Your answer").fill(text);
    await check();
  };

  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("radio", { name: "suis", exact: true }).check();
  await check();
  await predict("Je suis Marc.");
  await page
    .getByRole("radio", {
      name: "The woman's word ends in -e; the man's does not.",
      exact: true,
    })
    .check();
  await check();
  await predict("Je suis française.");
  // The build step banks tokens in the authored order.
  for (const word of ["Je", "suis", "française."]) {
    await page.getByRole("button", { name: `Add ${word}`, exact: true }).click();
  }
  await check();
  await predict("Je suis Sophie.");
  await page.getByLabel(/^(Your answer|Missing word)$/).fill("I am French.");
  await check();
  await page.getByLabel(/^(Your answer|Missing word)$/).fill("suis");
  await check();
  await page.getByLabel(/^(Your answer|Missing word)$/).fill("Anna");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.locator(OUTCOME).first()).toHaveAttribute(
    "data-outcome",
    "correct",
  );
  await page.getByRole("button", { name: "Next step", exact: true }).click();
  // The lesson's last step is the optional listening model, and the option is
  // only "finish or not" — the primary button stays "Check" until that step is
  // answered, so the walk answers it to reach the end of the lesson.
  await page.getByLabel(/^(Your answer|Missing word)$/).fill("Je suis Anna.");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.locator(OUTCOME).first()).toHaveAttribute(
    "data-outcome",
    "correct",
  );
  await page.getByRole("button", { name: "Finish lesson", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Lesson complete", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to lessons", exact: true }).click();
  await expect(page.getByText("2 of 25")).toBeVisible();
  expect(await page.getByText("Complete — select to review").count()).toBe(2);
});

test("German teaches on the v2 player after the 2B flip, pause intact", async ({
  page,
}) => {
  await page.goto("/courses/german");
  await expect(page.getByRole("heading", { name: german.title })).toBeVisible();
  const path = runtimePlayer(page);

  // Every lesson the migrated pack carries is on the course path, and the first
  // one is open: a flip that invented a prerequisite would fail here.
  for (const lesson of german.lessons)
    await expect(path.getByRole("button", { name: lesson.title })).toBeVisible();
  await expect(path.getByRole("button", { name: germanLesson1.title })).toBeEnabled();

  await path.getByRole("button", { name: germanLesson1.title }).click();
  await page.getByRole("button", { name: "Begin practice", exact: true }).click();

  // Step 1 is the notice the migration relocated: the authored explanation is
  // what a learner reads first, and it is still there after the flip.
  await expect(page.getByText(germanIntro.body)).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  // Step 2 grades the authored answer, under the id the v1 engine wrote.
  await page.getByRole("radio", { name: germanMeet.answers[0], exact: true }).check();
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.locator(OUTCOME).first()).toHaveAttribute(
    "data-outcome",
    "correct",
  );
  await page.getByRole("button", { name: /^(Next step|Continue)$/ }).click();

  // Step 3 is the migrated `think` exercise: the v1 pause must survive as a v2
  // prediction step, with no answer input until the learner has thought.
  await expect(page.getByText(/think first/i)).toBeVisible();
  expect(await page.getByLabel("Your answer").count()).toBe(0);
  await page.getByRole("button", { name: /i've thought about it/i }).click();
  await expect(page.getByLabel("Your answer")).toBeVisible();
  await page.getByLabel("Your answer").fill("Hallo.");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.locator(OUTCOME).first()).toHaveAttribute(
    "data-outcome",
    "correct",
  );
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
