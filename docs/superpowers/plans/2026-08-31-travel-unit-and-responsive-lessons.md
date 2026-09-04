# Travel Unit and Responsive Lessons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver original French and Italian A1 travel-unit content with step-specific, responsive preview lessons.

**Architecture:** Curriculum fixtures expose scenario, reasoning cue, and model dialogue for five original patterns per course. A pure resolver maps each session step to its exact pattern/drill; `GuidedSession` renders this resolved lesson in a reveal/self-check flow. The dashboard derives and displays the selected course’s next scenario, while responsive CSS uses one semantic flow with a mobile action dock and a desktop context rail.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS Modules, Vitest, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-31-travel-unit-and-responsive-lesson-design.md`

## Global Constraints

- Author all lesson text, prompts, dialogues, accepted responses, and UI copy specifically for VerbaLibera; do not reproduce third-party lessons, recordings, assets, exercise sequences, or trade dress.
- Keep this release preview-only: no progress, XP, mastery, assessment, or SRS mutation may be persisted or claimed by the UI.
- Preserve original-content provenance and identify unavailable audio honestly.
- Use `notice → build → vary → use` for each new pattern, with practical travel scenarios in French and Italian.
- Keep keyboard and touch controls accessible, with at least 44 CSS-pixel targets; support reduced motion and avoid horizontal overflow at the 390-pixel Playwright viewport.
- Run tests before production changes (RED), prove each new test fails for the intended missing behaviour, then make it pass with the smallest implementation.

---

### Task 1: Author typed Unit 1 fixtures and session-content resolver

**Files:**
- Modify: `src/features/curriculum/types.ts`
- Modify: `src/features/curriculum/fixture.ts`
- Modify: `src/features/progress/demo-progress.ts`
- Create: `src/features/session/resolve-session-content.ts`
- Modify: `tests/curriculum-fixture.test.ts`
- Create: `tests/resolve-session-content.test.ts`

**Interfaces:**
- Produces `PatternLessonFixture` with `scenario`, `notice`, and `modelDialogue` fields, embedded in `ConceptFixture`.
- Modifies `SessionCandidate` and `SessionStep` in `src/features/session/compose-session.ts` so each candidate/step carries `contentId` and optional `drillId`, while retaining its opaque session `id`.
- Produces `resolveSessionContent(courseSlug: string, contentId: string, drillId?: string): ResolvedSessionContent | null`, where `ResolvedSessionContent` contains `course`, `concept`, and `drill: DrillFixture | null`.
- `GuidedSession` in Task 2 consumes the resolver and must receive `null` for an invalid course or step instead of silently using the first concept.

- [ ] **Step 1: Write failing fixture and resolver tests**

```ts
it('authors five original travel patterns for every course', () => {
  for (const course of initialCourses) {
    expect(course.concepts).toHaveLength(5);
    expect(course.concepts.map((concept) => concept.position)).toEqual([1, 2, 3, 4, 5]);
    expect(course.concepts.every((concept) => concept.scenario && concept.notice && concept.modelDialogue)).toBe(true);
  }
});

it('resolves a drill step to its own pattern instead of the first pattern', () => {
  expect(resolveSessionContent('english-to-french', 'fr-find-place', 'fr-find-place-drill')).toMatchObject({
    concept: { id: 'fr-find-place' },
    drill: { id: 'fr-find-place-drill' },
  });
});

