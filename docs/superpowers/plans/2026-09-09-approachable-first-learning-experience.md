# Approachable First Learning Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give first-time learners an explicit language choice and a short, playful first success before they enter the existing course foundations.

**Architecture:** Introduce a client-side onboarding state machine ahead of the dashboard's blank-progress state. It reuses the current course catalog, local selected-course storage, placement route, activity primitives, and foundation deep links; it does not duplicate curriculum or change placement scoring. A new learner selects a language, chooses beginner or placement entry, completes a compact welcome activity if beginner, and then lands in the selected course's foundations.

**Tech Stack:** Next.js App Router, React, TypeScript, CSS modules, Vitest/Testing Library, Playwright.

**Spec:** Product direction captured in this plan: language selection is the first meaningful action; beginners receive a 2–3 minute first-win lesson; experienced learners can deliberately take the existing placement quiz; no hearts, timers, fake progress, or forced sign-in.

## Global Constraints

- Reuse `verbalibera_course` for selected course compatibility; use a versioned onboarding key for new flow state.
- Derive language labels and availability from existing course/catalog data; do not make unsupported availability claims.
- Keep French and Italian's structured-A1 distinction accurate, while welcoming learners to Spanish, Portuguese, and German's available first-words content.
- Preserve the existing `/learn/[courseSlug]/placement` route and scoring semantics.
- Respect keyboard navigation, visible focus, reduced motion, and non-audio fallback content.
- Do not alter curriculum content, progress calculation, account persistence, or gamification outside this scope.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/features/onboarding/state.ts` | Versioned local onboarding state, validation, read/write helpers, and next-route derivation. |
| `src/features/onboarding/languages.ts` | Presentation-safe language metadata derived from current course and foundation catalog data. |
| `src/components/onboarding/WelcomeFlow.tsx` | Three-screen client flow: select language, select starting point, beginner first win. |
| `src/components/onboarding/welcome-flow.module.css` | Responsive, accessible visual system for the onboarding flow. |
| `src/components/dashboard/FirstRunOnboarding.tsx` | Replaced or reduced to an onboarding-flow entry, rather than directly linking Lesson 0. |
| `src/components/dashboard/DailyPathDashboard.tsx` | Selects the welcome flow for truly new learners and keeps the returning dashboard focused. |
| `src/components/nav/LanguageSwitcher.tsx` | Remains the compact returning-learner language changer; shares selection persistence helper. |
| `tests/onboarding-state.test.ts` | Storage parsing, state transition, and route tests. |
| `tests/WelcomeFlow.test.tsx` | Language selection, starting-point choice, welcome activity, and fallback behavior. |
| `tests/DailyPathDashboard.test.tsx` | First-visit versus returning-user dashboard entry expectations. |
| `tests/e2e/onboarding.spec.ts` | Mobile and desktop critical journeys. |

## Task 1: Hermes — onboarding contract and catalog view model

**Files:**
- Create: `src/features/onboarding/state.ts`
- Create: `src/features/onboarding/languages.ts`
- Test: `tests/onboarding-state.test.ts`

**Consumes:** `initialCourses` from `src/features/curriculum/fixture.ts`, `foundationLanguage` and `foundationStartHref` from `src/features/course-pack/navigation.ts`.

**Produces:**

```ts
export type OnboardingStatus = 'unseen' | 'welcome-in-progress' | 'completed';
export type EntryIntent = 'beginner' | 'placement';
export type OnboardingState = Readonly<{
  version: 1;
  courseSlug: string;
  status: OnboardingStatus;
  entryIntent?: EntryIntent;
}>;

export function readOnboardingState(courses: readonly CourseSummary[]): OnboardingState | null;
export function saveOnboardingState(state: OnboardingState): void;
export function setSelectedCourse(courseSlug: string): void;
export function onboardingDestination(state: OnboardingState): string;
export function onboardingLanguages(courses: readonly CourseSummary[]): OnboardingLanguage[];
```

- [ ] **Step 1: Write failing storage and routing tests.**

```ts
it('accepts only a current available course from versioned onboarding storage', () => {
  localStorage.setItem('verbalibera_onboarding:v1', JSON.stringify({
    version: 1, courseSlug: 'english-to-italian', status: 'welcome-in-progress', entryIntent: 'beginner',
  }));
  expect(readOnboardingState(initialCourses)?.courseSlug).toBe('english-to-italian');
});

