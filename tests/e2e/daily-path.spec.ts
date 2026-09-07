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
  await page.goto('/dashboard');

  await assertNoHorizontalOverflow(page);

  await page.getByRole('combobox', { name: 'Learning language' }).selectOption('english-to-italian');

  // Beginner entry is the foundation course from Lesson 0.
  const startLink = page.getByRole('link', { name: 'Start learning', exact: true });
  await expect(startLink).toBeVisible();
  await startLink.click();

  await expect(page).toHaveURL(/\/courses\/italian\?start=1/);
  await expect(page.getByRole('heading', { name: 'First words' })).toBeVisible();

  await assertNoHorizontalOverflow(page);
});

test('French beginner entry opens Lesson 0', async ({ page }) => {
  await page.goto('/dashboard');

  const startLink = page.getByRole('link', { name: 'Start learning', exact: true });
  await expect(startLink).toBeVisible();
  await startLink.click();

  await expect(page).toHaveURL(/\/courses\/french\?start=1/);
  await expect(page.getByRole('heading', { name: 'First words' })).toBeVisible();

  await assertNoHorizontalOverflow(page);
});