it('returns null for a missing pattern', () => {
  expect(resolveSessionContent('english-to-french', 'missing-pattern')).toBeNull();
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- tests/curriculum-fixture.test.ts tests/resolve-session-content.test.ts`

Expected: FAIL because five-pattern lesson fields and `resolveSessionContent` do not exist.

- [ ] **Step 3: Add the smallest typed content surface and original fixtures**

```ts
export type PatternLessonFixture = Readonly<{
  scenario: string;
  notice: string;
  modelDialogue: Readonly<{ prompt: string; answer: string }>;
}>;

```

Add the three `PatternLessonFixture` fields to the existing `ConceptFixture`. Author five ordered concepts for each course using the IDs `fr-greet-politely`, `fr-ordering-politely`, `fr-find-place`, `fr-ask-help`, `fr-pay-politely` and their `it-` counterparts. Give each concept original prompt/answer audio metadata and at least one matching substitution or transformation drill. Change `SessionCandidate` to `{ id: string; contentId: string; drillId?: string }` and carry those values to `SessionStep`. Give every French and Italian demo step an explicit matching `contentId`; only drill-round candidates receive a `drillId`. Use the same preview sequence for each course: ordering review, ordering drill, finding-a-place drill, greeting new pattern.

```ts
export function resolveSessionContent(courseSlug: string, contentId: string, drillId?: string): ResolvedSessionContent | null {
  const course = initialCourses.find((candidate) => candidate.slug === courseSlug);
  const concept = course?.concepts.find((candidate) => candidate.id === contentId);
  if (!course || !concept) return null;
  const drill = drillId ? concept.drills.find((candidate) => candidate.id === drillId) : null;
  return drillId && !drill ? null : { course, concept, drill };
}
```

Replace the illustrative resolver algorithm if needed, but retain the observable contract and exact step-to-pattern mapping. Do not add persistence, recordings, or third-party content.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- tests/curriculum-fixture.test.ts tests/resolve-session-content.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the task**

```bash
git add src/features/curriculum/types.ts src/features/curriculum/fixture.ts src/features/progress/demo-progress.ts src/features/session/resolve-session-content.ts tests/curriculum-fixture.test.ts tests/resolve-session-content.test.ts
git commit -m "feat: author travel unit fixtures"
```

### Task 2: Render step-specific reveal and self-check lesson cards

**Files:**
- Modify: `src/components/session/GuidedSession.tsx`
- Modify: `src/components/session/session.module.css`
- Modify: `tests/GuidedSession.test.tsx`

**Interfaces:**
- Consumes `resolveSessionContent(courseSlug, activeStep.contentId, activeStep.drillId)` from Task 1.
- Produces a `GuidedSession` that renders the selected pattern’s scenario, notice, and drill/model answer; it must expose buttons named `Reveal model answer`, `I checked my answer`, and `Continue` according to state.
- Invalid resolved content renders an honest unavailable state.

- [ ] **Step 1: Write failing interaction tests**

```tsx
it('renders the active step’s scenario instead of the first course pattern', async () => {
  const user = userEvent.setup();
  render(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByText(/find a place/i)).toBeInTheDocument();
});

it('hides a model answer until the learner deliberately reveals and self-checks it', async () => {
  const user = userEvent.setup();
  render(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);
  expect(screen.queryByText('Je voudrais un café, s’il vous plaît.')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /reveal model answer/i }));
  await user.click(screen.getByRole('button', { name: /i checked my answer/i }));
  expect(screen.getByText(/this is a preview—nothing was saved/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/GuidedSession.test.tsx`

Expected: FAIL because the existing session always reads `course.concepts[0]` and immediately displays the answer transcript.

- [ ] **Step 3: Implement the minimal stateful lesson flow**

Add `isModelRevealed` and `isSelfChecked` state reset when `stepIndex` changes. Resolve the active content by step ID. Before reveal, show a concise prompt and the `Reveal model answer` button. After reveal, show the model dialogue/answer and `I checked my answer`; after self-check, show only supportive preview language and `Continue`. For a new-pattern step, show the authored notice and model dialogue without claiming proficiency. Preserve one action that advances exactly one step.

```tsx
const resolved = isComplete
  ? null
  : resolveSessionContent(courseSlug, activeStep.contentId, activeStep.drillId);
if (!isComplete && !resolved) return <UnavailableStep courseTitle={course.title} />;
```

Use semantic headings and `aria-live="polite"` only for the reveal/self-check status. Keep audio unavailable copy honest and do not present the model answer before reveal on independent response cards.

- [ ] **Step 4: Add responsive card structure**

Add a semantic context region for scenario and step progress, a lesson content region, and an action container. At narrow widths, make the action container sticky at the bottom with `env(safe-area-inset-bottom)` and enough `.stepBody` bottom padding to prevent occlusion. At `min-width: 720px`, place the context region in the existing left rail and the content in the right column. Add a `prefers-reduced-motion` override for transitions.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npm test -- tests/GuidedSession.test.tsx`

Expected: PASS, including existing bounded-completion and unavailable-course coverage.

- [ ] **Step 6: Commit the task**

```bash
git add src/components/session/GuidedSession.tsx src/components/session/session.module.css tests/GuidedSession.test.tsx
git commit -m "feat: add responsive travel lesson flow"
```

### Task 3: Make the dashboard scenario-aware and course-consistent

**Files:**
- Modify: `src/components/dashboard/DailyPathDashboard.tsx`
- Modify: `src/components/dashboard/dashboard.module.css`
- Modify: `tests/DailyPathDashboard.test.tsx`

**Interfaces:**
- Consumes `initialCourses` and the selected course slug from the existing dashboard state.
- Produces a launch card that names the selected course’s current Unit 1 scenario and keeps the existing session route in sync.
- Does not mutate `demoProgress` or write preview state.

- [ ] **Step 1: Write failing dashboard tests**

```tsx
it('shows the selected course’s next scenario in the launch card', async () => {
  const user = userEvent.setup();
  render(<DailyPathDashboard progress={demoProgress} />);
  expect(screen.getByText(/order coffee or food/i)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /switch to italian/i }));
  expect(screen.getByText(/order coffee or food/i)).toBeInTheDocument();
  expect(screen.getByText(/Italian/i)).toBeInTheDocument();
});

it('keeps the launch action and selected-course controls touch-sized', () => {
  render(<DailyPathDashboard progress={demoProgress} />);
  expect(screen.getByRole('link', { name: /continue 8-minute session/i })).toHaveClass(styles.primaryAction);
  expect(screen.getByRole('button', { name: /switch to italian/i })).toHaveClass(styles.courseButton);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/DailyPathDashboard.test.tsx`

Expected: FAIL because the launch card has no authored scenario and course-specific lesson context.

- [ ] **Step 3: Implement scenario-aware launch copy and responsive polish**

Look up the selected course from `initialCourses`, derive its next pattern from the first incomplete/next authored position appropriate to preview data, and render the scenario as a concise outcome below the unit label. Preserve course-title, progress, and preview copy. Do not use `window` for responsive logic.

Add CSS that keeps the CTA prominent in the first mobile viewport, prevents oversized artwork from squeezing the action, makes selected course state visually unmistakable, and retains the existing desktop grid at `760px` and above. Keep visible focus and 44-pixel targets.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- tests/DailyPathDashboard.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the task**

```bash
git add src/components/dashboard/DailyPathDashboard.tsx src/components/dashboard/dashboard.module.css tests/DailyPathDashboard.test.tsx
git commit -m "feat: surface travel scenarios on dashboard"
```

### Task 4: Verify the complete browser flow on phone and desktop

**Files:**
- Modify: `tests/e2e/daily-path.spec.ts`
- Create: `tests/e2e/guided-session.spec.ts`

**Interfaces:**
- Consumes the dashboard CTA and `GuidedSession` accessible button names from Tasks 2–3.
- Produces cross-viewport evidence that selected courses reach usable travel sessions without horizontal overflow.

- [ ] **Step 1: Write failing browser acceptance tests**

```ts
test('Italian travel session is available after course selection', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /switch to italian/i }).click();
  await page.getByRole('link', { name: /continue 8-minute session/i }).click();
  await expect(page.getByText(/ordering coffee or food/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /reveal model answer/i })).toBeVisible();
});

test('model answer requires deliberate reveal and remains usable on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/learn/english-to-french');
  await expect(page.getByText('Je voudrais un café, s’il vous plaît.')).toBeHidden();
  await page.getByRole('button', { name: /reveal model answer/i }).click();
  await expect(page.getByText('Je voudrais un café, s’il vous plaît.')).toBeVisible();
});
```

- [ ] **Step 2: Run the new browser tests and verify RED**

Run: `npm run test:e2e -- tests/e2e/guided-session.spec.ts`

Expected: FAIL because Italian has no session steps and the answer is currently always visible.

- [ ] **Step 3: Update existing mobile coverage and implement no production changes**

Replace the stale Italian-unavailable expectation in `daily-path.spec.ts` with an available-session expectation. Reuse `assertNoHorizontalOverflow` on both the dashboard and guided-session page at 390×844. Keep this task test-only; any production failure belongs in the relevant earlier task and must be fixed there through its review loop.

- [ ] **Step 4: Run browser verification and verify GREEN**

Run: `npm run test:e2e -- tests/e2e/daily-path.spec.ts tests/e2e/guided-session.spec.ts`

Expected: PASS at mobile and desktop viewport assertions.

- [ ] **Step 5: Commit the task**

```bash
git add tests/e2e/daily-path.spec.ts tests/e2e/guided-session.spec.ts
git commit -m "test: cover travel lessons across viewports"
```

### Task 5: Full regression and production verification

**Files:**
- No planned source changes. Route any regression to its owning Task 1–4 implementation/review loop with a failing regression test before its minimal fix.

**Interfaces:**
- Consumes the completed Task 1–4 implementation.
- Produces fresh verification evidence for the final review.

- [ ] **Step 1: Run the complete unit suite**

Run: `npm test`

Expected: PASS with no failing Vitest files.

- [ ] **Step 2: Run static and production checks**

Run: `npm run lint && npm run typecheck && npm run build`

Expected: each command exits 0.

- [ ] **Step 3: Run the browser suite**

Run: `npm run test:e2e`

Expected: PASS for all configured browser tests.

- [ ] **Step 4: Record verification outcome**

If all three commands pass, make no code change and proceed to final whole-branch review. If a command fails, record its exact failing test/error in the SDD ledger and dispatch the owning task’s implementer for a test-first fix; do not make an unreviewed controller-side fix.
