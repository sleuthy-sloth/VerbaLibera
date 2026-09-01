import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

async function assertNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.body.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(
    overflow.scrollWidth,
    `body scrollWidth (${overflow.scrollWidth}) should not exceed viewport width (${overflow.innerWidth})`,
  ).toBeLessThanOrEqual(overflow.innerWidth);
}

test('Daily Path works on a narrow mobile viewport', async ({ page }) => {
  await page.goto('/');

  const sessionLink = page.getByRole('link', { name: /continue 8-minute session/i });
  await expect(sessionLink).toBeVisible();

  await page.getByRole('button', { name: /switch to italian/i }).click();

  // After switching courses, the same CTA re-renders pointing at the Italian route.
  const italianSessionLink = page.getByRole('link', { name: /continue 8-minute session/i });
  await expect(italianSessionLink).toBeVisible();
  await italianSessionLink.click();

  // Deviation from plan doc:
  // (i) The plan doc asserted /today's practice path/i, but that copy is stale.
  //     The Italian preview has no guided session steps by design, so the honest
  //     fallback heading rendered by GuidedSession is used instead.
  // (ii) This is read-only snapshot honesty: demoProgress.session only contains
  //      French steps, so the english-to-italian route intentionally falls back.
  await expect(
    page.getByRole('heading', { level: 1, name: /no guided steps are ready for this course preview/i }),
  ).toBeVisible();

  await assertNoHorizontalOverflow(page);
});

test('French session path renders the guided practice heading', async ({ page }) => {
  await page.goto('/');

  const sessionLink = page.getByRole('link', { name: /continue 8-minute session/i });
  await expect(sessionLink).toBeVisible();
  await sessionLink.click();

  await expect(
    page.getByRole('heading', { level: 1, name: /practice one useful pattern/i }),
  ).toBeVisible();

  await assertNoHorizontalOverflow(page);
});
