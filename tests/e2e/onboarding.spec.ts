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

  test('German is offered here, and its preview path lands on its course page', async ({ page }) => {
    // What this whole change is for. German had a pack, a course page and a
    // catalogue entry, but the universe came from the travel fixture, which has
    // no German course — so the switcher and this flow never offered it.
    await page.goto('/dashboard', { waitUntil: 'load' });
    await page.getByRole('radio', { name: /German/ }).check();
    await page.getByRole('button', { name: /Continue with German/ }).click();

    // No authored assessment exists for German, so the alternative is the
    // honest one rather than a quiz whose result could not mean anything.
    await expect(page.getByRole('button', { name: /I know some already/ })).toHaveCount(0);
    await page.getByRole('button', { name: /Show me the course first/ }).click();

    await page.waitForURL(/\/courses\/german$/);
    await expect(page.getByRole('heading', { name: 'German foundations', exact: true })).toBeVisible();
    // And the choice was recorded under the canonical slug.
    expect(await page.evaluate(() => window.localStorage.getItem('verbalibera_course'))).toBe('german');
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
    // Choosing writes the canonical pack slug — the identity everything else in
    // the app is keyed by. The value seeded above stays in the older form, which
    // is what an existing learner holds.
    expect(await page.evaluate(() => window.localStorage.getItem('verbalibera_course'))).toBe(
      'spanish',
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
    // The completion record names the course by its canonical pack slug, which is
    // the identity the dashboard, the plans and the banners are keyed by. Older
    // records in the other form still read, which the alias case covers.
    expect(stored).toMatchObject({
      version: 1,
      courseSlug: 'italian',
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

/**
 * The blank learner's block, at the two widths the brief names.
 *
 * Reached the way a real learner reaches it: onboarding is finished, so no
 * language flow is due, and there is no practice yet — which is exactly the state
 * the block exists for. The measured properties are the ones the composition
 * complaint was about: the name is live text beside a 44px mark rather than a
 * raster lockup squeezed into the panel, the journal is a fraction of the block,
 * the copy is readable, and the one action can always be brought clear of the
 * floating tab bar.
 */
test.describe('the blank learner block', () => {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
  ]) {
    test(`holds together at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await page.evaluate(() => {
        // The shape `readOnboardingOutcome` validates, and a course that exists.
        localStorage.setItem(
          'verbalibera_onboarding:v1',
          JSON.stringify({
            version: 1,
            courseSlug: 'english-to-french',
            status: 'completed',
            entryIntent: 'beginner',
          }),
        );
        localStorage.setItem('verbalibera_course', 'english-to-french');
      });
      await page.goto('/dashboard');

      const block = page.getByTestId('first-run-onboarding');
      await expect(block).toBeVisible();

      // The brand: the app's own mark, and the name as text.
      await expect(block.getByText('VerbaLibera')).toBeVisible();
      await expect(block.locator('img[src*="logo-lockup"]')).toHaveCount(0);
      const mark = block.locator("img[src*='logo-mark']");
      const markBox = (await mark.boundingBox())!;
      expect(Math.round(markBox.width)).toBe(44);
      expect(Math.round(markBox.height)).toBe(44);

      // The illustration supports the copy rather than outweighing it.
      const journal = block.locator("img[src*='empty-journal']");
      await expect
        .poll(() => journal.evaluate((img: HTMLImageElement) => img.naturalWidth))
        .toBeGreaterThan(0);
      const journalBox = (await journal.boundingBox())!;
      const blockBox = (await block.boundingBox())!;
      expect(journalBox.width).toBeLessThan(blockBox.width * 0.45);
      expect(Math.abs(journalBox.width - journalBox.height)).toBeLessThan(4);

      // Readable copy and a thumb-sized action, at both widths.
      const copySize = await block
        .locator('p')
        .last()
        .evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
      expect(copySize).toBeGreaterThanOrEqual(16);
      const action = block.getByRole('link', { name: /start learning/i });
      const actionBox = (await action.boundingBox())!;
      expect(actionBox.height).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        viewport.width,
      );

      // The floating tab bar may pass over content while scrolling — that is what
      // a floating bar does — but the action has to be bringable fully clear of
      // it. Put it just above the bar and check nothing overlaps.
      const tabBarTop = await page.evaluate(() => {
        const bar = [...document.querySelectorAll('nav, div')].find((node) => {
          const style = getComputedStyle(node);
          const box = node.getBoundingClientRect();
          return (
            style.position === 'fixed' &&
            box.height < 140 &&
            box.top > innerHeight * 0.5 &&
            /today/i.test(node.textContent ?? '') &&
            /courses/i.test(node.textContent ?? '')
          );
        });
        return bar ? bar.getBoundingClientRect().top : null;
      });
      expect(tabBarTop, 'the bottom tab bar was not found').not.toBeNull();
      await page.evaluate((barTop) => {
        const element = document.querySelector("[data-testid='first-run-onboarding'] a")!;
        window.scrollBy(0, element.getBoundingClientRect().bottom - barTop + 12);
      }, tabBarTop!);
      await page.waitForTimeout(250);
      const cleared = await action.boundingBox();
      expect(cleared, 'the action left the document').not.toBeNull();
      expect(
        Math.round(cleared!.y + cleared!.height),
        'the action cannot be scrolled clear of the tab bar',
      ).toBeLessThanOrEqual(Math.round(tabBarTop!));
    });
  }
});
