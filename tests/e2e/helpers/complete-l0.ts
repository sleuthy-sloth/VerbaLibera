import { expect, type Page } from "@playwright/test";

// Runtime detection must work for any origin: the hosted v2 app lives at
// /courses/italian but the portable single file opens from a file:// URL and
// also renders the v2 runtime course. Only the French course page still uses
// the legacy player, so legacy is the absence of the v2 course path nav.
/** Detect the v2 player by asking the app, not the URL: after opening the
 * lesson, the runtime player grades with "Check" while the legacy player
 * grades with "Check answer". Works on hosted and file:// origins alike. */
async function isRuntimePlayer(page: Page, lessonTitle: string): Promise<boolean> {
  const lesson = page.getByRole("button", { name: lessonTitle, exact: true });
  await expect(lesson).toBeEnabled();
  await lesson.click();
  await page.getByRole("button", { name: "Begin practice", exact: true }).click();
  const check = page.getByRole("button", { name: "Check", exact: true });
  const legacy = page.getByRole("button", { name: "Check answer", exact: true });
  const info = page.getByRole("button", { name: "Continue", exact: true });
  for (let i = 0; i < 60; i++) {
    if ((await check.count()) > 0) return true;
    if ((await legacy.count()) > 0) return false;
    // The v2 lesson opens on an information step first: dismiss it, then
    // re-probe for the grading control.
    if ((await info.count()) > 0) {
      await info.click();
      await page.waitForTimeout(250);
      continue;
    }
    await page.waitForTimeout(250);
  }
  throw new Error("Could not determine which lesson player is rendering.");
}

/** Opens lesson one ("First words") in the course currently on screen. */
async function openLesson(page: Page, title: string) {
  const lesson = page.getByRole("button", { name: title, exact: true });
  await expect(lesson).toBeEnabled();
  await lesson.click();
  await page.getByRole("button", { name: "Begin practice", exact: true }).click();
}

// Completes one lesson end to end. `answers` holds every interaction needed
// in step order; the driver works on both the v2 runtime player and the
// legacy player so a lesson walk is written once per lesson, not per runtime.
type Step =
  | { kind: "choice"; name: string }
  | { kind: "text"; text: string; think?: boolean }
  | { kind: "order"; words: string[] };

type LessonAnswers = {
  title: string;
  runtime: Step[];
  legacy: Step[];
};

const runtimePlayer = true;
const legacyPlayer = false;

