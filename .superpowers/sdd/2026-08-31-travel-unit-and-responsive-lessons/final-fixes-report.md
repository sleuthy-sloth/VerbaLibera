# Final review fix wave report

Date: 2026-08-31

Scope: consolidated Important and Minor findings for the travel unit and responsive lessons branch.

## Review verification and root causes

- The demo snapshot supplied two ordering reviews because `composeDailySession` accepted only one drill candidate. That made the rendered sequence `REVIEW → REVIEW → DRILL → NEW_PATTERN` instead of the required `REVIEW → DRILL → DRILL → NEW_PATTERN`.
- Greeting and payment drill seeds repeated their model answers, while finding-place seeds were labelled and prompted as substitutions rather than statement-to-question transformations.
- Lesson links always targeted `/`, the dashboard had no URL-selected-course input, and the dashboard locally rewrote the authored `Ordering…` scenario.
- Reveal, self-check, and continue replaced the focused button without transferring focus to the new primary action.
- Existing browser coverage checked visibility and body overflow, but not sticky-action geometry, the complete mobile state chain, desktop rail placement, or document-element overflow.

The initial focused baseline was rerun outside the read-only sandbox cache boundary and passed: 6 files, 30 tests. The first sandboxed attempt could not create Vite's temporary config under this worktree (`EPERM`); this was an execution-environment permission issue, not a product failure.

## RED/GREEN evidence

### 1. Exact two-course demo sequence

RED command:

```text
npm test -- tests/compose-session.test.ts tests/demo-progress.test.ts
```

Result: 2 failing files; 5 failed, 1 passed. Failures showed that `drillRounds` were ignored and that the second demo step remained `fr-ordering-review-2` instead of the ordering drill (with the same mismatch in the Italian fixture).

GREEN implementation:

- Changed the composer input from one `drillRound` to ordered `drillRounds` and admitted each drill up to the session bound.
- Authored both course snapshots as ordering review, matching ordering drill, finding-place drill, then greeting new pattern.
- Asserted all IDs, kinds, content IDs, and drill IDs literally for both languages.

GREEN command/result:

```text
npm test -- tests/compose-session.test.ts tests/demo-progress.test.ts
2 files passed; 6 tests passed.
```

### 2. Meaningful controlled vary content

RED command:

```text
npm test -- tests/curriculum-fixture.test.ts
```

Result: 1 failing file; 7 failed, 4 passed. The failures identified repeated greeting/payment targets and `SUBSTITUTION` finding-place drills with no source statement.

GREEN implementation:

- Greeting practice now changes the request from a table to a coffee while retaining the greeting-plus-request pattern.
- Payment practice now changes the service context from requesting the bill to asking to pay by card.
- French and Italian finding-place practice now explicitly transforms a museum-location statement into a museum-location question.
- Model dialogue, conventional spelling/diacritics, unavailable-audio metadata, and `ORIGINAL` provenance remain intact.
- Added an invariant that every concept's single controlled drill has an accepted recall target different from its build/model answer.

GREEN command/result:

```text
npm test -- tests/curriculum-fixture.test.ts tests/resolve-session-content.test.ts
2 files passed; 15 tests passed.
```

### 3. Course-retaining dashboard returns and query initialization

RED command:

```text
npm test -- tests/DailyPathDashboard.test.tsx tests/app-shell.test.tsx tests/GuidedSession.test.tsx
```

Result: 3 failing files; 5 failed, 21 passed. Expected failures showed the hard-coded `Order…` rewrite, ignored Italian query selection, French fallback on the page wiring test, and `/` lesson links. One additional failure was an obsolete single-drill rail assertion exposed by the already-corrected two-drill sequence.

GREEN implementation:

- The server page awaits the Next.js 16 `searchParams` promise and passes only a string candidate into the client boundary.
- The dashboard chooses a valid requested slug first, then the snapshot-selected slug, then its existing first-course safety fallback.
- Normal exit, unavailable-step, empty-session, and completion links for a valid course use `/?course=<course-slug>`; unknown courses retain the safe `/` fallback.
- Removed the authored-scenario rewrite.
- Replaced the ambiguous same-copy selection test with a real Italian payment-session fixture that visibly resolves `Paying`.
- Updated the rail assertion to require the exact four step kinds.

