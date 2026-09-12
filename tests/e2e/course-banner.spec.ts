import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * The course banner, at the widths the brief names.
 *
 * Two defects are pinned here. The first: the v2 course shell rendered no banner
 * at all, so French, Italian and German showed no artwork on their own course
 * page while the library kept showing the same file. The second: at phone widths
 * the whole 4:1 frame is an ~70-85px strip and the drawing in it is illegible —
 * worst on German, whose artwork fills 56% of the frame. Narrow viewports now
 * crop to the measured window (`scripts/brand/banner-crops.py`); the desktop
 * frame is untouched.
 *
 * The expected ratios come from the generated crop data, so this cannot drift
 * from the measurement the component consumes.
 */

const crops = JSON.parse(
  readFileSync(join(process.cwd(), "src/features/course-pack/banner-crops.json"), "utf8"),
) as { courses: Record<string, { cropAspect: number }>; fullAspect: number };

const NARROW = [320, 390, 430] as const;
const DESKTOP = 1280;

const measured = (page: Page) =>
  page.evaluate(() => {
    const img = document.querySelector<HTMLImageElement>("img.course-banner");
    if (!img) return null;
    const box = img.getBoundingClientRect();
    return {
      src: img.getAttribute("src") ?? "",
      alt: img.getAttribute("alt"),
      naturalWidth: img.naturalWidth,
      ratio: box.width / box.height,
      height: box.height,
    };
  });

/** The banner, present and decoded, or a clear failure about which part is missing. */
async function bannerOn(page: Page, label: string) {
  await page.waitForSelector("img.course-banner", { timeout: 20_000 });
  // A crop defect on an image that never decoded would look exactly like this
  // test passing, so decoding is asserted before anything about the geometry.
  await expect
    .poll(async () => (await measured(page))?.naturalWidth ?? 0, { timeout: 20_000 })
    .toBeGreaterThan(0);
  const banner = await measured(page);
  expect(banner, `${label}: banner vanished`).not.toBeNull();
  return banner!;
}

test.describe("the course banner on the course page", () => {
  for (const language of ["german", "french", "spanish"]) {
    test(`${language}: renders, decodes, and crops deliberately at phone widths`, async ({
      page,
    }) => {
      const expectedCrop = crops.courses[language].cropAspect;

      for (const width of NARROW) {
        await page.setViewportSize({ width, height: 844 });
        await page.goto(`/courses/${language}`);
        const banner = await bannerOn(page, `${language} @${width}`);

        expect(banner.src, `${language} @${width}`).toContain(`/brand/courses/${language}.jpg`);
        expect(banner.alt, "the banner is decorative; the heading names the course").toBe("");

        // Narrow viewports use the measured window, not the full 4:1 frame.
        expect(banner.ratio, `${language} @${width}: ratio`).toBeCloseTo(expectedCrop, 1);
        // And the drawing is bigger for it: the uncropped frame inside the same
        // column would be shorter than this.
        const column = width - 2 * Math.max(20, Math.min(64, width * 0.05));
        const uncropped = column / crops.fullAspect;
        expect(banner.height, `${language} @${width}: no better than the strip`).toBeGreaterThan(
          uncropped + 8,
        );

        // The crop must not push the page sideways.
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth + 1,
        );
        expect(overflow, `${language} @${width}: horizontal overflow`).toBe(false);
      }
    });
  }

  test("desktop keeps the full frame, which is already legible there", async ({ page }) => {
    await page.setViewportSize({ width: DESKTOP, height: 900 });
    for (const language of ["german", "spanish"]) {
      await page.goto(`/courses/${language}`);
      const banner = await bannerOn(page, `${language} desktop`);
      expect(banner.ratio, `${language} desktop: the frame was reapportioned`).toBeCloseTo(
        crops.fullAspect,
        1,
      );
    }
  });

  test("the course library keeps every card at the frame ratio", async ({ page }) => {
    // The gallery is a column of cards: per-card crop heights would make the list
    // ragged, so the library keeps the full frame deliberately and the hero is
    // the only surface that crops.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/courses");
    await page.waitForSelector("img[src*='brand%2Fcourses']", { timeout: 20_000 });
    const cardRatios = () =>
      page.evaluate(() =>
        [...document.querySelectorAll<HTMLImageElement>("img")]
          .filter((img) => img.getAttribute("src")?.includes("brand%2Fcourses"))
          .filter((img) => img.naturalWidth > 0)
          .map((img) => {
            const box = img.getBoundingClientRect();
            return { ratio: box.width / box.height };
          }),
      );
    await expect.poll(async () => (await cardRatios()).length, { timeout: 20_000 }).toBe(5);
    for (const card of await cardRatios())
      expect(card.ratio, "a library card is not at the frame ratio").toBeCloseTo(
        crops.fullAspect,
        1,
      );
  });
});
