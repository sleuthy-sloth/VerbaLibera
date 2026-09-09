# Lesson variety — verification report

Date: 2026-09-08. Plan: `docs/superpowers/plans/2026-09-08-lesson-variety.md` (+§0.1 decisions). Spec: `docs/superpowers/specs/2026-09-08-lesson-variety-design.md`.

## Task 1 — baseline (Hermes)

- Checkout: `/Users/spkoehl/Documents/ChatGPT/VerbaLibera`, branch `opencode/lesson-variety`, HEAD `d8456ef`, single worktree.
- `shape` work reverted, preserved at `docs/superpowers/plans/2026-09-08-shape-work-superseded.patch`. Tree clean except untracked plan/spec/patch docs.
- Baseline log: `/tmp/lesson-variety-baseline-2026-09-08.log` (typecheck + focused tests + content:validate).

### Baseline results

All green, 2026-09-08 (exit 0 on all three):

```sh
npm run typecheck  # exit 0
npm test -- tests/course-pack.test.ts tests/lesson-path.test.ts tests/portable-environment.test.ts
# Test Files  3 passed (3); Tests  35 passed (35); exit 0
npm run content:validate  # exit 0, answerCoverage 100%
```

No pre-existing failures. Full log: `/tmp/lesson-variety-baseline-2026-09-08.log`.

## Wave A — OpenCode UI inventory
DONE 2026-09-08 (exit 0). Full log: `/tmp/lesson-variety-waveA-opencode.log`.

- Base verified: branch `opencode/lesson-variety` @ `d8456ef`; no `LessonPlayer`/`activities/`/`layouts/` exist — Wave B surface is clear.
- Reuse map: shell mirrors `CourseWorkspace` session loop (L63–64, L186–187, L215–230) + `role="status"`/`heading-focus` a11y backbone (`ExerciseView` L221–224, L269–301); activity registry extends the `renderers` map pattern (`ExerciseView` L189–198); per-family ancestors identified (ThinkInput gate, GlossedText, DialogueView node-walk, ListeningInput heard-first, OrderInput/ClozeInput/TextInput, PictureChoice for scene); weakest coverage is scene + mission checklist (new UI).
- Overlap check: no existing family taxonomy (`Evidence.mode` is skill-ish, not families); §3 `Step` graph is genuinely new; `completedLessons` IS legacy-success behavior (adapter target confirmed).
- Risks filed: shared-file serialization, `Evaluation` name collision (`answer.ts` vs runtime — alias required), two-engine drift (LessonPlayer stays on course-pack side, never `/api/answer-check`), v1 event schema frozen until Task 4, OrderInput index-state → distinct-ID upgrade gap.
- Open questions answered: (1) contracts ARE final Task 2 output, committed `@4474b6e` with fixtures — Wave A gate met; (2) no `CourseEnvironment` extension yet, Wave B uses a test adapter; (3) mount contract is Task 7; (4) Liquid Glass still open, Wave B stays Quiet Ink; (5) yes — acyclicity, branch targets, per-path evidence reachability, media traversal all encoded + 17 tests; (6) `onAssist` is the taint signal, wire `onLookup` into it.

## Task 2 — contracts + v1 adapter (`@4474b6e`)

- `lesson-runtime.ts`, `schema-v2.ts`, `normalize-pack.ts`, `tests/fixtures/lesson-variety.ts`, `tests/lesson-schema-v2.test.ts`, `tests/lesson-normalize.test.ts`.
- 17 tests (missing branch, non-dialogue branch, cycle, dup tokens, bad accepted option, unknown media, version 3, model-not-tainting, orphan, unreachable evidence, v1 identity/order/prereqs, coming-soon). tsc + `course-pack.test.ts` (28) green.

## Task 3 — evaluation + session (`@233fc0b`)

- `activity-evaluation.ts` (exhaustive typed grading over `evaluateAnswer`; duplicate response IDs rejected; dialogue replies carry authored feedback), `lesson-session.ts` (start/submit/advance + `openSupport` overlay; no advance before evaluation; branch recorded on accepted reply; revision-mismatch restart).
- 19 tests. tsc green.

## Task 4 — events, persistence, sync (`@6781338`)

- `attempts.ts`: v2 attempt/step-completion events, `mergeLearningEvents` (idempotent, atomic conflicts, explicit unknown-version errors), `projectLessonEvidence` (participation via chosen-path walk, legacy credits, per-key SRS, skill counts, revision quarantine list), `resumeSession` (resume/restart with explanation).
- `storage.ts`: DB v2 (`lesson-events` + `checkpoints` stores, v1 store untouched), format-1/format-2 backup envelopes (`decodeBackup` unchanged), per-account/pack/lesson checkpoints, drafts never exported.
- `sync.ts` + `route.ts` + `lib/course-progress.ts`: lesson events ride pull/push (v1 batches first); Prisma payload JSON unchanged — no migration, `eventVersion` preserved.
- `environment.ts`: optional `lessonPractice` (`LessonPracticeStore` + memory adapter); portable edition wires a durable lesson store.
- 22 new tests (attempts 11, persistence 11); pre-existing storage/sync/API/portable suites green (37 total). CourseWorkspace backup UI migrates in Task 7.

