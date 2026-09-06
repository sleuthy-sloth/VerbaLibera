import { test, expect } from "@playwright/test";
import { completeFrenchL0 } from "./helpers/complete-l0";
// Thinking Method pilot (French L1): discovery-first — bridge choice, then a
// think step gated behind "think first" before any input is shown.
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
  // Step 1: bridge from what the learner already knows (keeps the day-zero pin).
  await expect(page.getByText(/you already know the name anna/i)).toBeVisible();
  await page.getByRole("radio", { name: "suis", exact: true }).check();
  await page.getByRole("button", { name: "Check answer", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("correct");
  await page
    .getByRole("button", { name: "Save and continue", exact: true })
    .click();
  // Step 2: think step — no input until the learner commits to thinking.
  await expect(page.getByText(/how does he say/i)).toBeVisible();
  await expect(page.getByText(/think first/i)).toBeVisible();
  expect(
    await page.getByLabel("Your answer").count(),
  ).toBe(0);
  await page
    .getByRole("button", { name: /i've thought about it/i })
    .click();
  await page.getByLabel("Your answer").fill("Je suis Marc.");
  await page.getByRole("button", { name: "Check answer", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("correct");
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
  // Step 1: meet-word bridge from zero — one greeting, four options.
  await expect(page.getByText(/opens almost every conversation/i)).toBeVisible();
  await page.getByRole("radio", { name: "Hello.", exact: true }).check();
  await page.getByRole("button", { name: "Check answer", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("correct");
  await page
    .getByRole("button", { name: "Save and continue", exact: true })
    .click();
  // Step 2: think-first production of a single word, never a sentence.
  await expect(page.getByText(/think first/i)).toBeVisible();
  expect(
    await page.getByLabel("Your answer").count(),
  ).toBe(0);
  await page
    .getByRole("button", { name: /i've thought about it/i })
    .click();
  await page.getByLabel("Your answer").fill("Bonjour.");
  await page.getByRole("button", { name: "Check answer", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("correct");
});
