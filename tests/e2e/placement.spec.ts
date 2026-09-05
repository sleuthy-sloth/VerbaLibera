import { test, expect } from '@playwright/test';

test('French placement quiz walks 15 items and reports a band', async ({ page }) => {
  await page.goto('/learn/english-to-french/placement');

  await expect(page.getByText(/placement · 1 of 15/i)).toBeVisible();

  for (let index = 0; index < 15; index++) {
    const radios = page.getByRole('radio');
    if ((await radios.count()) > 0) {
      await radios.first().check();
    } else {
      const blank = page.getByLabel(/blank 1/i);
      const typed = page.getByLabel(/your answer/i);
      if ((await blank.count()) > 0) {
        await blank.fill('test');
      } else {
        await typed.fill('test');
      }
    }
    if (index < 14) {
      await page.getByRole('button', { name: 'Continue' }).click();
    }
  }

  await page.getByRole('button', { name: 'See my result' }).click();
  await expect(page.getByText(/placement result/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /start learning/i })).toHaveAttribute(
    'href',
    /^\/learn\/english-to-french\?concept=fr-/,
  );
});

test('dashboard links to the placement quiz', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('link', { name: /take the 3-minute placement quiz/i }),
  ).toHaveAttribute('href', /\/learn\/.*\/placement/);
});

test('Italian placement checks available beginner patterns', async ({ page }) => {
  await page.goto('/learn/english-to-italian/placement');
  await expect(page.getByText(/placement · 1 of 8/i)).toBeVisible();
});
