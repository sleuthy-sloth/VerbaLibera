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
 *
 * The capability and resumption cases below came out of the Phase 1 review: the
 * flow used to promise a placement quiz for every language whether or not an
 * assessment existed, never wrote a completion record, and restarted at the
 * language screen for anyone who left halfway.
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

  test('an experienced French learner reaches the authored placement quiz', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'load' });
    await page.getByRole('radio', { name: /French/ }).check();
    await page.getByRole('button', { name: /Continue with French/ }).click();
    await page.getByRole('button', { name: /I know some already/ }).click();

    await page.waitForURL(/\/learn\/english-to-french\/placement/);
  });

  test('a language without an authored assessment is offered a preview, never a quiz', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'load' });
    await page.getByRole('radio', { name: /Spanish/ }).check();
    await page.getByRole('button', { name: /Continue with Spanish/ }).click();

    // The placement card is not offered at all — the alternative is truthful.
    await expect(page.getByRole('button', { name: /I know some already/ })).toHaveCount(0);
    await page.getByRole('button', { name: /Show me the course first/ }).click();

    await page.waitForURL(/\/courses\/spanish$/);
    await expect(page.url()).not.toContain('/placement');
  });

  test('Back returns to language selection without losing the choice', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'load' });
    await page.getByRole('radio', { name: /Portuguese/ }).check();
    await page.getByRole('button', { name: /Continue with Portuguese/ }).click();
    await page.getByRole('button', { name: /Back/ }).click();

    await expect(page.getByRole('radio', { name: /Portuguese/ })).toBeChecked();
  });

  test('browsing languages does not overwrite the saved course before Continue', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('verbalibera_course', 'english-to-italian');
    });
    await page.goto('/dashboard', { waitUntil: 'load' });
    await page.getByRole('radio', { name: /Spanish/ }).check();
    expect(await page.evaluate(() => window.localStorage.getItem('verbalibera_course'))).toBe(
      'english-to-italian',
    );
    await page.getByRole('button', { name: /Continue with Spanish/ }).click();
    expect(await page.evaluate(() => window.localStorage.getItem('verbalibera_course'))).toBe(
      'english-to-spanish',
    );
  });

  test('a refresh mid-flow resumes on the starting-point screen', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'load' });
    await page.getByRole('radio', { name: /Italian/ }).check();
    await page.getByRole('button', { name: /Continue with Italian/ }).click();
    await expect(page.getByRole('heading', { name: /Where should we start\?/ })).toBeVisible();

    await page.reload({ waitUntil: 'load' });
    // Not the language screen again: the choice was made and is remembered.
    await expect(page.getByRole('heading', { name: /Where should we start\?/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /What would you like to speak first\?/ })).toHaveCount(0);
  });

  test('the decision writes a completion record', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'load' });
    await page.getByRole('radio', { name: /Italian/ }).check();
    await page.getByRole('button', { name: /Continue with Italian/ }).click();
    await page.getByRole('button', { name: /Start from the beginning/ }).click();
    await page.waitForURL(/\/courses\/italian\?start=1/);

    const stored = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem('verbalibera_onboarding:v1') ?? 'null'),
    );
    expect(stored).toMatchObject({
      version: 1,
      courseSlug: 'english-to-italian',
      status: 'completed',
      entryIntent: 'beginner',
    });
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

  test('an unreadable saved choice is explained rather than silently re-asked', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('verbalibera_onboarding:v1', 'not json');
    });
    await page.goto('/dashboard', { waitUntil: 'load' });
    await expect(
      page.getByRole('heading', { name: /What would you like to speak first\?/ }),
    ).toBeVisible();
    await expect(page.getByText(/could not read a saved choice/i)).toBeVisible();
  });
});
