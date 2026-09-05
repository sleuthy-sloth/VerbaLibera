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
