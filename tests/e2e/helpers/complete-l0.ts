import { expect, type Page } from "@playwright/test";

// Completes French L0 ("First words") guest practice end to end, starting
// from the /courses/french lesson list, and returns to the lesson list.
// L1 practice is prerequisite-gated behind L0, so French walks that touch
// "Names and introductions" must run this first.
export async function completeFrenchL0(page: Page) {
  await page
    .getByRole("button", { name: "First words", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Begin practice", exact: true })
    .click();
  const check = async () => {
    await page
      .getByRole("button", { name: "Check answer", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("correct");
    await page
      .getByRole("button", { name: "Save and continue", exact: true })
      .click();
  };
  const choose = async (name: string) => {
    await page.getByRole("radio", { name, exact: true }).check();
    await check();
  };
  const type = async (text: string, thinkFirst: boolean) => {
    if (thinkFirst)
      await page
        .getByRole("button", { name: /i've thought about it/i })
        .click();
    await page.getByLabel("Your answer", { exact: true }).fill(text);
    await check();
  };
  await choose("Hello.");
  await type("Bonjour.", true);
  await choose("French and English share thousands of words from Latin.");
  await type("Thank you.", false);
  await type("Bonjour.", false);
  await type("Three times.", false);
  await type("Bonjour, merci.", false);
  await expect(
    page.getByRole("heading", { name: "Practice complete", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Back to course", exact: true })
    .click();
}
