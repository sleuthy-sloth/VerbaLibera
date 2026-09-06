import { test, expect } from "@playwright/test";
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
