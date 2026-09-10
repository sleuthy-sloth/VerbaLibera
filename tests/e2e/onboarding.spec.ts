import { expect, test } from '@playwright/test';

/**
 * First-run flow.
 *
 * `src/components/onboarding/WelcomeFlow.tsx` and
 * `src/features/onboarding/state.ts` were built and unit-tested against
 * `docs/superpowers/plans/2026-09-09-approachable-first-learning-experience.md`,
 * but nothing imported the component: a first-time learner was dropped straight
 * onto a French course page — account panel, download panel, PWA instructions and
 * twenty-four "Locked" rows above the first word. These specs are the missing
 * end-to-end coverage from that plan.
 */

test.describe('first run', () => {
  test('a new learner chooses a language instead of inheriting a default course', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'load' });
    await expect(
      page.getByRole('heading', { name: /What would you like to speak first\?/ }),
    ).toBeVisible();
    // No course is preselected until the learner chooses one.
    await expect(page.getByRole('button', { name: /Continue with your language/ })).toBeDisabled();
  });

  test('a beginner picks Italian and lands in Italian foundations', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'load' });
    await page.getByRole('radio', { name: /Italian/ }).check();
    await page.getByRole('button', { name: /Continue with Italian/ }).click();

    await expect(page.getByRole('heading', { name: /Where should we start\?/ })).toBeVisible();
    await page.getByRole('button', { name: /Start from the beginning/ }).click();

    await page.waitForURL(/\/courses\/italian\?start=1/);
    // `?start=1` opens the lesson in the lesson shell: one lesson, one way out.
    // It used to scroll a 3,000px course page and leave the learner below the
    // account panel with no sticky context.
    await expect(page.getByRole('button', { name: /Back to the course/ })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Course path' })).toHaveCount(0);
  });

  test('an experienced learner reaches the placement quiz for the language they chose', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'load' });
    await page.getByRole('radio', { name: /Spanish/ }).check();
    await page.getByRole('button', { name: /Continue with Spanish/ }).click();
    await page.getByRole('button', { name: /I know some already/ }).click();

    await page.waitForURL(/\/learn\/english-to-spanish\/placement/);
  });

  test('Back returns to language selection without losing the choice', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'load' });
    await page.getByRole('radio', { name: /Portuguese/ }).check();
    await page.getByRole('button', { name: /Continue with Portuguese/ }).click();
    await page.getByRole('button', { name: /Back/ }).click();

    await expect(page.getByRole('radio', { name: /Portuguese/ })).toBeChecked();
  });

  test('a learner who already chose a language is not asked again', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'verbalibera_onboarding:v1',
        JSON.stringify({
          version: 1,
          courseSlug: 'english-to-french',
          status: 'completed',
          entryIntent: 'beginner',
        }),
      );
    });
    await page.goto('/dashboard', { waitUntil: 'load' });
    await expect(page.getByRole('heading', { name: /What would you like to speak first\?/ })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Start with your first words/ })).toBeVisible();
  });
});
