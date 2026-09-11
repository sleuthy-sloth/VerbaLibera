# Phase 2A implementation plan — a progress-preserving French v1→v2 migration pilot

Date: 2026-09-10. Source: `docs/superpowers/plans/2026-09-10-development-roadmap.md` §6 (2A).
Branch: `hermes/hermes-830d4bcc`.

## Why French, and what makes this safe

`migratePackV1ToV2()` in `src/features/course-pack/normalize-pack.ts` reuses `normalizePack()`
itself, so the migrated pack cannot express anything the runtime boundary does not already
understand. `tests/pack-migration-parity.test.ts` proves runtime identity on a synthetic legacy
pack. What it does **not** prove is that France's real 222-exercise pack — with its prerequisites,
`reviewOf` retrieval links, media hashes and retained completion lists — survives the transform,
and that stored learner history still replays against it afterwards.

So this pilot is three steps, in order, each independently reviewable:

1. **Parity on the real pack** (this commit, test only — no content moves).
2. **Replay proof for stored history** (this commit, test only).
3. **The flip itself** — `courses/french/manifest.json` to `schemaVersion: 2`, in a commit
   containing the migration, the consumer/test updates it requires, and the regenerated
   artifacts, so a bisect never lands between the pack and its consumers.

Steps 1 and 2 are worth landing even if step 3 is deferred: they are the evidence, and they must
exist before the flip is reviewable.

## Input/output contract

Input: the authored `courses/french/manifest.json` (schemaVersion 1).
Output of step 3: the same file with `schemaVersion: 2`, converted through `migratePackV1ToV2()`
and validated by `validateV2Pack()`. Nothing else about it is authored by hand.

Guarantees the tests pin, all at the *runtime* level:

- `lesson.id`, `unitId`, `title`, `objective`, `prerequisites[].lessonId`,
  `conceptIds`, `vocabulary`, `completionPolicy`, `legacyCompletionExerciseIds` identical.
- `steps[].id`, `step.activityId`, `step.required`, `step.nextStepId` identical for every lesson.
- The exercise-identity set in `exercisesById` identical (`evidenceKey` is the review/SRS key and
  must not move), and every retained `legacyExercises` entry byte-equal.
- `media` ids, urls, sha256 and transcripts identical; the media-hash check in `scripts/content.ts`
  still passes.
- Vocabulary/concept id sets identical, and no lesson loses a prerequisite.

## Regression fixtures

- The real French manifest, not a synthetic one.
- A stored-history fixture with mixed provenance: a legacy attempt keyed by a French exercise id,
  a due schedule keyed by the same id, an unfinished lesson (some steps complete), and an exported
  backup — replayed through the normalization boundary against both the v1 and the migrated pack.

## Acceptance commands

- `npx vitest run tests/french-pack-migration-parity.test.ts tests/pack-migration-parity.test.ts`
- `npx vitest run tests/lesson-attempts.test.ts tests/lesson-backup-version.test.ts tests/course-sync.test.ts`
- `npm run content:validate && npm run content:build`
- `npx tsc --noEmit && npm run lint && npm run build`

## Rollback

Step 3 is a single file plus regenerated artifacts, and `scripts/migrate-pack-v1-v2.ts` is
deterministic, so `git revert` is complete. Old-pack import support stays: `normalizePack` keeps
dispatching on `schemaVersion: 1`, and the v1 path is retained until every course has migrated.

## Explicitly out of scope for this pilot

Authored activity changes (adding new kinds), the smaller courses' migration, and any change to
what a learner sees. Mechanical migration and authored change must not share a commit.
