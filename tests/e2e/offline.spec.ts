import { test, expect } from '@playwright/test';

test('offline navigation shows a reconnect page and never cached account HTML', async ({ page, context }) => {
  await page.goto('/learn/english-to-french');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.goto('/learn/english-to-french', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Your practice path is waiting.' })).toBeVisible();
  const cachedPages = await page.evaluate(async () => {
    const keys = await caches.keys();
    const requests = (await Promise.all(keys.map(async key => (await caches.open(key)).keys()))).flat();
    return requests.map(request => new URL(request.url).pathname).filter(path => path.startsWith('/learn/') || path.startsWith('/api/'));
  });
  expect(cachedPages).toEqual([]);
  expect(await page.evaluate(async () => { try { await fetch('/api/demo/progress'); return false; } catch { return true; } })).toBe(true);
  await context.setOffline(false);
});

test('downloaded v2 language can be opened from the PWA offline welcome page', async ({ page, context }) => {
  await page.goto('/courses/italian#offline-download');
  await page.getByRole('button', { name: 'Download for offline study', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open offline study' })).toBeVisible({ timeout: 30000 });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Your practice path is waiting.' })).toBeVisible();
  await page.getByRole('link', { name: 'Italian' }).click();
  await expect(page.getByRole('heading', { name: 'Italian foundations', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Course path' })).toBeVisible();
  const firstLesson = page.getByRole('button', { name: 'First words', exact: true });
  await expect(firstLesson).toBeEnabled();
  await firstLesson.click();
  await page.getByRole('button', { name: 'Begin practice' }).click();
  // v2 lesson player opens offline; its model audio is part of the installed pack.
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'First words', exact: true })).toBeVisible();
});
