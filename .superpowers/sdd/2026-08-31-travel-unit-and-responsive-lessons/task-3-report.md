# Task 3 report: scenario-aware dashboard

## Status

Complete. The dashboard launch card now surfaces the selected course's next authored Unit 1 scenario and remains synchronized with the selected course's existing session route. Preview progress remains read-only: course switching is local component state and does not mutate `demoProgress`.

## Changes

- Added dashboard tests for scenario copy after French/Italian course switching and touch-sized action hooks.
- Resolved the first queued step for the selected course through `initialCourses`, so the launch card uses the authored concept scenario rather than hard-coded course text.
- Added concise scenario outcome copy below the unit and course title.
- Made the mobile launch CTA full-width while retaining its desktop intrinsic sizing at the existing `760px` breakpoint.
- Added a minimum-width guard for the launch content and a focus stacking hook so responsive overflow does not squeeze or obscure the action.

## Verification

- `npm test -- tests/DailyPathDashboard.test.tsx` — PASS (11 tests).
- `git diff --check` — PASS.
- `npm run typecheck` — reports an unrelated existing error: `src/app/layout.tsx(22,50): error TS2304: Cannot find name 'LayoutProps'.`

## Commit

Commit: `feat: surface travel scenarios on dashboard` (see the final `git rev-parse --short HEAD` for the worktree identifier).

## Review fix round 1

### RED

Added focused coverage for an empty selected-course session and a selected-course step whose `contentId` is not authored. Before the fix, both tests failed because the launch card omitted the scenario when the first matching step could not resolve.

### GREEN

The dashboard now filters for a resolvable selected-course step and falls back safely to the first authored concept when no such step exists. The focused suite passes with 13/13 tests.

Fix commit: `feat: preserve an authored dashboard scenario when preview steps are unavailable`.
