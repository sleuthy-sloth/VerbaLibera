import { test, expect } from '@playwright/test';

test('signed-out visitors get an honest blank slate', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByText('Saved in this browser')).toBeVisible();
  // No fiction progress: guests get onboarding, never a continue link.
  await expect(
    page.getByRole('link', { name: /continue today.s lesson/i }),
  ).toHaveCount(0);
  // A learner who has never chosen a language picks one first; the welcome flow
  // opens the course and lands directly in Lesson 0.
  await page.getByRole('radio', { name: /French/ }).check();
  await page.getByRole('button', { name: /Continue with French/ }).click();
  await page.getByRole('button', { name: /Start from the beginning/ }).click();
  await expect(page).toHaveURL(/\/courses\/french\?start=1/);
  await expect(page.getByRole("heading", { name: "First words", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Begin practice" })).toBeEnabled();
});

test('account entry offers real passkey registration and sign-in', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByRole('link', { name: 'Keep this on my account' }).click();
  await expect(page.getByRole('heading', { name: /sign in to verbalibera/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create passkey', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in with passkey', exact: true })).toBeVisible();
});
