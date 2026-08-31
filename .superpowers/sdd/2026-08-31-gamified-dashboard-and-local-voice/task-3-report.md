# Task 3 report: Signal Pop Daily Path dashboard and guided session

## Status

Complete. The responsive dashboard, read-only data boundary, and guided-session route are implemented and verified. The untracked `README 2.md` was not added, edited, or staged.

## Changes

- Replaced the starter homepage with `DashboardDataBoundary`, which owns the existing `useDemoProgress` loading, failure, retry, and success states.
- Added a presentational `DailyPathDashboard` with a single accessible `h1`, sequential review → drill → pattern path, semantic `dl` metrics, bounded daily-goal progress, local-only course switching, and the required 8-minute session link.
- Added the Signal Pop visual system with the approved Ink, Indigo, Coral, Lime, and Cloud tokens. The signature is the connected daily practice path; surrounding progress information stays restrained instead of becoming a generic card wall.
- Added responsive mobile-first layout rules, strong `:focus-visible` treatment, controls of at least 44 pixels, and reduced-motion behavior that suppresses loading/celebration transitions.
- Added `GuidedSession`, which filters the fixed snapshot to the selected course, preserves review-first order, advances locally through a bounded set of steps, and ends with honest preview-XP copy without persisting data.
- Added the dynamic `/learn/[courseSlug]` Server Component. It awaits `params`, validates the slug against `initialCourses`, and passes the fixed `demoProgress` snapshot to the client session without fetching the app's own API.
- Rendered fixture audio honestly as unavailable transcript support; no live speech or playable-audio claim was added.
- Updated homepage metadata and app-shell coverage for the new dashboard boundary.

## Files

Created:

- `src/components/dashboard/DailyPathDashboard.tsx`
- `src/components/dashboard/DashboardDataBoundary.tsx`
- `src/components/dashboard/dashboard.module.css`
- `src/components/session/GuidedSession.tsx`
- `src/components/session/session.module.css`
- `src/app/learn/[courseSlug]/page.tsx`
- `tests/DailyPathDashboard.test.tsx`
- `tests/GuidedSession.test.tsx`
- `.superpowers/sdd/2026-08-31-gamified-dashboard-and-local-voice/task-3-report.md`

Modified:

- `src/app/page.tsx`
- `src/app/globals.css`
- `src/app/layout.tsx`
- `tests/app-shell.test.tsx`

## TDD evidence

### Initial RED

Command:

```text
npm run test -- tests/DailyPathDashboard.test.tsx tests/GuidedSession.test.tsx
```

Result: exit 1. Both suites failed before collecting tests because the required production modules did not exist:

```text
Failed to resolve import "@/components/dashboard/DailyPathDashboard"
Failed to resolve import "@/components/session/GuidedSession"
Test Files  2 failed (2)
```

This was the expected missing-feature failure before production code was written.

### Focused GREEN

Command:

```text
npm run test -- tests/app-shell.test.tsx tests/DailyPathDashboard.test.tsx tests/GuidedSession.test.tsx
```

Result: exit 0 after implementation and one test correction for awaiting the asynchronous boundary:

```text
Test Files  3 passed (3)
Tests       10 passed (10)
```

### Self-review bug RED/GREEN

Self-review found that the path's review description still said “six phrases” when `dueReviewCount` was zero. A regression assertion was added first.

RED command:

```text
npm run test -- tests/DailyPathDashboard.test.tsx
```

RED result: exit 1, 1 failed / 5 passed. The test found `Bring six phrases back into reach` in the zero-review state.

After deriving the path copy from `dueReviewCount`, the same focused suite passed:

```text
Test Files  1 passed (1)
Tests       6 passed (6)
```

## Final verification

Fresh verification immediately before this report:

```text
npm run test
Test Files  12 passed (12)
Tests       51 passed (51)
Exit 0

npm run lint
Exit 0, no diagnostics

npm run typecheck
Exit 0, no diagnostics

git diff --check
Exit 0

npx next build --webpack
Compiled successfully; TypeScript passed; 5/5 static pages generated; Exit 0
```

The default Turbopack `npm run build` was also attempted. It could not bind the local helper process port in this managed sandbox (`Operation not permitted`, Turbopack internal error). The webpack production build completed successfully and verified the `/`, `/api/demo/progress`, and `/learn/[courseSlug]` routes.

## Self-review

- Data boundary: `DailyPathDashboard` accepts only `progress`; fetching and `refetch` remain isolated in `DashboardDataBoundary`.
- Read-only boundary: course selection and session progression use component state only. No mutations, storage writes, server actions, POST routes, or in-app server fetches were added.
- Semantics: dashboard and session each have one `h1`; supporting sections use `h2`; progress metrics use `dl`; native progress elements expose bounded values and `aria-valuetext`.
- Accessibility: actions are native links/buttons, controls meet the minimum target size, keyboard focus is high contrast, the current guided step uses `aria-current`, and completion uses an `aria-live` region.
- Responsive hierarchy: the primary session action occurs before path and metrics in source order on mobile; the desktop grid only changes presentation. The sequential path remains vertical on narrow screens and becomes a connected horizontal rail on wide screens.
- Visual restraint: Signal Pop color is concentrated in the launch panel and connected path markers. Progress and course controls use quieter rules and surfaces.
- Mutation check: tests would fail for a stale course href, a mutated selected slug, missing retry/refetch behavior, incorrect zero-review copy, reordered session kinds, an unbounded/missing progress label, or unknown-course leakage.

## Concerns and follow-up

