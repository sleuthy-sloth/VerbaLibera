import { test, expect } from '@playwright/test';

async function assertNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const widths = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(Math.max(widths.body, widths.document)).toBeLessThanOrEqual(widths.viewport);
}

async function assertActionWithinViewport(
  page: import('@playwright/test').Page,
  action: import('@playwright/test').Locator,
) {
  await action.scrollIntoViewIfNeeded();
  const box = await action.boundingBox();
  const viewport = page.viewportSize();

  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
}

test('Italian travel session is available after course selection', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /switch to italian/i }).click();
  await page.getByRole('link', { name: /continue 8-minute session/i }).click();

  await expect(page).toHaveURL(/\/learn\/english-to-italian$/);
  await expect(page.getByRole('button', { name: /reveal model answer/i })).toBeVisible();
  await page.getByRole('button', { name: /reveal model answer/i }).click();
  await expect(page.getByText('Vorrei un caffè, per favore.')).toBeVisible();
});

test('mobile sticky action stays in view through reveal, self-check, and continue', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/learn/english-to-french');

  const reveal = page.getByRole('button', { name: /reveal model answer/i });
  await assertActionWithinViewport(page, reveal);
  expect(await reveal.evaluate((element) => getComputedStyle(element.parentElement!).position)).toBe('sticky');

  await reveal.click();
  const selfCheck = page.getByRole('button', { name: /i checked my answer/i });
  await assertActionWithinViewport(page, selfCheck);
  await selfCheck.click();

  const continueAction = page.getByRole('button', { name: 'Continue' });
  await assertActionWithinViewport(page, continueAction);
  await continueAction.click();

  await expect(page.getByRole('progressbar', { name: /session progress/i })).toHaveAttribute(
    'aria-valuetext',
    'Step 2 of 4',
  );
  await expect(page.getByRole('button', { name: /reveal model answer/i })).toBeVisible();
  await assertNoHorizontalOverflow(page);
});

test('desktop lesson keeps its context rail beside the content without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/learn/english-to-french');

  const contextRail = page.getByRole('complementary', { name: /lesson context/i });
  const lessonHeading = page.getByRole('heading', {
    level: 2,
    name: /French: ordering politely/i,
  });
  await expect(contextRail).toBeVisible();
  await expect(lessonHeading).toBeVisible();

  const contextBox = await contextRail.boundingBox();
  const headingBox = await lessonHeading.boundingBox();
  expect(contextBox).not.toBeNull();
  expect(headingBox).not.toBeNull();
  expect(contextBox!.x + contextBox!.width).toBeLessThanOrEqual(headingBox!.x);
  expect(contextBox!.height).toBeGreaterThan(headingBox!.height);

  const reveal = page.getByRole('button', { name: /reveal model answer/i });
  expect(await reveal.evaluate((element) => getComputedStyle(element.parentElement!).position)).toBe('static');
  await expect(page.getByText('Je voudrais un café, s’il vous plaît.')).toBeHidden();
  await reveal.click();
  await expect(page.getByText('Je voudrais un café, s’il vous plaît.')).toBeVisible();
  await assertNoHorizontalOverflow(page);
});
