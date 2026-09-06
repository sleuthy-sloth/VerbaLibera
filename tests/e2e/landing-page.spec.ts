import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

for (const width of [390, 768, 1440, 1920]) {
  test(`landing is accessible and fits ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Stop guessing. Start building sentences.');
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished)));
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
    const violations = await page.evaluate(async () => {
      const axe = (window as unknown as { axe: { run: (context: string, options: object) => Promise<{ violations: { id: string; nodes: { html: string }[] }[] }> } }).axe;
      return (await axe.run('[data-landing-page]', { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] })).violations;
    });
    expect(violations).toEqual([]);
    for (const image of await page.locator('[data-landing-page] img').all()) {
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    }
  });
}

test('mobile menu supports keyboard, Escape, and section navigation', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const menu = page.locator('button[aria-controls="landing-menu"]');
  await menu.focus();
  await page.keyboard.press('Enter');
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  // Safari uses Option-Tab to include links in keyboard navigation.
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'How it works' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(menu).toBeFocused();
  await menu.click();
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Courses', exact: true }).click();
  await expect(page).toHaveURL(/#courses$/);
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
});

test('demo, audio and CTAs connect the public page to real learning', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('I would like a table.').fill('Je voudrais une table.');
  await page.getByRole('button', { name: 'Reveal model answer' }).click();
  await expect(page.locator('#landing-model')).toBeVisible();
  const audio = page.getByLabel('French model pronunciation');
  await audio.evaluate(async (el: HTMLAudioElement) => { await el.play(); el.pause(); });
  await page.getByLabel('Playback speed').selectOption('0.8');
  expect(await audio.evaluate((el: HTMLAudioElement) => el.playbackRate)).toBe(0.8);
  await page.getByRole('link', { name: 'Explore French' }).click();
  await expect(page.getByRole('heading', { name: 'French foundations', exact: true })).toBeVisible();
  await page.goto('/');
  await page.getByRole('link', { name: 'Explore Italian' }).click();
  await expect(page.getByRole('heading', { name: 'Italian foundations', exact: true })).toBeVisible();
  await page.goto('/');
  await page.getByRole('link', { name: 'Start learning', exact: true }).first().click();
  await expect(page.getByRole('combobox', { name: 'Learning language' })).toBeVisible();
});

test('reduced motion keeps all content visible and old course bookmarks work', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('a polite “I would like”', { exact: true })).toBeVisible();
  await page.goto('/?course=english-to-italian');
  await expect(page).toHaveURL(/\/dashboard\?course=english-to-italian$/);
  await expect(page.getByRole('combobox', { name: 'Learning language' })).toHaveValue('english-to-italian');
});