Intermediate verification after production changes: 2 files passed and 1 stale assertion failed (25 passed, 1 failed). After correcting that obsolete assertion, the GREEN result was:

```text
npm test -- tests/DailyPathDashboard.test.tsx tests/app-shell.test.tsx tests/GuidedSession.test.tsx
3 files passed; 26 tests passed.
```

### 4. Focus handoff between replacement actions

RED command:

```text
npm test -- tests/GuidedSession.test.tsx
```

Result: 1 failing file; 2 failed, 7 passed. JSDOM reported `document.body` focused after reveal and after final completion instead of the replacement action.

GREEN implementation:

- Interaction handlers mark focus for restoration before changing state.
- A post-render effect moves focus to the current primary button, or to the dashboard return link when the final Continue completes the session.
- The focus request is cleared after the transfer so unrelated renders do not recapture focus.
- Testing Library now asserts reveal → self-check, self-check → continue, continue → next reveal, and final continue → completion return link.

GREEN command/result:

```text
npm test -- tests/GuidedSession.test.tsx
1 file passed; 9 tests passed.
```

### 5. Responsive browser acceptance coverage

The browser-only finding was missing acceptance evidence rather than a demonstrated production defect, so the new tests were written before any E2E-specific production change and passed on their first run:

```text
npm run test:e2e -- tests/e2e/guided-session.spec.ts
3 tests passed.
```

The new assertions cover:

- 390×844 viewport;
- sticky action computed positioning and a bounding box fully inside the viewport;
- reveal → self-check → continue through the next step;
- mobile horizontal overflow using both `body` and `documentElement` widths;
- 1280×900 viewport;
- visible desktop context rail positioned to the left of the lesson content;
- static desktop action layout and desktop horizontal overflow; and
- the retained Italian course route and Italian model answer.

No responsive CSS change was needed.

## React and Next.js review

- `src/app/page.tsx` remains a Server Component and correctly awaits promise-based `searchParams`.
- Only a serializable optional string crosses into `DashboardDataBoundary`.
- Client components remain synchronous and retain their existing `use client` boundaries.
- Focus synchronization uses an effect only because the replacement node must exist after React commits; the triggering intent remains in the event handlers.
- No persistence, mutation, mastery, or saved-XP behavior was introduced.

## Fresh final verification

```text
npm test
18 files passed; 96 tests passed.

npm run lint
Exit 0; no lint findings.

npm run typecheck
Exit 0; no TypeScript errors.

npm run build
Next.js 16.3.3 production build compiled, typechecked, collected data, and generated routes successfully.

npm run test:e2e
5 Playwright tests passed.
```

The Playwright dev server emitted only the existing non-failing `NO_COLOR`/`FORCE_COLOR` warning.

## Files changed

- Session composition and snapshot: `src/features/session/compose-session.ts`, `src/features/progress/demo-progress.ts`
- Authored curriculum: `src/features/curriculum/fixture.ts`
- Dashboard query/course selection: `src/app/page.tsx`, `src/components/dashboard/DashboardDataBoundary.tsx`, `src/components/dashboard/DailyPathDashboard.tsx`
- Session return links and focus: `src/components/session/GuidedSession.tsx`
- Unit/integration coverage: `tests/compose-session.test.ts`, `tests/demo-progress.test.ts`, `tests/curriculum-fixture.test.ts`, `tests/DailyPathDashboard.test.tsx`, `tests/app-shell.test.tsx`, `tests/GuidedSession.test.tsx`
- Browser coverage: `tests/e2e/daily-path.spec.ts`, `tests/e2e/guided-session.spec.ts`

## Concerns

- Reading `searchParams` intentionally makes `/` request-rendered, as confirmed by the successful production build. This is the direct App Router mechanism for server-side initialization from the safe query.
- The composer input is internal to this repository and now uses plural `drillRounds`; all source and test call sites were updated and verified.
- No unresolved functional or test concern remains.
