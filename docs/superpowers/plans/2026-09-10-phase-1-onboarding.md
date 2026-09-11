# Phase 1 implementation plan — finish the first ten minutes

Date: 2026-09-10. Source: `docs/superpowers/plans/2026-09-10-development-roadmap.md` §5.
Branch: `hermes/hermes-830d4bcc`. Splits into 1A (state machine, code) and 1B (content/entry
sequence). This plan covers **1A**; 1B gets its own plan once 1A's contracts are pinned.

## Findings from the current source (before changing anything)

1. **The language metadata is in two places and already disagrees.** `WelcomeFlow.tsx` builds its
   own flag map, availability heuristic and benefit string inline; `src/features/onboarding/state.ts`
   has `onboardingLanguages()` with the same three things; and
   `src/features/onboarding/languages.ts` (`languagesFor`) wraps that and **has no callers at all**.
   Any language added to the catalog silently gets `🌐` and a copy string in one place only.
2. **Placement is offered for every displayed language.** Only `frenchPlacementItems` and
   `italianPlacementItems` exist (`src/features/placement/items.ts`), and the placement route only
   generates a page for the four travel-fixture slugs. Choosing "I know some already" for Spanish or
   Portuguese lands on a placement quiz with no authored items, and German is not in the route's
   `generateStaticParams` at all.
3. **Completion is never written.** `WelcomeFlow` writes `status: 'welcome-in-progress'` on both
   buttons and nothing in production ever writes `status: 'completed'`. `DailyPathDashboard` treats
   `readOnboardingState(...) !== null` as "seen", so the flow is suppressed for anyone who clicked
   once — but the stored record still claims the welcome is in progress forever, and a learner who
   returns mid-flow has no defined resume point.
4. **The radio change writes storage immediately.** `chooseLanguage` calls `setSelectedCourse(slug)`
   on selection, before the learner has continued. Browsing to another language and navigating away
   silently rewrites the saved course.
5. **Invalid storage and denied storage are indistinguishable from a new learner.** Corrupt JSON
   returns `null`; so does a browser with storage disabled. Both then re-show the welcome flow on
   every visit with no acknowledgement.
6. **The promise and the handoff do not match.** The card promises "A friendly 2-minute first
   phrase", and `onboardingDestination` sends the learner to `/courses/<language>?start=1` — the
   full foundation lesson. That is Phase 1B's problem, but 1A must give 1B a place to land.

## 1A input/output contract

`src/features/onboarding/state.ts` becomes the single source of onboarding truth:

| Export | Contract |
| --- | --- |
| `onboardingLanguages(courses)` | one `OnboardingLanguage` per course, derived from the course record plus the foundation catalog: `name`, `flag`, `availability` (from the pack: structured foundations vs first words), `benefit`, and the new **`placement: boolean`** derived from authored placement items. No hardcoded language list. |
| `onboardingDestination(state)` | `placement` → the placement route **only when an authored item set exists**, otherwise the first-words entry; `beginner` → the foundation start; `preview` → the course page without `?start=1`. |
| `completeOnboarding(courseSlug, entryIntent)` | writes `status: 'completed'` durably (through the storage layer below). |
| `onboardingResumeScreen(state)` | `null` when completed; `'choice'` when a language was chosen but not acted on; `'language'` otherwise. This is the resume rule the flow uses instead of always restarting at screen 1. |
| `readOnboardingOutcome(courses)` | distinguishes `'unseen'`, `'invalid'` (stored record failed validation) and the parsed state, so the UI can be honest about a lost record instead of pretending nothing was there. |
| storage layer | a module-level in-memory mirror used when `localStorage` throws (Safari private mode, denied storage). The learner can still finish onboarding in this session; the limitation is that the choice does not persist across visits, and the code says so. |

Storage rules: writes never throw; a record that fails validation is treated as absent for
navigation purposes (never trusted) but reported as `'invalid'`; version bumps invalidate older
records deliberately.

## Files

- `src/features/onboarding/state.ts` (contract above)
- `src/features/onboarding/languages.ts` (the dead wrapper: either becomes the real entry point or
  goes away — no second implementation)
- `src/components/onboarding/WelcomeFlow.tsx` (consume the shared metadata; resume; capability-aware
  second card; commit the selection on Continue)
- `src/components/dashboard/DailyPathDashboard.tsx` (resume-aware entry)
- `tests/onboarding-state.test.ts`, `tests/WelcomeFlow.test.tsx`, `tests/DailyPathDashboard.test.tsx`
- new `tests/e2e/onboarding.spec.ts` for new visitor, return, refresh mid-flow, language switch and
  unsupported placement

## Regression fixtures

- A second call path that would otherwise disagree: the flag/availability/benefit trio is asserted
  to come from one function, and `languagesFor(courses)` must equal `onboardingLanguages(courses)`.
- Capability: for a course with no authored placement items, the flow must not offer the quiz and
  `onboardingDestination` must not produce a placement URL.
- Storage denial is simulated by replacing `localStorage` with an object whose methods throw.

## Acceptance commands

- `npx vitest run tests/onboarding-state.test.ts tests/WelcomeFlow.test.tsx tests/DailyPathDashboard.test.tsx`
- `env -u E2E_BASE_URL npx playwright test tests/e2e/onboarding.spec.ts --project=chromium --workers=1`
- `npx tsc --noEmit`, `npm run lint`, `npm run build`

## Rollback

Each change is confined to the onboarding feature and its tests; the flow keeps working with the
old record shape because `version: 1` and the existing fields are preserved. Reverting the commit
restores the current behaviour without a storage migration.

## Explicitly pending

The Phase 1 gate's observed pilot with five new users is a human session. Nothing in this repo can
close it, and no copy may claim it happened.
