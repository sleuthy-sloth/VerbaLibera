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