- `demoProgress.session` currently contains French steps only. Switching to Italian correctly preserves the read-only snapshot and routes to an honest “no guided steps” state rather than borrowing French content. A future fixture can supply Italian session steps without changing these UI boundaries.
- Browser-level pixel and responsive checks remain intentionally deferred to Task 6, as required by the brief. Component tests verify hierarchy and class hooks, not geometry.
- Task 4 still owns generated imagery. This task uses CSS geometry and text only, so there are no temporary external image assets to replace.
- The default Turbopack production build is constrained by this sandbox's port policy; the webpack production build is green.

---

## Fix round 1: contrast and asynchronous status semantics

### Review findings addressed

1. Replaced the coral-only focus indicator with a 4-pixel Ink focus ring and a dedicated inherited `focusSurface` hook. Ink has contrast ratios of 3.73:1 against Indigo, 11.63:1 against Lime, 15.34:1 against white, and 14.42:1 against Cloud; these exceed the 3:1 non-text focus-indicator requirement on every dashboard surface.
2. Moved the small Indigo-panel kicker onto a Lime/Ink contrast tag (11.63:1), moved the small course name onto a Cloud/Ink surface (14.42:1), and removed opacity from course progress. Selected course progress now uses Lime on Ink (11.63:1).
3. Added component-level styling hooks (`focusSurface`, `contrastTag`, `courseMeta`, and `courseProgress`) and regression assertions that those hooks remain attached to the mixed-color surfaces they protect.
4. Added a polite `status` region to the initial loading shell while retaining `aria-busy="true"`.
5. Added an assertive `alert` region for the load failure. A retry now preserves the error surface, marks the main region busy, disables and relabels the action as `Trying again…`, and exposes a polite retry status until the request settles.

### Root-cause analysis

- The coral token was being reused as a universal focus color even though its contrast is only 1.57:1 against Indigo, 1.99:1 against Lime, and 2.62:1 against white. The problem was the single-token focus assumption, not outline thickness.
- Small launch copy used Lime or translucent white directly on Indigo, and selected course progress inherited reduced opacity. These combinations did not reach 4.5:1 for small text.
- The boundary rendered visible loading/error copy without live-region roles. During a manual retry, React Query returned to a pending/no-data state, so the original `isPending` branch replaced the error and retry action with the initial skeleton. A local `retryRequested` interaction flag now distinguishes first load from a user-initiated refetch while query state remains the source of fetch activity.

### TDD evidence

Initial regression RED:

```text
npm run test -- tests/DailyPathDashboard.test.tsx
Test Files  1 failed (1)
Tests       3 failed | 4 passed (7)
Exit 1
```

The failures were the intended breaks: no `focusSurface` class export, no loading `status`, and no error `alert`.

Contrast hook GREEN:

```text
npm run test -- tests/DailyPathDashboard.test.tsx -t "exposes high-contrast styling hooks"
Test Files  1 passed (1)
Tests       1 passed | 6 skipped (7)
Exit 0
```

The first boundary implementation preserved live roles but exposed a second state bug during the controlled unresolved retry:

```text
npm run test -- tests/DailyPathDashboard.test.tsx -t "DashboardDataBoundary"
Test Files  1 failed (1)
Tests       1 failed | 1 passed | 5 skipped (7)
Exit 1
```

The DOM had returned to the initial loading shell, so `Trying again…` was absent. After distinguishing initial pending from requested retry, the same boundary tests were GREEN:

```text
npm run test -- tests/DailyPathDashboard.test.tsx -t "DashboardDataBoundary"
Test Files  1 passed (1)
Tests       2 passed | 5 skipped (7)
Exit 0
```

### Fix verification

```text
npm run test -- tests/DailyPathDashboard.test.tsx tests/app-shell.test.tsx
Test Files  2 passed (2)
Tests       8 passed (8)
Exit 0

npm run test
Test Files  12 passed (12)
Tests       52 passed (52)
Exit 0

npm run lint
Exit 0, no diagnostics

npm run typecheck
Exit 0, no diagnostics

git diff --check
Exit 0

npx next build --webpack
Compiled successfully; TypeScript passed; 5/5 static pages generated; Exit 0
```

### Fix-round self-review and concerns

- The retry button is a native disabled button while active, so it cannot issue duplicate refetches from keyboard or touch.
- Both visible asynchronous states are named through native live-region roles; error remains an `alert`, while initial load and retry progress use `status`.
- No data mutation, storage, or network boundary changed.
- The previously documented Turbopack sandbox port restriction remains. The production webpack build is green.

---

## Fix round 2: small metric-label contrast

### Correction

The three `.72rem` metric terms (`Total XP`, `Practice flow`, and `Review queue`) now carry an explicit `metricLabel` hook that uses solid Ink on Cloud. This replaces the 58%-Ink mixture (~3.86:1) with the approved Ink token at 14.42:1 contrast. No other dashboard styles or behaviors changed.

### TDD evidence

Focused RED before the component/CSS change:

```text
npm run test -- tests/DailyPathDashboard.test.tsx -t "keeps every small metric label"
Test Files  1 failed (1)
Tests       1 failed | 7 skipped (8)
Exit 1
```

The intended failure reported that `styles.metricLabel` did not exist on the metric terms.

Focused GREEN after applying the Ink contrast hook:

```text
npm run test -- tests/DailyPathDashboard.test.tsx -t "keeps every small metric label"
Test Files  1 passed (1)
Tests       1 passed | 7 skipped (8)
Exit 0
```

### Verification

```text
npm run test -- tests/DailyPathDashboard.test.tsx tests/app-shell.test.tsx
Test Files  2 passed (2)
Tests       9 passed (9)
Exit 0

npm run test
Test Files  12 passed (12)
Tests       53 passed (53)
Exit 0

npm run lint
Exit 0, no diagnostics

npm run typecheck
Exit 0, no diagnostics

git diff --check
Exit 0
```

### Concerns

No new concerns. The correction is restricted to the metric-label foreground and its regression hook.
