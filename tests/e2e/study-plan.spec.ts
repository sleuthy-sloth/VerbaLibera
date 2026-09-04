import { test, expect } from '@playwright/test';

test('study plan builder saves and shows the week overview', async ({ page }) => {
  await page.goto('/learn/english-to-french/plan');

  await expect(page.getByText(/build your plan/i)).toBeVisible();
  await expect(page.getByText(/plan items/i)).toBeVisible();

  await page.getByRole('button', { name: /save my plan/i }).click();

  await expect(page.getByText(/week 1 of/i)).toBeVisible();
  await expect(page.getByText(/items done/i)).toBeVisible();
  await expect(page.getByText(/still being authored/i)).toBeVisible();

  const first = page.getByRole('checkbox').first();
  await first.check();
  await expect(first).toBeChecked();
  await page.reload();
  await expect(page.getByRole('checkbox').first()).toBeChecked();
});
