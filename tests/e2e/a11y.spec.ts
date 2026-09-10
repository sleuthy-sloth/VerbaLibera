import { expect, test } from '@playwright/test';
import { createRequire } from 'node:module';

/**
 * Route-level accessibility gate.
 *
 * Two things this pins that the unit suite cannot:
 *
 * 1. Contrast on the *real* pages. `tests/a11y-session.test.tsx` used to set
 *    `'color-contrast': { enabled: false }`, which is why 102 failing nodes
 *    shipped across ten routes; the lesson-player axe tests only render
 *    fixtures whose muted ink passes. These routes are the ones that failed.
 * 2. That every app route offers the four primary destinations to a keyboard
 *    user at desktop width. The bottom capsule is `display: none` at >=768px,
 *    and before this spec nothing replaced it: `/listen` had five tab stops and
 *    no navigation at all.
 */

const require = createRequire(import.meta.url);
const AXE_PATH = require.resolve('axe-core/axe.min.js');

const ROUTES = [
  ['/', 'Home'],
  ['/dashboard', 'Today'],
  ['/courses', 'Courses'],
  ['/courses/italian', 'Course page (v2)'],
  ['/courses/french', 'Course page (v1)'],
  ['/listen', 'Listen'],
  ['/you', 'You'],
  ['/login', 'Sign in'],
] as const;

/** Routes that must expose Today / Courses / Listen / You in the tab order. */
const NAV_ROUTES = ROUTES.map(([route]) => route).filter((route) => route !== '/');

test.describe('accessibility', () => {
  for (const [route, label] of ROUTES) {
    test(`${label} (${route}) has no WCAG A/AA violations`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'load' });
      // Let deferred reads settle (the dashboard and the profile both load after paint).
      await page.waitForTimeout(1200);
      await page.addScriptTag({ path: AXE_PATH });
      const results = await page.evaluate(async () => {
        // @ts-expect-error axe is injected at runtime.
        return await window.axe.run(document, {
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
          },
        });
      });
      const summary = results.violations
        .map((violation: { id: string; impact: string; nodes: unknown[] }) => `${violation.id} (${violation.impact}) x${violation.nodes.length}`)
        .join('\n');
      expect(results.violations, summary).toHaveLength(0);
    });
  }
});

test.describe('desktop navigation', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  for (const route of NAV_ROUTES) {
    test(`${route} can reach Today, Courses, Listen and You`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'load' });
      // /dashboard renders client-side after its progress fetch, so the link set
      // is empty until the navigation landmark appears.
      await expect(page.getByRole('navigation', { name: 'Primary' }).first()).toBeVisible();
      // The requirement is that all four destinations are reachable by keyboard,
      // not that four identically labelled links exist: on /dashboard the current
      // page is the wordmark, and the account link is labelled for what it does.
      const hrefs = await page
        .getByRole('link')
        .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
      for (const destination of ['/dashboard', '/courses', '/listen', '/you']) {
        expect(hrefs, `${route} should offer a way to ${destination}`).toContain(destination);
      }
    });
  }

  test('every primary destination resolves to a page with content', async ({ page }) => {
    for (const [route] of ROUTES) {
      const response = await page.goto(route, { waitUntil: 'load' });
      expect(response?.status(), `${route} should not 404`).toBeLessThan(400);
      await expect(page.locator('main').first()).toBeVisible();
    }
  });
});

test.describe('route identity', () => {
  test('each route has its own document title', async ({ page }) => {
    const titles = new Set<string>();
    for (const [route] of ROUTES) {
      await page.goto(route, { waitUntil: 'load' });
      titles.add(await page.title());
    }
    // Previously every sub-page reported "VerbaLibera · Daily practice path".
    expect(titles.size).toBe(ROUTES.length);
  });

  test('an unknown route lands on the branded 404, not a bare stub', async ({ page }) => {
    for (const retired of ['/learn/french/plan', '/courses/french/bogus', '/courses/bogus/vocabulary']) {
      const response = await page.goto(retired, { waitUntil: 'load' });
      expect(response?.status(), `${retired} should be a real 404`).toBe(404);
      await expect(page.getByRole('heading', { name: /That page isn’t here\./ })).toBeVisible();
      await expect(page.getByRole('link', { name: /Browse courses/ })).toBeVisible();
    }
  });
});
