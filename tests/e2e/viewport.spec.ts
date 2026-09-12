import { test, expect, type Page } from '@playwright/test';

/**
 * The viewport half of `docs/device-qa-checklist.md`, on a desktop engine.
 *
 * A phone-width Chromium window is not an iPhone: it has no home indicator, no
 * notch, no real touch, and no Safari. What it *can* settle is everything the
 * checklist would otherwise be the first thing to notice — that no phone-width
 * layout overflows sideways, that the floating tab capsule stays inside the
 * screen at every phone size, that the controls a thumb has to hit are still
 * thumb-sized, and that landscape hands navigation back to the header.
 *
 * The rest of the checklist is a person with a phone. This file says which parts
 * are already covered so the device pass does not spend its time on them.
 */

/** Phone sizes worth naming: the smallest in use, a current iPhone, a large one. */
const PORTRAIT = [
  { width: 320, height: 568, label: 'small phone' },
  { width: 390, height: 844, label: 'iPhone 14/15' },
  { width: 430, height: 932, label: 'iPhone Pro Max' },
] as const;

/** The same phone turned sideways, where the width crosses the desktop breakpoint. */
const LANDSCAPE = { width: 844, height: 390 } as const;

const ROUTES = ['/dashboard', '/courses', '/courses/german', '/learn/english-to-french', '/listen'] as const;

/**
 * The floating capsule is one of two `Primary` navigations in the DOM: the header
 * owns the other at desktop widths. `:visible` is Playwright's own selector
 * extension, which is what makes this deterministic instead of a `.first()`/
 * `.last()` guess.
 */
const visiblePrimaryNav = (page: Page) => page.locator('nav[aria-label="Primary"]:visible');

/**
 * A learner who has already chosen, so the dashboard shows the daily path rather
 * than the welcome flow. Seeded for every navigation, because the flow is what a
 * blank dashboard renders — and a blank dashboard has no primary action to
 * measure.
 */
async function seedChosenLearner(page: Page, courseSlug = 'french') {
  await page.addInitScript((slug: string) => {
    window.localStorage.setItem(
      'verbalibera_onboarding:v1',
      JSON.stringify({ version: 1, courseSlug: slug, status: 'completed', entryIntent: 'beginner' }),
    );
    window.localStorage.setItem('verbalibera_course', slug);
  }, courseSlug);
}

async function overflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

test.describe('phone viewports', () => {
  for (const size of PORTRAIT) {
    test(`nothing overflows and the tab capsule stays on screen at ${size.width}x${size.height} (${size.label})`, async ({
      page,
    }) => {
      await seedChosenLearner(page);
      await page.setViewportSize({ width: size.width, height: size.height });
      for (const route of ROUTES) {
        await page.goto(route, { waitUntil: 'load' });
        expect(await overflow(page), `${route} overflows sideways at ${size.width}px`).toBeLessThanOrEqual(0);

        const capsule = visiblePrimaryNav(page);
        await expect(capsule, `${route} has no floating navigation at ${size.width}px`).toBeVisible();
        const box = (await capsule.boundingBox())!;
        // Inside the viewport on both sides, and clear of the bottom edge — this is
        // the gap the home indicator occupies once viewport-fit is cover.
        expect(box.x, `${route}: tab capsule past the left edge`).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, `${route}: tab capsule past the right edge`).toBeLessThanOrEqual(size.width + 0.5);
        expect(
          size.height - (box.y + box.height),
          `${route}: tab capsule is flush with the bottom edge`,
        ).toBeGreaterThanOrEqual(10);
      }
    });
  }

  test('the controls a thumb has to hit are thumb-sized at 390px', async ({ page }) => {
    await seedChosenLearner(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dashboard', { waitUntil: 'load' });

    const capsule = visiblePrimaryNav(page);
    await expect(capsule).toBeVisible();
    const tabLinks = capsule.locator('a');
    const count = await tabLinks.count();
    expect(count, 'the floating navigation should have its four tabs').toBeGreaterThanOrEqual(4);
    for (let index = 0; index < count; index += 1) {
      const box = (await tabLinks.nth(index).boundingBox())!;
      expect(box.height, `tab ${index} is shorter than a thumb`).toBeGreaterThanOrEqual(44);
      expect(box.width, `tab ${index} is narrower than a thumb`).toBeGreaterThanOrEqual(44);
    }

    // A guest who has chosen but practised nothing gets the first-words card, so
    // its action is the one to measure; the wider pattern covers the states a
    // returning learner lands in.
    const action = page
      .getByRole('link', { name: /start learning|continue today.s lesson|Open .* foundations/i })
      .first();
    const actionBox = (await action.boundingBox())!;
    expect(actionBox.height, 'the primary action is shorter than a thumb').toBeGreaterThanOrEqual(44);

    const switcher = page.getByRole('combobox', { name: 'Learning language' });
    const switcherBox = (await switcher.boundingBox())!;
    expect(switcherBox.height, 'the language switcher is shorter than a thumb').toBeGreaterThanOrEqual(44);
  });

  test('landscape hands navigation back to the header', async ({ page }) => {
    // A phone on its side is 844px wide, past the 768px breakpoint where the
    // floating capsule is desktop-hidden. The header navigation is what a thumb
    // gets instead, so it has to be there rather than the layout simply losing
    // its navigation.
    await seedChosenLearner(page);
    await page.setViewportSize(LANDSCAPE);
    for (const route of ROUTES) {
      await page.goto(route, { waitUntil: 'load' });
      expect(await overflow(page), `${route} overflows sideways in landscape`).toBeLessThanOrEqual(0);
      const header = page.locator('header nav[aria-label="Primary"]');
      await expect(header, `${route} has no header navigation in landscape`).toBeVisible();
      const box = (await header.boundingBox())!;
      expect(box.y, `${route}: navigation is off the top of the screen`).toBeGreaterThanOrEqual(0);
      expect(box.y, `${route}: navigation sits at the bottom edge in landscape`).toBeLessThan(LANDSCAPE.height / 2);
    }
  });

  test('the first-run block keeps its action clear of the tab capsule at 320px', async ({ page }) => {
    // The narrowest phone in use, with a learner who has chosen but practised
    // nothing: the block the welcome flow leaves behind is the surface most
    // likely to sit under the floating tabs.
    await seedChosenLearner(page);
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/dashboard', { waitUntil: 'load' });

    const block = page.getByTestId('first-run-onboarding');
    await expect(block).toBeVisible();
    const action = block.getByRole('link', { name: /start learning/i });
    const actionBox = (await action.boundingBox())!;
    expect(actionBox.height).toBeGreaterThanOrEqual(44);

    const capsule = visiblePrimaryNav(page);
    const capsuleBox = (await capsule.boundingBox())!;
    // Scrolling to the end of the document must be able to bring the action clear
    // of the capsule: a floating bar overlaps content by design, but nothing may
    // be permanently unreachable behind it.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(150);
    const after = (await action.boundingBox())!;
    expect(
      Math.round(after.y + after.height),
      'the first-run action cannot be scrolled clear of the tab capsule',
    ).toBeLessThanOrEqual(Math.round(capsuleBox.y));
  });
});
