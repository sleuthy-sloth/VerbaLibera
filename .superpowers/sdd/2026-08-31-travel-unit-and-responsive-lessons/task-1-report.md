# Task 1 report

## Scope

Authored five original travel patterns for English-to-French and English-to-Italian, added typed lesson fields and content resolution, and carried explicit pattern/drill IDs through session candidates and steps. Demo progress now uses the required preview sequence: ordering review, ordering drill, finding-a-place drill, greeting new pattern.

## Files changed

- `src/features/curriculum/types.ts`: added `PatternLessonFixture`; extended `ConceptFixture`.
- `src/features/curriculum/fixture.ts`: authored five ordered concepts per course with original scenario, notice, model dialogue, unavailable audio metadata, and drills.
- `src/features/progress/demo-progress.ts`: added explicit content/drill IDs and corrected preview sequence.
- `src/features/session/compose-session.ts`: added `contentId` and optional `drillId` to candidates/steps.
- `src/features/session/resolve-session-content.ts`: added safe course/concept/drill resolver.
- `tests/curriculum-fixture.test.ts`, `tests/resolve-session-content.test.ts`: fixture and resolver coverage.
- `tests/compose-session.test.ts`, `tests/demo-progress.test.ts`: updated expectations for the typed IDs and sequence.

## TDD verification

RED:

```text
npm test -- tests/curriculum-fixture.test.ts tests/resolve-session-content.test.ts
2 failed: five-pattern assertion got 1 concept (expected 5); resolver import did not exist.
```

GREEN:

```text
npm test -- tests/curriculum-fixture.test.ts tests/resolve-session-content.test.ts tests/compose-session.test.ts tests/demo-progress.test.ts
Test Files 4 passed; Tests 12 passed

npm test
Test Files 18 passed; Tests 72 passed

npm run lint
passed with no output/errors
```

## Commit

`feat: author travel unit fixtures` (final commit hash is reported in the handoff; amending this report necessarily changes the hash)

## Concerns

`npm run typecheck` remains blocked by the unrelated pre-existing error `src/app/layout.tsx(22,50): Cannot find name 'LayoutProps'.` No Task 1 file contributes a typecheck error.
