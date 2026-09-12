import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";

/**
 * Answers the v2 lesson player from the pack's own manifest.
 *
 * Every answer comes out of `courses/<language>/manifest.json` — never from a
 * guess about what the prompt looks like. A guessed answer costs a 30s timeout
 * per step and reads like a selector bug, and a wrong answer stalls the walk on
 * the same step forever (the primary control stays `Check` until the step is
 * complete), which is exactly how the first version of this walk behaved.
 */

export type PackActivity = {
  id: string;
  kind: string;
  prompt?: string;
  options?: { id: string; text: string }[];
  acceptedIds?: string[];
  blanks?: Record<string, { answers: string[] }>;
  tokens?: { id: string; text: string }[];
  acceptedOrders?: string[][];
  answer?: { answers: string[] };
};

export function loadPack(language: string): { activities: PackActivity[]; lessons: { id: string; title: string }[] } {
  const pack = JSON.parse(readFileSync(`courses/${language}/manifest.json`, "utf8"));
  return { activities: pack.activities as PackActivity[], lessons: pack.lessons as { id: string; title: string }[] };
}

/** The prompt of the step on screen, which is how a step is identified. */
export async function currentPrompt(page: Page): Promise<string> {
  const prompt = page.locator(".lp-prompt").first();
  if ((await prompt.count()) === 0) return "";
  return ((await prompt.textContent()) ?? "").trim();
}

export async function currentProgress(page: Page): Promise<string> {
  const count = page.locator(".lp-count").first();
  if ((await count.count()) === 0) return "";
  return ((await count.textContent()) ?? "").trim();
}

export function activityForPrompt(activities: PackActivity[], prompt: string): PackActivity | undefined {
  return activities.find((activity) => (activity.prompt ?? "").trim() === prompt);
}

async function pickRadio(page: Page, text: string): Promise<boolean> {
  const byName = page.getByRole("radio", { name: text, exact: true }).first();
  if ((await byName.count()) > 0) {
    await byName.check();
    return true;
  }
  const label = page.locator(".lp-option", { hasText: text }).first();
  if ((await label.count()) > 0) {
    await label.click();
    return true;
  }
  return false;
}

/**
 * Fills in a correct response for the step on screen. Returns a short note about
 * what it did, for the audit log; throws nothing, because a step it cannot
 * identify is a finding worth seeing rather than a reason to abort the walk.
 */
