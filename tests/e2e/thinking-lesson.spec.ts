import { test, expect } from "@playwright/test";
import { completeFrenchL0 } from "./helpers/complete-l0";

// Thinking Method pins. French is the pilot and now runs the v2 player, so these
// assert the migrated pack rather than the legacy one: the word-first opener, the
// bridge from what the learner already knows, and the think-first pause that the
// v1→v2 adapter has to carry across (`think` → a `predict` step).

const OUTCOME = '[role="status"][data-outcome]';

test("French L1 opens with a bridge, then a think-first prediction", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/courses/french");
  await expect(
    page.getByRole("heading", { name: "French foundations", exact: true }),
  ).toBeVisible();
  // L1 practice is prerequisite-gated behind L0: complete first words first.
  await completeFrenchL0(page);
  await page
    .getByRole("button", { name: "Names and introductions", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Begin practice", exact: true })
    .click();
  // The lesson opens on its notice step (the rule from L0, restated).
  await expect(page.getByText(/the rule you just discovered/i)).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  // Step 1: bridge from what the learner already knows (keeps the day-zero pin).
  await expect(page.getByText(/you already know the name anna/i)).toBeVisible();
  await page.getByRole("radio", { name: "suis", exact: true }).check();
  await page.getByRole("button", { name: "Check", exact: true }).click();
  // Pin the outcome state rather than the wording: the learner-facing
  // acknowledgement rotates, and the grader's category is no longer shown.
  await expect(page.locator(OUTCOME).first()).toHaveAttribute(
    "data-outcome",
    "correct",
  );
  await page.getByRole("button", { name: /^(Next step|Continue)$/ }).click();
  // Step 2: prediction — no input until the learner commits to thinking.
  await expect(page.getByText(/how does he say/i)).toBeVisible();
  await expect(page.getByText(/think first/i)).toBeVisible();
  expect(await page.getByLabel("Your answer").count()).toBe(0);
  await page
    .getByRole("button", { name: /i've thought about it/i })
    .click();
  await page.getByLabel("Your answer").fill("Je suis Marc.");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.locator(OUTCOME).first()).toHaveAttribute(
    "data-outcome",
    "correct",
  );
});

test("French L0 starts with single words before any sentence", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/courses/french");
  await page
    .getByRole("button", { name: "First words", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Begin practice", exact: true })
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  // Step 1: meet-word bridge from zero — one greeting, four options. The prompt
  // asks the learner to produce nothing.
  await expect(page.getByText(/opens almost every conversation/i)).toBeVisible();
  await page.getByRole("radio", { name: "Hello.", exact: true }).check();
  await page.getByRole("button", { name: "Check", exact: true }).click();
  // Pin the outcome state rather than the wording: the learner-facing
  // acknowledgement rotates, and the grader's category is no longer shown.
  await expect(page.locator(OUTCOME).first()).toHaveAttribute(
    "data-outcome",
    "correct",
  );
  await page.getByRole("button", { name: /^(Next step|Continue)$/ }).click();
  // Step 2: think-first production of a single word, never a sentence.
  await expect(page.getByText(/think first/i)).toBeVisible();
  expect(await page.getByLabel("Your answer").count()).toBe(0);
  await page
    .getByRole("button", { name: /i've thought about it/i })
    .click();
  await page.getByLabel("Your answer").fill("Bonjour.");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.locator(OUTCOME).first()).toHaveAttribute(
    "data-outcome",
    "correct",
  );
});

test("a prediction keeps full credit when its gate is cleared", async ({
  page,
}) => {
  // The gate is a commitment, not assistance: clearing it must not mark the
  // attempt assisted, or every migrated `think` step would silently stop
  // counting as independent recall.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/courses/french");
  await page
    .getByRole("button", { name: "First words", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Begin practice", exact: true })
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("radio", { name: "Hello.", exact: true }).check();
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await page.getByRole("button", { name: /^(Next step|Continue)$/ }).click();
  await page
    .getByRole("button", { name: /i've thought about it/i })
    .click();
  await page.getByLabel("Your answer").fill("Bonjour.");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.locator(OUTCOME).first()).toHaveAttribute(
    "data-outcome",
    "correct",
  );
  // Nothing about the step counts as "used the answer".
  await expect(page.getByText(/used the answer on this step/i)).toHaveCount(0);
});