it('sends placement learners to the existing course placement route', () => {
  expect(onboardingDestination({ version: 1, courseSlug: 'english-to-german', status: 'welcome-in-progress', entryIntent: 'placement' }))
    .toBe('/learn/english-to-german/placement');
});
```

- [ ] **Step 2: Run the focused test and verify it fails.**

Run: `npm test -- tests/onboarding-state.test.ts`

Expected: FAIL because the onboarding module does not exist.

- [ ] **Step 3: Implement defensive local-state helpers.**

Use `try/catch` around browser storage exactly as `LanguageSwitcher` does. Invalid JSON, an old version, an unknown course, and server rendering must return `null`, never throw. `setSelectedCourse` writes the existing `verbalibera_course` key. `onboardingDestination` returns `/learn/<slug>/placement` only for `placement`; beginner state resolves through `foundationStartHref(courseSlug)`.

- [ ] **Step 4: Implement catalog-derived presentation metadata.**

Return language name, course slug, flag, availability label, and a short non-promissory benefit. Mark only French and Italian as `Structured A1 foundations`; label German, Spanish, and Portuguese `Start with first words`. Do not hard-code an index/default course.

- [ ] **Step 5: Run focused tests.**

Run: `npm test -- tests/onboarding-state.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the isolated contract.**

```bash
git add src/features/onboarding/state.ts src/features/onboarding/languages.ts tests/onboarding-state.test.ts
git commit -m "feat: add first-learning onboarding state"
```

## Task 2: Pompey route 1 — language-first welcome screen

**Files:**
- Create: `src/components/onboarding/WelcomeFlow.tsx`
- Create: `src/components/onboarding/welcome-flow.module.css`
- Test: `tests/WelcomeFlow.test.tsx`

**Consumes:** `onboardingLanguages`, `setSelectedCourse`, and `saveOnboardingState` from Task 1.

**Produces:**

```tsx
export function WelcomeFlow({
  courses,
  onComplete,
}: Readonly<{
  courses: readonly CourseSummary[];
  onComplete?: (destination: string) => void;
}>): JSX.Element;
```

- [ ] **Step 1: Write a failing interaction test.**

```tsx
render(<WelcomeFlow courses={initialCourses} onComplete={onComplete} />);
await user.click(screen.getByRole('radio', { name: /Italian/i }));
expect(screen.getByRole('button', { name: /continue with italian/i })).toBeEnabled();
await user.click(screen.getByRole('button', { name: /continue with italian/i }));
expect(screen.getByRole('heading', { name: /where should we start/i })).toBeInTheDocument();
```

- [ ] **Step 2: Run the focused test and verify it fails.**

Run: `npm test -- tests/WelcomeFlow.test.tsx`

Expected: FAIL because `WelcomeFlow` does not exist.

- [ ] **Step 3: Build the language-selection screen.**

Use an explicit labelled radio group headed “What would you like to speak first?” Each large card includes language name, flag, availability label, and benefit. The selected card has a clear non-colour-only state. Initial focus stays on the heading; cards are keyboard operable; the Continue button is disabled until a choice exists. No dashboard progress, sign-in CTA, download link, lesson index, or default language appears here.

- [ ] **Step 4: Build responsive styles.**

Mobile is one-column cards with a bottom-safe primary button; tablet/desktop can use a two-or-three-column grid. Meet the existing design language, preserve visible `:focus-visible`, and ensure `prefers-reduced-motion` removes entrance/selection transitions.

- [ ] **Step 5: Run focused tests.**

Run: `npm test -- tests/WelcomeFlow.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add src/components/onboarding/WelcomeFlow.tsx src/components/onboarding/welcome-flow.module.css tests/WelcomeFlow.test.tsx
git commit -m "feat: add language-first welcome flow"
```

## Task 3: Pompey route 2 — deliberate starting-point decision

**Files:**
- Modify: `src/components/onboarding/WelcomeFlow.tsx`
- Modify: `tests/WelcomeFlow.test.tsx`

**Consumes:** Task 1 state contract and Task 2 selected language.

**Produces:** a second screen that commits an `EntryIntent` and uses `onComplete(destination)` to navigate.

- [ ] **Step 1: Write failing branch tests.**

```tsx
await selectLanguage('english-to-spanish');
await user.click(screen.getByRole('button', { name: /continue with spanish/i }));
await user.click(screen.getByRole('button', { name: /i know some already/i }));
expect(onComplete).toHaveBeenCalledWith('/learn/english-to-spanish/placement');

await user.click(screen.getByRole('button', { name: /start from the beginning/i }));
expect(screen.getByRole('heading', { name: /your first spanish phrase/i })).toBeInTheDocument();
```

