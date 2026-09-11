import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Scrolls a control to the middle of the viewport before clicking it.
 *
 * On a phone the app's floating bottom tabs own the last ~84px of the screen, so
 * a control that lands there is only partly tappable and a centre-click hits the
 * tabs instead of the button. That is an app-wide layout characteristic, not
 * something the first-win sequence introduced, but any test tapping near the
 * bottom of a 390px page has to account for it.
 */
export async function tap(page: Page, locator: Locator) {
  await locator.evaluate((node) => node.scrollIntoView({ block: "center" }));
  await locator.click();
}

/**
 * Walks the short first-win sequence (roadmap 1B) up to its recap.
 *
 * `language` picks the words the sequence uses; the steps are the same for both
 * authored languages, which is the point of the shared shape: meet, recognise,
 * build, say, recap.
 */
export async function walkFirstWin(page: Page, language: "Italian" | "French") {
  await expect(page.getByText("Step 1 of 5")).toBeVisible();
  await tap(page, page.getByRole("button", { name: "Continue", exact: true }));
  // Recognise: the meaning of the phrase the learner just met.
  const meaning = language === "Italian" ? "Hi — and bye." : "Hello.";
  await page.getByRole("radio", { name: meaning, exact: true }).check();
  await tap(page, page.getByRole("button", { name: "Check", exact: true }));
  await expect(page.getByRole("status")).toBeVisible();
  await tap(page, page.getByRole("button", { name: "Continue", exact: true }));
  // Build: two words in order, with the third token left over.
  const tokens = language === "Italian" ? ["Ciao,", "grazie."] : ["Bonjour,", "merci."];
  for (const token of tokens)
    await tap(page, page.getByRole("button", { name: token, exact: true }));
  await tap(page, page.getByRole("button", { name: "Check", exact: true }));
  await expect(page.getByRole("status")).toBeVisible();
  await tap(page, page.getByRole("button", { name: "Continue", exact: true }));
  // Say it out loud: skippable, and never blocked on a microphone.
  await expect(page.getByText("Step 4 of 5")).toBeVisible();
  await tap(page, page.getByRole("button", { name: "Skip this step", exact: true }));
  await expect(page.getByText("Step 5 of 5")).toBeVisible();
}
