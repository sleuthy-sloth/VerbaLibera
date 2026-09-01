import { test, expect } from '@playwright/test';

test('Italian travel session is available after course selection', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /switch to italian/i }).click();
  await page.getByRole('link', { name: /continue 8-minute session/i }).click();

  await expect(page).toHaveURL(/\/learn\/english-to-italian$/);
  await expect(page.getByRole('button', { name: /reveal model answer/i })).toBeVisible();
  await page.getByRole('button', { name: /reveal model answer/i }).click();
  await expect(page.getByText('Vorrei un caffè, per favore.')).toBeVisible();
});

test('model answer requires deliberate reveal and remains usable on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/learn/english-to-french');

  await expect(page.getByText('Je voudrais un café, s’il vous plaît.')).toBeHidden();
  await page.getByRole('button', { name: /reveal model answer/i }).click();
  await expect(page.getByText('Je voudrais un café, s’il vous plaît.')).toBeVisible();
});