export async function answerStep(page: Page, activities: PackActivity[]): Promise<string> {
  const prompt = await currentPrompt(page);
  const activity = activityForPrompt(activities, prompt);

  // The media/self-compare steps have no gradeable answer: skip them the way the
  // product offers.
  const skip = page.getByRole("button", { name: "Skip this step", exact: true });
  if ((await skip.count()) > 0 && (await skip.isVisible())) {
    await skip.click();
    return "skipped the speaking step";
  }

  if (!activity) {
    const fallback = page.getByRole("radio").first();
    if ((await fallback.count()) > 0 && (await fallback.isVisible())) {
      await fallback.check();
      return "unidentified step: first radio";
    }
    return "unidentified step: nothing answered";
  }

  switch (activity.kind) {
    case "selection":
    case "dialogue-choice": {
      const accepted = activity.acceptedIds ?? [];
      for (const id of accepted) {
        const option = activity.options?.find((candidate) => candidate.id === id);
        if (option && (await pickRadio(page, option.text))) return `${activity.kind}: ${option.text}`;
      }
      return `${activity.kind}: no accepted option found in the DOM`;
    }
    case "cloze": {
      const blanks = Object.entries(activity.blanks ?? {});
      const inputs = page.locator("input.lp-blank");
      for (let index = 0; index < blanks.length; index += 1) {
        const [, spec] = blanks[index];
        await inputs.nth(index).fill(spec.answers[0] ?? "");
      }
      return `cloze: ${blanks.map(([, spec]) => spec.answers[0]).join(", ")}`;
    }
    case "ordering": {
      const order = activity.acceptedOrders?.[0] ?? [];
      const tokens = activity.tokens ?? [];
      for (const tokenId of order) {
        const token = tokens.find((candidate) => candidate.id === tokenId);
        if (!token) continue;
        const add = page.getByRole("button", { name: new RegExp(`^Add ${escapeRegExp(token.text)}`) }).first();
        if ((await add.count()) > 0) await add.click();
      }
      return `ordering: ${order.map((id) => tokens.find((t) => t.id === id)?.text).join(" ")}`;
    }
    case "text":
    case "translate": {
      const answer = activity.answer?.answers?.[0] ?? "";
      const field = page.locator("textarea.lp-textarea, .lp-text-response textarea").first();
      if ((await field.count()) > 0) {
        await field.fill(answer);
        return `text: ${answer}`;
      }
      return "text: no field found";
    }
    case "information":
      return "information step";
    default: {
      const field = page.locator("textarea.lp-textarea").first();
      if ((await field.count()) > 0) {
        await field.fill(activity.answer?.answers?.[0] ?? "");
        return `${activity.kind}: typed the answer`;
      }
      return `${activity.kind}: unhandled`;
    }
  }
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The action control for the current state, by the player's own labels. */
export async function primaryAction(page: Page): Promise<{ label: string; click: () => Promise<void> } | null> {
  // count() does not auto-wait, so scanning a page that has streamed its shell
  // but not its controls reports "no action" and the walk stops on step one.
  await page
    .locator("button", { hasText: /^(Begin practice|Check|Continue|Next step|Finish lesson|Finish)$/ })
    .first()
    .waitFor({ state: "attached", timeout: 8000 })
    .catch(() => {});
  for (const label of ["Begin practice", "Check", "Continue", "Next step", "Finish lesson", "Finish"]) {
    const button = page.getByRole("button", { name: label, exact: true }).first();
    if ((await button.count()) === 0) continue;
    if (!(await button.isVisible().catch(() => false))) continue;
    if (await button.isDisabled().catch(() => false)) continue;
    return {
      label,
      click: async () => {
        await button.evaluate((node) => node.scrollIntoView({ block: "center" }));
        await button.click();
      },
    };
  }
  return null;
}

/**
 * Walks one lesson to its end. `onState` is called with every screen the learner
 * reaches — presented, answered and graded — which is where the audit hooks in.
 *
 * The loop earns its keep on one detail: a graded step renders `Check` DISABLED
 * until a valid response exists, so "no action available" means "answer this
 * step", not "the lesson is over". Reading it the other way walked exactly one
 * step of an eight-step lesson and reported success.
 */
export async function walkLesson(
  page: Page,
  activities: PackActivity[],
  onState: (note: { phase: string; progress: string; prompt: string; action: string }) => Promise<void>,
  maxSteps = 26,
) {
  let previous = "";
  for (let index = 0; index < maxSteps; index += 1) {
    // The recap is the end of the lesson, not a step with no control: the player
    // renders `.lp-complete` and drops the progress counter.
    if ((await page.locator(".lp-complete").count()) > 0) {
      await onState({ phase: "complete", progress: "", prompt: "", action: "recap" });
      return { completed: true, progress: "", prompt: "", note: "reached the recap" };
    }
    const progress = await currentProgress(page);
    const prompt = await currentPrompt(page);

    let action = await primaryAction(page);
    let answered = "";
    if (!action) {
      answered = await answerStep(page, activities);
      action = await primaryAction(page);
    }

    await onState({
      phase: answered ? "answered" : "presented",
      progress,
      prompt,
      action: answered ? `${answered} -> ${action?.label ?? "nothing"}` : (action?.label ?? "none"),
    });

    if (!action) {
      await onState({ phase: "stuck", progress, prompt, action: "no enabled control" });
      return { completed: false, progress, prompt, note: "no enabled control" };
    }

    const isCheck = action.label === "Check";
    await action.click();
    await page.waitForTimeout(130);

    if (isCheck) {
      await onState({ phase: "graded", progress, prompt, action: "after Check" });
      const next = await primaryAction(page);
      if (!next || next.label === "Check") {
        return { completed: false, progress, prompt, note: "the step did not complete after Check" };
      }
      await next.click();
      await page.waitForTimeout(130);
    }

    const after = await currentProgress(page);
    if (previous && after === "" && progress === "") break;
    previous = progress;
    if (after === "" && currentPromptIsEmpty(prompt)) break;
  }
  return { completed: true, progress: await currentProgress(page), prompt: await currentPrompt(page), note: "" };
}

const currentPromptIsEmpty = (prompt: string) => prompt === "";

/** Opens a lesson on the course path. The caller unlocks it first by walking earlier lessons. */
export async function openLesson(page: Page, language: string, title: string) {
  await page.goto(`/courses/${language}`, { waitUntil: "load" });
  const button = page.getByRole("button", { name: title, exact: true }).first();
  await expect(button).toBeEnabled({ timeout: 15_000 });
  await button.click();
  // Auto-waiting, not count(): the lesson intro streams in, and a count() taken
  // too early reports zero controls and quietly leaves the walk on the intro.
  const begin = page.getByRole("button", { name: "Begin practice", exact: true }).first();
  await expect(begin).toBeVisible({ timeout: 15_000 });
  await begin.evaluate((node) => node.scrollIntoView({ block: "center" }));
  await begin.click();
  await expect(page.locator(".lp-prompt").first()).toBeVisible({ timeout: 15_000 });
}
