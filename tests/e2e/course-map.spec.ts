import { expect, test } from "@playwright/test";

/**
 * The course map on the study-plan page.
 *
 * `/learn/<course>/plan` is the one progress surface that describes a route through
 * the course rather than a list of what is unlocked (the shells' course path marks
 * up-next, complete and locked rows in words and tokens), so it is where the map
 * went. This opens it as a guest — the page renders the map before anyone signs in —
 * and checks the two things a picture on a page can get wrong: that it arrives, and
 * that it does not break the column it sits in.
 */
test("the plan page shows the course map, at its own size", async ({ page }) => {
  await page.goto("/learn/english-to-french/plan");
  await expect(page.getByRole("heading", { name: /study plan/i })).toBeVisible();

  const map = page.locator('img[src="/images/course-map.jpg"]');
  await expect(map).toBeVisible();
  // Decorative: the heading names the course and the checklist below is the route.
  await expect(map, "the course map is not decorative").toHaveAttribute("alt", "");
  // Declared at the file's own 800x537, so the row reserves its space before the
  // picture arrives rather than shifting the checklist down when it loads.
  await expect(map).toHaveAttribute("width", "800");
  await expect(map).toHaveAttribute("height", "537");
  await expect
    .poll(() => map.evaluate((img: HTMLImageElement) => img.naturalWidth), { timeout: 15000 })
    .toBeGreaterThan(0);
  await expect
    .poll(() =>
      map.evaluate((img: HTMLImageElement) => {
        const box = img.getBoundingClientRect();
        return Math.abs(box.width / box.height - img.naturalWidth / img.naturalHeight);
      }),
    )
    .toBeLessThan(0.02);
});

test("the map does not break the phone column", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/learn/english-to-french/plan");
  await expect(page.getByRole("heading", { name: /study plan/i })).toBeVisible();
  const map = page.locator('img[src="/images/course-map.jpg"]');
  await expect(map).toBeVisible();
  await expect
    .poll(() => map.evaluate((img: HTMLImageElement) => img.naturalWidth), { timeout: 15000 })
    .toBeGreaterThan(0);
  const widths = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(Math.max(widths.body, widths.document)).toBeLessThanOrEqual(widths.viewport);
});