## Wave B — OpenCode shell + activities (Tasks 5–6)

DISPATCHED 2026-09-08 against `@8c4a282`, background (`/tmp/lesson-variety-waveB-opencode.log`). Allowed files: `LessonPlayer.tsx`, `lesson-player.css`, Story/Conversation/Listening layouts, 8 activity components, 3 test files. No shared-file edits, no commits — Hermes integrates on return.

## Decisions (§0.1 summary)

- V2 `family` is the single taxonomy; `shape` reverted.
- Scope: Italian + French sequences; ES/PT/DE gated (1 lesson each; German also needs TTS decision).
- New listening targets ~10-minute multi-concept tracks via the voice-sidecar workflow.
- Open: Liquid Glass preference vs Quiet Ink constraint (resolve before Task 5/10).
- FreeLingo-style assessment + multi-week plans are out of scope.

## Wave B takeover (Hermes, 2026-09-08) — Tasks 5–6 received from OpenCode

OpenCode idle ~45 min at takeover; its Wave B tree already resolved Codex's 3 lint
errors and most P1s. Verified each Codex finding against the final files:

- Assistance leakage: no product bug. Engine merges `accumulatedAssistance` on
  submit and `advanceLesson` preserves translation/transcript taint; reload
  rehydrates via `resumeSession` from checkpoint assistance. Covered by
  `LessonPlayer.test.tsx` "keeps a revealed story assisted on the next
  question and after reopening" (assisted attempt + `independent:false`).
- Async races: `LessonPlayer` remounts by generation on pack/environment/lesson
  change; `HostedCourseWorkspace` keys the runtime route per pack+scope;
  mount/checkpoint effects carry cancel guards. Covered by "hides previous
  account lesson while replacement store loads".
- Checkpoints: `handleBack` awaits the write and stays with retry copy on
  failure; checkpoints serialize through a write queue; retry re-sends identical
  event IDs. Covered by checkpoint-failure and retry-same-IDs tests.
- Audio credit: submit blocked + primary disabled + alert + retry control while
  `audioUnavailable`; no listening evidence without playable audio. Covered by
  "blocks listening grading after an audio failure". A labeled non-audio
  alternate remains future work (blocked-with-retry is the honest path).
- P2 resume-from-events: implemented in the mount path (quarantine-aware trail
  rebuild + post-submit screen reconstruction). Covered by "recovers committed
  steps when the checkpoint is missing".
- P2 self-compare: reveal-gated model + self-rating workflow with `model` taint;
  no longer a bare enabled action.
- Registry is exhaustive (`never` guard); legacy renders an explicit
  not-yet-supported note, scene without media falls back to its text alternative.

Added `tests/a11y-lesson-player.test.tsx`: axe with full rules on story initial +
post-feedback, conversation, and listening states — 4/4 pass, no disables.
Fixed a timing race in `RuntimeCourseWorkspace.test.tsx` (asserted enabled before
async evidence load; now `waitFor`).

Full suite at commit: 110 files passed, 1 skipped; 758 tests passed, 1 skipped.
Typecheck clean, eslint 0 errors (1 pre-existing `no-img` warning on the scene
`<img>`, kept: portable/offline editions cannot rely on the Next image optimizer),
`git diff --check` clean. Browser screenshots (390/1280) deferred to Task 7 — the
player has no integrated route to photograph until workspace wiring lands.

## Variety rollout (Hermes, 2026-09-08) — adapter, migration, pilots

- Faithful v1->v2 boundary conversion (`convertExercise`): choice/selection,
  order/ordering (accepted permutations derived from answers; absorbed
  punctuation tokens dropped — placement never graded), cloze/cloze,
  text kinds reuse AnswerSpec. Independent success on converted activities
  keeps legacy credit. Fail-closed on unmappable content (caught real edges:
  single-char option, six French punctuation orders). All 5 languages green.
- `migratePackV1ToV2` + `scripts/migrate-pack-v1-v2.ts`; parity test pins
  identical runtime output. `scripts/content.ts` and portable collection
  version-dispatched; listen tab loads either version.
- Italian migrated to v2; old-engine tests run against French v1.
- Pilot 1 it-food-foundation (story, rev 2): 44-word café story + translation,
  2 evidence questions, event ordering, polite-request transfer.
- Pilot 2 it-requests-foundation (conversation, rev 2): barista dialogue with
  a branched reply (spoiler turn removed after browser QA) + transfer.
- Pilot 3 it-market-foundation (listening): pending ~10-min Al mercato track
  (OpenCode: script+synthesis+QA); lesson activities + Listen tab wire on return.
- Full suite 760 passed / 1 skipped; typecheck clean; content 100%.
