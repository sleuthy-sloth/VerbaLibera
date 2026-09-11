import { expect, test } from '@playwright/test';
import { tap, walkFirstWin } from './helpers/first-win';

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

  test('a beginner picks Italian, gets the short first win, then lands in the course', async ({ page }) => {
    // The 390px viewport the pilot targets, and a keyboard-only path through it.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dashboard', { waitUntil: 'load' });
    await page.getByRole('radio', { name: /Italian/ }).check();
    await page.getByRole('button', { name: /Continue with Italian/ }).click();

    await expect(page.getByRole('heading', { name: /Where should we start\?/ })).toBeVisible();
    await page.getByRole('button', { name: /Start from the beginning/ }).click();

    await walkFirstWin(page, 'Italian');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await tap(page, page.getByRole("button", { name: "Start lesson 1", exact: true }));

    await page.waitForURL(/\/courses\/italian\?start=1/);
    // `?start=1` opens the lesson in the lesson shell: one lesson, one way out.
    // It used to scroll a 3,000px course page and leave the learner below the
    // account panel with no sticky context.
    await expect(page.getByRole('button', { name: /Back to the course/ })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Course path' })).toHaveCount(0);
  });

  test('the first win is preparation: it writes no practice at all', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'load' });
    await page.getByRole('radio', { name: /French/ }).check();
    await page.getByRole('button', { name: /Continue with French/ }).click();
    await page.getByRole('button', { name: /Start from the beginning/ }).click();
    await walkFirstWin(page, 'French');
    // The recap says so in words, and the storage agrees: the sequence is not a
    // lesson, so no practice, attempt or completion is recorded for the course.
    await expect(page.getByText('Step 5 of 5')).toBeVisible();
    await expect(page.getByText(/nothing here counts as finished/i)).toBeVisible();
    const keys = await page.evaluate(() => Object.keys(window.localStorage));
    expect(keys.filter((key) => key.includes('practice') || key.includes('lesson'))).toEqual([]);
    await tap(page, page.getByRole("button", { name: "Start lesson 1", exact: true }));
    await page.waitForURL(/\/courses\/french\?start=1/);
    // Still nothing: landing in the lesson is not practising it.
    const after = await page.evaluate(() => Object.keys(window.localStorage));
    expect(after.filter((key) => key.includes('practice') || key.includes('lesson'))).toEqual([]);
  });

  test('a first win left half-finished resumes where it stopped', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'load' });
    await page.getByRole('radio', { name: /Italian/ }).check();
    await page.getByRole('button', { name: /Continue with Italian/ }).click();
    await page.getByRole('button', { name: /Start from the beginning/ }).click();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByText('Step 2 of 5')).toBeVisible();

    await page.reload({ waitUntil: 'load' });
    // Not the language screen, and not completed either: the sequence reopens.
    await expect(page.getByText('Step 1 of 5')).toBeVisible();
    const stored = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem('verbalibera_onboarding:v1') ?? 'null'),
    );
    expect(stored).toMatchObject({ status: 'welcome-in-progress', entryIntent: 'beginner' });
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

  test('the decision writes a completion record, and only once the first win ends', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'load' });
    await page.getByRole('radio', { name: /Italian/ }).check();
    await page.getByRole('button', { name: /Continue with Italian/ }).click();
    await page.getByRole('button', { name: /Start from the beginning/ }).click();
    // Mid-sequence the record says "under way", not "finished".
    const begun = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem('verbalibera_onboarding:v1') ?? 'null'),
    );
    expect(begun).toMatchObject({ status: 'welcome-in-progress', entryIntent: 'beginner' });

    await walkFirstWin(page, 'Italian');
    await tap(page, page.getByRole("button", { name: "Start lesson 1", exact: true }));
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

test.describe('first win with the sound off', () => {
  // The pilot's muted-audio condition. The service worker is blocked so that
  // aborting the audio route actually reaches the player: the PWA precaches pack
  // audio, and a worker-served response is not a page-level route.
  test.use({ serviceWorkers: 'block' });

  test('carries a learner through a recording that cannot load', async ({ page }) => {
    await page.route('**/audio/**', (route) => route.abort());
    await page.goto('/dashboard', { waitUntil: 'load' });
    await page.getByRole('radio', { name: /Italian/ }).check();
    await page.getByRole('button', { name: /Continue with Italian/ }).click();
    await page.getByRole('button', { name: /Start from the beginning/ }).click();

    // Nothing autoplays, and the words are on screen as text from the start.
    await expect(page.getByText('Ciao', { exact: true })).toBeVisible();
    await page.getByText('Show the words').click();
    await expect(page.getByText('Ciao, grazie.', { exact: true })).toBeVisible();
    await tap(page, page.getByRole('button', { name: 'Play the recording', exact: true }));
    await expect(page.getByText(/the sound did not load/i)).toBeVisible();
    // And the sequence still finishes: a broken clip is not a broken lesson.
    await walkFirstWin(page, 'Italian');
  });
});