async function walk(page: Page, steps: Step[], runtime: boolean) {
  const check = async () => {
    await page
      .getByRole("button", {
        name: runtime ? "Check" : "Check answer",
        exact: true,
      })
      .click();
    await expect(
      // Both engines now mark the outcome on the feedback panel itself, so the
      // wait no longer depends on the grader's wording ("correct" was the raw
      // category, which the learner never sees any more). `data-outcome` is
      // present on the v1 practice panel and on the v2 runtime panel.
      page.locator('[role="status"][data-outcome]').first(),
    ).toBeVisible();
    // The v2 runtime player shows "Saving…" while persisting the step and
    // then advances to the next step; the legacy player keeps a steady
    // "Continue". Match whichever one is present.
    const advance = page
      .getByRole("button", { name: runtime ? "Next step" : "Continue", exact: true })
      .or(page.getByRole("button", { name: "Saving…", exact: true }))
      .or(page.getByRole("button", { name: "Finish lesson", exact: true }));
    await advance.first().click();
  };
  for (const step of steps) {
    if (step.kind === "choice") {
      await page.getByRole("radio", { name: step.name, exact: true }).check();
      await check();
    } else if (step.kind === "order") {
      // Bank tokens are "Add <word>" buttons; click them in the authored order.
      for (const word of step.words) {
        await page.getByRole("button", { name: `Add ${word}`, exact: true }).click();
        await expect(
          page.getByRole("button", { name: `Add ${word}`, exact: true }),
        ).toHaveCount(0);
      }
      await check();
    } else {
      // A prediction is gated in both players — the legacy `think` exercise and
      // the v2 `predict` step — so clear the pause wherever it is actually
      // showing rather than trusting which engine we think we are on.
      const gate = page.getByRole("button", { name: /i've thought about it/i });
      if ((await gate.count()) > 0) await gate.click();
      await page.getByLabel(/^(Your answer|Missing word)$/).fill(step.text);
      await check();
    }
  }
}

async function completeLesson(page: Page, answers: LessonAnswers) {
  // Detection opens the lesson; the walk continues from wherever it landed.
  const runtime = await isRuntimePlayer(page, answers.title);
  if (runtime) {
    // isRuntimePlayer already opened the lesson and dismissed any opening
    // information step while probing for the grading control, so it may have
    // consumed it. Dismiss a second one only if one is actually showing.
    const pendingInfo = page.getByRole("button", { name: "Continue", exact: true });
    if ((await pendingInfo.count()) > 0) await pendingInfo.click();
    await expect(
      page.getByRole("radio", { name: (answers.runtime[0] as { name: string }).name, exact: true }),
    ).toBeVisible();
    await walk(page, answers.runtime, runtimePlayer);
    // A terminal advance already ended the lesson; otherwise finish it here.
    const heading = page.getByRole("heading", { name: "Lesson complete", exact: true });
    if ((await heading.count()) === 0) {
      await page.getByRole("button", { name: "Finish lesson", exact: true }).click();
    }
    await expect(heading).toBeVisible();
    await page.getByRole("button", { name: "Back to lessons", exact: true }).click();
    await expect(
      page.getByRole("navigation", { name: "Course path" }),
    ).toBeVisible();
  } else {
    await walk(page, answers.legacy, legacyPlayer);
    await expect(
      page.getByRole("heading", { name: /— done\.$/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Back to course", exact: true }).click();
  }
}

// French runs the v2 player since the 2026-09-10 migration, so the step list is
// the runtime one. Both engines consume the same authored order (the v1→v2
// adapter preserves it), which is why one list describes both — but `legacy` is
// now unreachable for French and is left empty rather than kept as a stale copy.
// Step 3 is a `predict` step: the v2 player gates it behind the think-first
// pause (see tests/thinking-lesson.spec.ts), so the walk clears that gate before
// typing. `walk` clears it for the legacy player only, hence the explicit click.
export async function completeFrenchL0(page: Page) {
  await page.goto("/courses/french");
  await completeLesson(page, {
    title: "First words",
    legacy: [],
    runtime: [
      { kind: "choice", name: "Hello." },
      { kind: "text", text: "Bonjour.", think: true },
      {
        kind: "choice",
        name: "French and English share thousands of words from Latin.",
      },
      { kind: "text", text: "Thank you." },
      { kind: "text", text: "Bonjour." },
      { kind: "text", text: "Three times." },
      { kind: "text", text: "Bonjour, merci." },
    ],
  });
}

export async function completeItalianL0(page: Page) {
  if (page.url().includes("/courses/")) await page.goto("/courses/italian");
  await completeLesson(page, {
    title: "First words",
    legacy: [],
    runtime: [
      { kind: "choice", name: "Hello." },
      { kind: "text", text: "Ciao." },
      {
        kind: "choice",
        name: "Italian and English share thousands of words from Latin.",
      },
      { kind: "text", text: "Thank you." },
      { kind: "text", text: "Ciao." },
      { kind: "text", text: "Three times." },
      { kind: "text", text: "Ciao, grazie." },
    ],
  });
}

/** Complete Names and introductions (lesson 1) on the v2 course already on
 * screen. Reaching its optional listening step requires the whole lesson. */
export async function completeItalianL1(page: Page) {
  const isRuntime = await isRuntimePlayer(page, "Names and introductions");
  if (isRuntime) {
    // The lesson may open on an information step or straight on the first
    // practice step; dismiss the info step only if it is actually showing.
    const pendingInfo = page.getByRole("button", { name: "Continue", exact: true });
    if ((await pendingInfo.count()) > 0) await pendingInfo.click();
    await expect(page.getByRole("radio", { name: "sono", exact: true })).toBeVisible();
    await walk(
      page,
      [
        { kind: "choice", name: "sono" },
        { kind: "text", text: "I am Italian (a woman)." },
        { kind: "order", words: ["Sono", "italiana."] },
        // Cloze: "Complete: Io ___ Anna." — the only answer is "sono".
        { kind: "text", text: "sono" },
        { kind: "text", text: "Io sono Anna." },
        { kind: "text", text: "Anna" },
      ],
      runtimePlayer,
    );
  }
  // Leave the optional listening step open: callers assert the audio there.
}
