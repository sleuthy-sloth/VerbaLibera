import { test, expect } from '@playwright/test';

test('signed-out visitors get an honest blank slate', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Preview progress')).toBeVisible();
  // No fiction progress: guests get onboarding, never a continue link.
  await expect(
    page.getByRole('link', { name: /continue 8-minute session/i }),
  ).toHaveCount(0);
  await page.getByRole('link', { name: /start 8-minute session/i }).click();
  await expect(page).toHaveURL(/\/learn\//);
  await expect(page.getByText('This is a preview—nothing was saved.')).toBeVisible().catch(() => {});
});

test('account entry offers real passkey registration and sign-in', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Save your progress' }).click();
  await expect(page.getByRole('heading', { name: /sign in to verbalibera/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create passkey', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in with passkey', exact: true })).toBeVisible();
});
