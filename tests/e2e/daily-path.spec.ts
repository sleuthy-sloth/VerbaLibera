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

  // A first-time learner chooses a language and a starting point; the flow then
  // hands them to the foundation course at Lesson 0. The Italian course renders
  // the v2 runtime path, so `?start=1` opens the lesson itself.
  await page.getByRole('radio', { name: /Italian/ }).check();
  await page.getByRole('button', { name: /Continue with Italian/ }).click();
  await page.getByRole('button', { name: /Start from the beginning/ }).click();

  await expect(page).toHaveURL(/\/courses\/italian\?start=1/);
  await expect(page.getByRole('heading', { name: 'First words' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Begin practice', exact: true })).toBeEnabled();
  // The lesson shell is the only surface: no course chrome above the lesson.
  await expect(page.getByRole('navigation', { name: 'Course path' })).toHaveCount(0);

  await assertNoHorizontalOverflow(page);
});

test('French beginner entry opens Lesson 0', async ({ page }) => {
  await page.goto('/dashboard');

  await page.getByRole('radio', { name: /French/ }).check();
  await page.getByRole('button', { name: /Continue with French/ }).click();
  await page.getByRole('button', { name: /Start from the beginning/ }).click();

  await expect(page).toHaveURL(/\/courses\/french\?start=1/);
  await expect(page.getByRole('heading', { name: 'First words' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Begin practice', exact: true })).toBeEnabled();

  await assertNoHorizontalOverflow(page);
});