- [ ] **Step 2: Run the focused test and verify it fails.**

Run: `npm test -- tests/WelcomeFlow.test.tsx`

Expected: FAIL because the starting-point choice is absent.

- [ ] **Step 3: Implement two clear choices.**

Show “Start from the beginning” with “Recommended · a friendly 2-minute first phrase,” and “I know some already” with “Take a 3-minute placement quiz.” Include a Back button that returns to language selection without losing the selected course. Placement writes `welcome-in-progress` plus `placement`, then navigates through `onboardingDestination`.

- [ ] **Step 4: Verify focused tests.**

Run: `npm test -- tests/WelcomeFlow.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/components/onboarding/WelcomeFlow.tsx tests/WelcomeFlow.test.tsx
git commit -m "feat: let learners choose beginner or placement entry"
```

## Task 4: Pompey route 3 — compact first-win activity and foundations handoff

**Files:**
- Modify: `src/components/onboarding/WelcomeFlow.tsx`
- Modify: `src/components/onboarding/welcome-flow.module.css`
- Modify: `tests/WelcomeFlow.test.tsx`

**Consumes:** beginner state, language metadata, and `foundationStartHref`.

**Produces:** a three-to-four interaction welcome activity that completes onboarding and enters selected foundations.

- [ ] **Step 1: Write a failing success-path test.**

```tsx
await enterBeginnerFlow('english-to-italian');
expect(screen.getByText(/listen and choose/i)).toBeInTheDocument();
await user.click(screen.getByRole('button', { name: /ciao/i }));
await user.click(screen.getByRole('button', { name: /keep going: first words/i }));
expect(onComplete).toHaveBeenCalledWith('/courses/italian?start=1');
expect(readOnboardingState(initialCourses)?.status).toBe('completed');
```

- [ ] **Step 2: Run the focused test and verify it fails.**

Run: `npm test -- tests/WelcomeFlow.test.tsx`

Expected: FAIL because beginner onboarding has no activity or completion transition.

- [ ] **Step 3: Implement a small, language-aware first win.**

Use only content explicitly available for each language. The sequence must begin with recognition (image/text and optional audio), continue with a one-tap choice, then a one-step phrase selection/build, and finish with specific feedback such as “You just said hello in Italian.” Keep each action independently understandable; never block advancement on microphone permission or audio playback. If no audio asset is supplied, render the readable word and a “Sound will be available in the lesson” note.

- [ ] **Step 4: Implement completion safely.**

On the final action, write `{ status: 'completed', entryIntent: 'beginner' }`, retain `verbalibera_course`, then navigate to `foundationStartHref(courseSlug)`. The primary CTA must use human copy such as “Keep going: First words,” not “Open foundations.”

- [ ] **Step 5: Verify focused tests.**

Run: `npm test -- tests/WelcomeFlow.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add src/components/onboarding/WelcomeFlow.tsx src/components/onboarding/welcome-flow.module.css tests/WelcomeFlow.test.tsx
git commit -m "feat: add beginner first-win lesson"
```

## Task 5: Pompey route 4 — dashboard integration and returning-learner polish

**Files:**
- Modify: `src/components/dashboard/FirstRunOnboarding.tsx`
- Modify: `src/components/dashboard/DailyPathDashboard.tsx`
- Modify: `src/components/dashboard/dashboard.module.css`
- Modify: `src/components/nav/LanguageSwitcher.tsx`
- Modify: `tests/DailyPathDashboard.test.tsx`

**Consumes:** `WelcomeFlow` and Task 1 state helpers.

**Produces:** blank progress opens the welcome flow only for learners with no completed onboarding; selected language persists and the existing switcher remains a secondary control.

- [ ] **Step 1: Write failing dashboard tests.**

```tsx
it('shows language onboarding, not a default Lesson 0 card, to a new learner', () => {
  render(<DailyPathDashboard progress={blankDemoProgress} />);
  expect(screen.getByRole('heading', { name: /what would you like to speak first/i })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /start learning/i })).not.toBeInTheDocument();
});

it('keeps a completed learner on their selected dashboard course', () => {
  seedCompletedOnboarding('english-to-portuguese');
  render(<DailyPathDashboard progress={blankDemoProgress} />);
  expect(screen.getByRole('combobox', { name: 'Learning language' })).toHaveValue('english-to-portuguese');
});
```

