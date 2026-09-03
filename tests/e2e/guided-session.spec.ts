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
  await page.getByRole('button', { name: 'English to Italian: A1 patterns' }).click();
  await page.getByRole('link', { name: /continue 8-minute session/i }).click();

  await expect(page).toHaveURL(/\/learn\/english-to-italian$/);
  await expect(page.getByRole('button', { name: /reveal model answer/i })).toBeVisible();
  await page.getByRole('button', { name: /reveal model answer/i }).click();
  await expect(page.getByText('Vorrei un caffè, per favore.')).toBeVisible();
});

test('typed exact answer is checked without any sidecar', async ({ page }) => {
  await page.goto('/learn/english-to-french');
  await page.getByRole('button', { name: 'Continue' }).click();

  const answer = page.getByLabel('Your answer');
  await answer.fill('Je voudrais un thé, s’il vous plaît.');
  await page.getByRole('button', { name: 'Check my answer' }).click();

  await expect(page.getByText('That matches an accepted answer.')).toBeVisible();
  await expect(page.getByText('Checked locally. Nothing was saved.')).toBeVisible();
});

test('picture drill offers four CC0 photos and accepts the coffee tap', async ({ page }) => {
  await page.goto('/learn/english-to-french');
  // Walk review + two text drills via reveal/self-check/continue.
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: /reveal model answer/i }).click();
    await page.getByRole('button', { name: /i checked my answer/i }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
  }

  await expect(page.getByRole('radiogroup', { name: /picture choices/i })).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(4);
  await expect(page.getByRole('radio', { name: 'A cup of coffee' })).toBeVisible();

  await page.getByRole('radio', { name: 'A cup of coffee' }).click();
  await expect(page.getByText('That is the right picture.')).toBeVisible();

  const coffee = await page.request.get('/images/vocab/coffee.jpg');
  expect(coffee.ok()).toBe(true);
  expect(coffee.headers()['content-type']).toContain('image/jpeg');
});

test.describe('mobile touch', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('picture choices are tappable on a mobile viewport', async ({ page }) => {
    await page.goto('/learn/english-to-italian');
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: /reveal model answer/i }).click();
      await page.getByRole('button', { name: /i checked my answer/i }).click();
      await page.getByRole('button', { name: 'Continue' }).click();
    }

    const coffee = page.getByRole('radio', { name: 'A cup of coffee' });
    await expect(coffee).toBeVisible();
    const box = await coffee.boundingBox();
    // 44px minimum touch target (WCAG 2.5.8).
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
    await coffee.tap();
    await expect(page.getByText('That is the right picture.')).toBeVisible();

    // Bottom tabs are reachable by touch on mobile.
    await page.getByRole('link', { name: 'Spanish lessons' }).tap();
    await expect(page).toHaveURL(/\/learn\/english-to-spanish$/);
  });
});

test('non-exact answers honestly report limited local checking', async ({ page }) => {
  await page.goto('/learn/english-to-french');
  await page.getByRole('button', { name: 'Continue' }).click();

  const answer = page.getByLabel('Your answer');
  await answer.fill('Je voudrais un thé tout de suite, s’il vous plaît.');
  await page.getByRole('button', { name: 'Check my answer' }).click();

  await expect(
    page.getByText('Local checking is unavailable right now — compare with the model answer.'),
  ).toBeVisible();
  await expect(page.getByText('Checked locally. Nothing was saved.')).toHaveCount(0);
});

test('French pilot serves both WAVs while reveal and self-check remain reachable', async ({ page }) => {
  // Break caught: the lesson renders an audio control for asset URLs that were
  // never generated, or audio playback replaces the independent text path.
  for (const path of [
    '/audio/french-ordering/fr-ordering-politely-prompt.wav',
    '/audio/french-ordering/fr-ordering-politely-answer.wav',
  ]) {
    const response = await page.request.get(path);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('audio/wav');
    const wav = await response.body();
    expect(wav.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(wav.subarray(8, 12).toString('ascii')).toBe('WAVE');
  }

  await page.goto('/learn/english-to-french');
  await expect(page.getByRole('region', { name: /lesson audio player/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /start lesson/i })).toBeVisible();

  await page.getByRole('button', { name: /reveal model answer/i }).click();
  await expect(page.getByText('Je voudrais un café, s’il vous plaît.')).toBeVisible();
  await page.getByRole('button', { name: /i checked my answer/i }).click();
  await expect(page.getByText(/this is a preview—nothing was saved/i)).toBeVisible();
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
    'Step 2 of 6',
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
