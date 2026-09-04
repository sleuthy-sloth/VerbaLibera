import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

async function assertNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth),
    innerWidth: window.innerWidth,
  }));
  expect(
    overflow.scrollWidth,
    `body scrollWidth (${overflow.scrollWidth}) should not exceed viewport width (${overflow.innerWidth})`,
  ).toBeLessThanOrEqual(overflow.innerWidth);
}

test('Daily Path works on a narrow mobile viewport', async ({ page }) => {
  await page.goto('/');

  await assertNoHorizontalOverflow(page);

  const sessionLink = page.getByRole('link', { name: /continue 8-minute session/i });
  await expect(sessionLink).toBeVisible();

  await page.getByRole('button', { name: 'English to Italian: A1 patterns' }).click();

  // After switching courses, the same CTA re-renders pointing at the Italian route.
  const italianSessionLink = page.getByRole('link', { name: /continue 8-minute session/i });
  await expect(italianSessionLink).toBeVisible();
  await italianSessionLink.click();

  // Step 1 teaches the greeting up front: model shown, nothing to reveal yet.
  await expect(page.getByRole('heading', { level: 2, name: /greeting politely/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /reveal model answer/i })).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 2 reviews ordering through reveal.
  await expect(page.getByText(/ordering coffee or food/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /reveal model answer/i })).toBeVisible();

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