- [ ] **Step 2: Run the focused test and verify it fails.**

Run: `npm test -- tests/DailyPathDashboard.test.tsx`

Expected: FAIL because blank progress still renders the direct Lesson 0 onboarding card.

- [ ] **Step 3: Integrate with existing dashboard state.**

Use a post-hydration read for browser storage so server render stays safe. On a blank snapshot with no completed onboarding state, replace `FirstRunOnboarding` with `WelcomeFlow`. A `course` query parameter remains the highest-priority explicit selection. Completed onboarding state and then `verbalibera_course` provide fallback selection before the server snapshot default; validate every stored slug against `progress.courses`.

- [ ] **Step 4: Polish the returned dashboard.**

Keep `LanguageSwitcher` but make it visually secondary. Near the dominant course CTA, use direct orientation copy: “Learning Italian” and “Continue first words” for a beginner, moving to the existing daily-path language once meaningful progress exists. Rename visible “foundation” jargon to “first words” where it describes an entry action; retain technical course labels only where they genuinely clarify content availability.

- [ ] **Step 5: Verify focused tests.**

Run: `npm test -- tests/DailyPathDashboard.test.tsx`

Expected: PASS, including existing language-switching coverage.

- [ ] **Step 6: Commit.**

```bash
git add src/components/dashboard/FirstRunOnboarding.tsx src/components/dashboard/DailyPathDashboard.tsx src/components/dashboard/dashboard.module.css src/components/nav/LanguageSwitcher.tsx tests/DailyPathDashboard.test.tsx
git commit -m "feat: guide new learners into their chosen first course"
```

## Task 6: final integration, accessibility, and browser verification

**Files:**
- Create: `tests/e2e/onboarding.spec.ts`
- Modify: relevant test setup only if required for stable local storage seeding.

**Consumes:** completed Tasks 1–5.

- [ ] **Step 1: Add end-to-end beginner path coverage.**

```ts
test('a new learner chooses Italian, completes a first win, and enters first words', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByRole('radio', { name: /Italian/i }).check();
  await page.getByRole('button', { name: /continue with italian/i }).click();
  await page.getByRole('button', { name: /start from the beginning/i }).click();
  await page.getByRole('button', { name: /ciao/i }).click();
  await page.getByRole('button', { name: /keep going: first words/i }).click();
  await expect(page).toHaveURL(/\/courses\/italian\?start=1/);
});
```

- [ ] **Step 2: Add placement and persistence journeys.**

Cover Spanish “I know some already” routing to `/learn/english-to-spanish/placement`; cover a completed stored onboarding state returning to its selected course; run both at existing mobile and desktop projects.

- [ ] **Step 3: Run unit and targeted browser tests.**

Run: `npm test -- tests/onboarding-state.test.ts tests/WelcomeFlow.test.tsx tests/DailyPathDashboard.test.tsx`

Run: `npx playwright test tests/e2e/onboarding.spec.ts --config=playwright.mobile.config.ts`

Run: `npx playwright test tests/e2e/onboarding.spec.ts --config=playwright.config.ts`

Expected: PASS.

- [ ] **Step 4: Manual accessibility and visual review.**

Verify tab order and visible focus on every language card, both entry choices, Back, and final CTA. Verify `prefers-reduced-motion`, 320px width, and audio-unavailable fallback. Confirm no screen displays fake XP, streaks, hearts, a timer, or forced account creation.

- [ ] **Step 5: Run the repository quality gate and commit.**

Run the repository's standard lint/typecheck/build commands from `package.json`, then:

```bash
git add tests/e2e/onboarding.spec.ts
git commit -m "test: cover approachable first-learning flow"
```

## Handoff Order

1. **Hermes:** Task 1 only; publish the state/catalog contract before UI work starts.
2. **Pompey round robin:** Task 2 → Task 3 → Task 4 → Task 5. These are intentionally serial because each route extends the same welcome-flow state machine; do not have two routes modify `WelcomeFlow.tsx` simultaneously.
3. **Verifier:** Task 6 after all four UI routes land.

## Definition of Done

- A first-time learner chooses a language before seeing a course dashboard or Lesson 0.
- A beginner has one understandable, low-stakes success in under 30 seconds and enters the correct first-words course afterward.
- An experienced learner can choose placement from the same welcome flow.
- Returning learners retain their selected course and are not forced through onboarding again.
- Existing placement, daily-path, and language-switching behavior continues to pass its tests.
