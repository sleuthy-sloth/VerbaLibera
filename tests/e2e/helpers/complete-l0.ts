import { expect, type Page } from "@playwright/test";

// Completes an L0 ("First words") guest practice end to end, starting from
// the course lesson list, and returns to the lesson list. L1 practice is
// prerequisite-gated behind L0, so walks that touch "Names and
// introductions" must run the matching helper first.
type L0Answers = {
  meet: string;
  think: string;
  notice: string;
  meaning: string;
  cloze: string;
  reading: string;
  dictation: string;
};

async function completeL0(page: Page, answers: L0Answers) {
  await page
    .getByRole("button", { name: "First words", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Begin practice", exact: true })
    .click();
  // Italian's authored-v2 pilot begins with an information step and uses the
  // runtime player's concise controls. French remains on the legacy player.
  // The Italian course uses the v2 runtime player. Use the route rather than
  // a one-shot visibility probe, since the player can still be mounting after
  // the preceding click on a slower browser.
  const runtimePlayer = new URL(page.url()).pathname === "/courses/italian";
  if (runtimePlayer) {
    // Information steps save before continuing straight to the first
    // practice activity.
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(
      page.getByRole("radio", { name: answers.meet, exact: true }),
    ).toBeVisible();
  }
  const check = async () => {
    await page
      .getByRole("button", { name: runtimePlayer ? "Check" : "Check answer", exact: true })
      .click();
    // Scope to the exercise feedback: account scope adds a second
    // "Saved locally…" status that breaks an unscoped role query.
    await expect(
      page.getByRole("status").filter({ hasText: "correct" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: runtimePlayer ? "Next step" : "Save and continue", exact: true })
      .click();
  };
  const choose = async (name: string) => {
    await page.getByRole("radio", { name, exact: true }).check();
    await check();
  };
  const type = async (text: string, thinkFirst: boolean) => {
    if (thinkFirst && !runtimePlayer)
      await page
        .getByRole("button", { name: /i've thought about it/i })
        .click();
    await page.getByLabel(/^(Your answer|Missing word)$/).fill(text);
    await check();
  };
  await choose(answers.meet);
  await type(answers.think, true);
  await choose(answers.notice);
  await type(answers.meaning, false);
  await type(answers.cloze, false);
  await type(answers.reading, false);
  if (runtimePlayer) {
    await page.getByLabel(/^(Your answer|Missing word)$/).fill(answers.dictation);
    await page.getByRole("button", { name: "Check", exact: true }).click();
    await page.getByRole("button", { name: "Finish lesson", exact: true }).click();
  } else await type(answers.dictation, false);
  await expect(
    page.getByRole("heading", { name: runtimePlayer ? "Lesson complete" : "Practice complete", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: runtimePlayer ? "Back to lessons" : "Back to course", exact: true })
    .click();
}

export async function completeFrenchL0(page: Page) {
  await page.goto("/courses/french");
  await completeL0(page, {
    meet: "Hello.",
    think: "Bonjour.",
    notice: "French and English share thousands of words from Latin.",
    meaning: "Thank you.",
    cloze: "Bonjour.",
    reading: "Three times.",
    dictation: "Bonjour, merci.",
  });
}

export async function completeItalianL0(page: Page) {
  await page.goto("/courses/italian");
  await completeL0(page, {
    meet: "Hello.",
    think: "Ciao.",
    notice: "Italian and English share thousands of words from Latin.",
    meaning: "Thank you.",
    cloze: "Ciao.",
    reading: "Three times.",
    dictation: "Ciao, grazie.",
  });
}
