# Varied Lesson Collection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans if available. Hermes leads integration; OpenCode implements the assigned work packages below. If those skills are unavailable in your environment, follow the same explicit task, test, review, and handoff gates in this document. Steps use checkbox syntax for tracking.

**Goal:** Implement eight genuinely different lesson families with typed activities, responsive layouts, durable learning evidence, and authored varied sequences across VerbaLibera's active foundation languages.

**Architecture:** Normalize v1 and v2 course packs at the boundary into an authored step graph with reusable stimuli and typed activities. A deterministic session engine drives family-specific renderers; versioned events distinguish participation, assisted practice, and independent evidence. Keep the existing environment abstraction for hosted, portable, and desktop editions.

**Tech Stack:** Next.js 16.3.3, React 19.2.8, TypeScript, Zod 4, Vitest, Testing Library, Playwright, IndexedDB, existing PostgreSQL event storage, Electron and portable HTML build tooling. Versions observed on 2026-09-08; verify package.json and lockfile at execution time, without opportunistic upgrades.

**Spec:** [2026-09-08-lesson-variety-design.md](../specs/2026-09-08-lesson-variety-design.md). Read the complete spec before work.

## Global Constraints

- Preserve existing user progress, lesson IDs, exercise IDs, account isolation, backup import, and offline operation.
- No runtime AI, speech recognition dependency, generated speech at runtime, or network dependency for core lessons.
- No timers, punitive mechanics, mandatory microphone access, or fixed learning-style labels.
- Keep the Quiet Ink visual language and the existing 760px mobile / 761px desktop boundary.
- Node >=22.13.0; use the repository's installed Next.js, React, TypeScript, Zod, Vitest, and Playwright versions without an unrelated dependency upgrade.
- Read AGENTS.md and the locally installed Next.js documentation before changing framework code.
- Author source content in courses/<language>/manifest.json; generate public/packs output through the existing content build.
- Never treat self-assessment, model reveal, or unavailable media as independently demonstrated mastery.
- Save success is shown only after durable storage confirms the transaction; retain truthful temporary-storage messaging.
- Preserve existing uncommitted work and verify the active checkout before implementing.

## 0. Read this before starting

Observed checkout: `/Users/spkoehl/Documents/ChatGPT/VerbaLibera`, branch `opencode/lesson-variety`, HEAD `d8456ef`. The session's advertised `VoxLibre` directory did not exist. These observations are not permission to discard a newer checkout or switch branches blindly.

Observed dirty files: `scripts/content.ts` and `src/features/course-pack/schema.ts`. Both intersect this plan. Hermes must inspect and preserve their changes, confirm whether OpenCode already owns them, and integrate them into the agreed starting snapshot. Do not reset, stash, commit, or cherry-pick somebody else's unfinished work without coordinating ownership. Worktree creation from HEAD alone will not include these modifications.

`docs/OPENCODE_HANDOFF.md` describes an older Quiet Ink worktree and says the top-level checkout is docs-only. That statement does not match the source tree inspected for this plan. Keep its design history, but resolve checkout paths from live git state. Do not overwrite that historical handoff.

This document is an implementation instruction, not a report that tests passed. No application implementation or test execution was performed while writing it.

## 0.1 Decisions recorded 2026-09-08 (user-approved)

- `shape` enum REVERTED. The uncommitted `shapeEnum` in `schema.ts` and `shapes` counting in `scripts/content.ts` were saved to `2026-09-08-shape-work-superseded.patch` (this directory) and reverted from the tree. V2 `family` is the single taxonomy; do not reintroduce `shape` without a new decision. Working tree is clean except the untracked plan/spec docs.
- Language scope reduced. Only Italian (25 lessons) and French (25 lessons) have foundation depth; Spanish, Portuguese, and German have 1 lesson each (verified 2026-09-08 from course manifests). Task 12 authors the French eight-lesson sequence only. ES/PT/DE sequences are gated on foundation depth; German additionally needs a TTS decision (Kokoro has no German voice; Piper evaluated fit but unwired).
- Listening length direction: new listening lessons target ~10-minute multi-concept tracks (Language-Transfer style, concepts building on each other), not the ~2-minute single-clip pattern. Authoring still follows the voice-sidecar workflow with provenance and STT QA.
- Open UI question (not blocking): user preference for Liquid Glass design philosophy vs the Quiet Ink constraint kept in this plan. Resolve before Task 5/10 layout work; do not expand scope unilaterally.
- Assessment + multi-week study plans (FreeLingo-style) are a separate feature, out of scope here. Placement/study-plan work continues on its own track.

## 1. Hermes / OpenCode operating agreement

**Hermes owns:** task board, contract definitions, v1 migration, progress/storage/sync, content loader integration, shared-file changes, final review, and release evidence.

**OpenCode owns:** activity components, family layouts, component/browser tests for those components, and authored content once the schema is stable. OpenCode must not independently change the shared schema or grading contract to make a renderer easier.

**Shared files are serialized:** `schema.ts`, `CourseWorkspace.tsx`, `progress.ts`, `storage.ts`, `environment.ts`, `scripts/content.ts`, package/lock files, generated packs, and any shared stylesheet. Hermes is their default owner. Transfer ownership explicitly before edits; never have both agents write a shared file simultaneously.

Use isolated worktrees if both agents work concurrently. Hermes records the agreed base commit and integrates one reviewed task commit at a time. If both must use one working directory, restrict concurrency to disjoint assigned files and have Hermes perform all staging/commits. No agent stages the whole repository.

Each assignment includes: task number, base commit, files allowed, contract version, expected behavior, exact checks, and blocked dependencies. Each return includes: commit or patch, changed files, commands with results, screenshots where relevant, unresolved risks, and any requested contract change. Hermes reviews the diff and runs the focused acceptance tests before integrating it.

No external message, deployment, package release, or push is implied by this plan. The user has requested the plan for Hermes and OpenCode; this document does not claim either tool has been launched.

### Dependency schedule

| Wave | Hermes | OpenCode | Gate |
| --- | --- | --- | --- |
| A | Task 1 baseline; Task 2 contracts/adapter | Read spec and inventory existing UI; no shared edits | Contract and fixtures committed |
| B | Tasks 3–4 grading/session and persistence | Tasks 5–6 shell and renderer components using committed fixtures | Both lanes pass focused tests |
| C | Task 7 integrate pilot and environments | Task 8 pilot content and browser coverage | Three-family pilot works end to end |
| D | Task 9 preferences, review, reporting | Task 10 remaining families and content | Eight families available |
| E | Task 11 compatibility/edition checks | Task 12 French sequence and editorial QA | IT + FR sequences accepted; ES/PT/DE gates recorded |
| F | Task 13 full integration review | Fix bounded findings under assigned ownership | Handoff with evidence |

Tasks 8 and 7 converge: pilot fixtures can be authored before integration, but no default pilot activation until both pass. Task 12 can begin after Task 10's contracts freeze; final acceptance waits for Task 11.

## 2. File and responsibility map

New files below are proposed; existing files are named as observed. Do not create a second application or a parallel general-purpose lesson framework.

| Path | Responsibility / owner |
| --- | --- |
| `src/features/course-pack/schema-v2.ts` | Strict authored v2 Zod validation / Hermes |
| `src/features/course-pack/lesson-runtime.ts` | Shared normalized types / Hermes |
| `src/features/course-pack/normalize-pack.ts` | v1/v2 load dispatch and adapters / Hermes |
| `src/features/course-pack/activity-evaluation.ts` | Deterministic typed evaluation / Hermes |
| `src/features/course-pack/lesson-session.ts` | Start, submit, advance, branch, resume / Hermes |
| `src/features/course-pack/attempts.ts` | Event union and evidence projection / Hermes |
| `src/features/course-pack/lesson-preferences.ts` | Preferences and eligible recommendations / Hermes |
| `src/features/course-pack/media-references.ts` | Unified asset traversal / Hermes |
| `src/features/course-pack/LessonPlayer.tsx` | Shared shell + engine wiring / OpenCode, Hermes integration review |
| `src/features/course-pack/activities/ActivityView.tsx` | Exhaustive renderer registry / OpenCode |
| `src/features/course-pack/activities/{Selection,Matching,Ordering,InlineCloze,DialogueChoice,SceneSelection,SelfCompare,TextResponse,Information}Activity.tsx` | Typed controls / OpenCode |
| `src/features/course-pack/layouts/{Discovery,Story,Conversation,Listening,Construction,Scene,Mission,Recall}Layout.tsx` | Family workspaces / OpenCode |
| `src/features/course-pack/lesson-player.css` | Scoped Quiet Ink styles / OpenCode |
| `tests/fixtures/lesson-variety.ts` | Small complete valid authored fixtures / Hermes initial, then serialized changes |
| `tests/{lesson-schema-v2,lesson-normalize,activity-evaluation,lesson-session,lesson-attempts,lesson-preferences}.test.ts` | Runtime and migration / Hermes |
| `tests/{LessonPlayer,LessonActivities,LessonLayouts}.test.tsx` | Behavior and accessibility / OpenCode |
| `tests/e2e/lesson-variety.spec.ts` | User journeys / OpenCode |
| `docs/superpowers/verification/2026-09-08-lesson-variety.md` | Results, screenshots, limitations / Hermes |

Existing seams: `ExerciseView.tsx`, `DialogueView.tsx`, `GlossedText.tsx`, `answer.ts`, `progress.ts`, `storage.ts`, `sync.ts`, `environment.ts`, `hosted-environment.ts`, `portable-environment.ts`, `CourseWorkspace.tsx`, `HostedCourseWorkspace.tsx`, `src/app/api/course-progress/route.ts`, `scripts/content.ts`, `scripts/portable/build.ts`, `scripts/portable/verify.ts`, `public/sw.js`, `src/features/listen/tracks.ts`. Read their consumers before changing exported types. Keep the separate curriculum/session engine under `src/features/session` working; do not conflate its Prisma DrillItem IDs with foundation exercise IDs.

## 3. Contract to freeze in Task 2

The following TypeScript describes the required public shape, not a replacement for runtime validation. Export these types from `lesson-runtime.ts`; derive authored types from Zod where practical.

```ts
export type Family = 'discovery' | 'story' | 'conversation' | 'listening'
  | 'construction' | 'scene' | 'mission' | 'recall';
export type Skill = 'reading' | 'listening' | 'writing' | 'speaking'
  | 'grammar' | 'vocabulary';
export type Assistance = 'hint' | 'translation' | 'transcript' | 'model';
export type Response =
  | { kind: 'text'; text: string }
  | { kind: 'selection'; ids: string[] }
  | { kind: 'ordering'; ids: string[] }
  | { kind: 'matching'; pairs: Array<{ leftId: string; rightId: string }> }
  | { kind: 'cloze'; values: Record<string, string> }
  | { kind: 'self'; rating: 'again' | 'comfortable' }
  | { kind: 'continue' };
export type Evaluation = {
  outcome: 'correct' | 'incorrect' | 'self-assessed' | 'ungraded' | 'blocked';
  independent: boolean;
  feedback: string;
};
export type Step = {
  id: string;
  purpose: 'notice' | 'predict' | 'explain' | 'practice' | 'transfer' | 'reflect';
  activityId: string;
  required: boolean;
  nextStepId: string | null;
  branches?: Record<string, string>; // selected option ID -> successor
  supportActivityId?: string; // optional help, then return to this step
};
export type CompletionPolicy =
  | { kind: 'legacy-success'; exerciseIds: string[] }
  | { kind: 'participation' }
  | { kind: 'evidence'; targets: Array<{ evidenceKey: string; successes: number }> };
```

`RuntimePack`: metadata and source `schemaVersion: 1 | 2`, legacy `exercisesById`, `lessons`, `activities`, `stimuli`, concepts, vocabulary, units, media, dialogues. Use arrays in JSON and construct maps at runtime. `RuntimeLesson`: stable legacy metadata plus positive integer `revision`, `family`, positive `estimatedMinutes`, `entryStepId`, `steps`, `completionPolicy`, and prerequisites carrying lesson ID plus participation/evidence requirement. The v1 adapter maps prerequisites to legacy-success.

`Activity` is a discriminated union keyed by `kind`. Every graded variant carries `id`, positive `revision`, `conceptIds`, `vocabulary`, `skills`, optional `stimulusId`, `prompt`, `hints`, `feedback`, and `evidenceKey`. Information and self-comparison omit independent evidence keys. Add `assistanceAffectsEvidence: Assistance[]`; model always affects evidence on graded activities. Never allow authors to mark model reveal as independent.

| Activity kind | Payload | Response / assessment |
| --- | --- | --- |
| legacy | `exerciseId` plus normalized embedded `exercise: Exercise` | Existing renderer/answer semantics; wrapped evidence |
| information | `body` | continue / ungraded |
| text | existing `AnswerSpec` | text / call existing `evaluateAnswer` |
| selection | `options: {id,text}[]`, `acceptedIds`, `multiple` | selection / exact set equality |
| ordering | `tokens: {id,text}[]`, `acceptedOrders: string[][]` | ordering / exact allowed order; duplicate words have distinct IDs |
| matching | `left`, `right` labeled IDs; `acceptedPairs` | matching / pair-set equality |
| cloze | `segments` containing text or named blank; answer spec per blank | cloze / evaluate each named blank |
| dialogue-choice | options with ID, text, feedback; `acceptedIds` | selection / authored correctness; step branch by selected ID |
| scene-selection | scene stimulus reference; `acceptedRegionIds` | selection / region-set equality |
| self-compare | model text, optional audio | self / self-assessed |

Stimulus union: `text` (body, optional translation), `examples` (target/meaning pairs), `audio` (mediaId), `dialogue` (speaker-labeled turns with optional mediaId), `scene` (mediaId, meaningful alt, labeled regions with normalized x/y/width/height, text alternative). Audio/image assets have ID, kind, local URL, SHA-256, attribution; audio additionally has transcript. Preserve old audio entries through normalization. Reject path traversal, external URLs, unsupported types, non-finite coordinates, and regions outside [0,1]. Sanitize rendered text; never render authored HTML unsafely.

Validation invariants: unique IDs; resolvable references; reachable entry and terminal steps; no cycles; branches only on single-select dialogue choices; valid option targets; support is not a hidden required step; valid answer payloads; bounded text/collection sizes; taught concept and vocabulary references; required evidence reachable along every permitted terminal path. Legacy exercises retained for migration may be intentionally unused by a v2 sequence. Newly authored orphaned activities/stimuli are errors. Asset-use scanning covers legacy and new paths.

## 4. Tasks

### Task 1 — Establish the safe starting point (Hermes)

**Files:** read `AGENTS.md`, `package.json`, current dirty files, current handoffs. Create the verification report listed above.

- [ ] Run `git status --short`, `git branch --show-current`, `git rev-parse HEAD`, and `git worktree list`; record actual values and dirty-file ownership.
- [ ] Read both dirty diffs. Incorporate already finished variety work into the inventory; do not duplicate it.
- [ ] Read local Next documentation as required and review tests that mandate every lesson starts with `-meet` word-choice. Preserve the day-zero safety intent, but scope that legacy contract to v1; new families must be allowed different openings.
- [ ] Record baseline results with `npm run typecheck`, `npm test -- tests/course-pack.test.ts tests/lesson-path.test.ts tests/portable-environment.test.ts`, and `npm run content:validate`. Existing failures must be listed with evidence, not silently attributed to this work.
- [ ] Agree base snapshot/worktrees and record assignments. Commit only the newly authored tracking report if appropriate.

**Gate:** Hermes and OpenCode share the same contract baseline and no dirty change is lost.

### Task 2 — Schema, fixtures, and v1 adapter (Hermes)

**Files:** create `schema-v2.ts`, `lesson-runtime.ts`, `normalize-pack.ts`, fixture and schema/normalize tests. Preserve existing `schema.ts` behavior until caller migration.

**Interfaces:** `normalizePack(raw: unknown): RuntimePack`; `validateV2Pack(raw: unknown): AuthoredV2Pack`. Export both types. `AuthoredV2Pack` is the Zod inference; `RuntimePack` is the normalized type from section 3.

- [ ] Write valid minimal v2 fixtures for story, conversation, and listening in `tests/fixtures/lesson-variety.ts`; export `makePilotPack()` and `makeLegacyRawPack()` (the latter reads the existing Italian manifest before edits or a committed v1 fixture).
- [ ] Add schema regressions including missing branch, graph cycle, duplicate token IDs, unknown media, unsupported version, and invalid assessment payload. Example:

```ts
it('rejects a branch that cannot reach a real step', () => {
  const raw = makePilotPack();
  raw.lessons[1].steps[0].branches = { 'reply-order': 'missing-step' };
  expect(() => normalizePack(raw)).toThrow(/step|branch/i);
});
it('keeps v1 exercise identities for progress replay', () => {
  const raw = makeLegacyRawPack();
  const p = normalizePack(raw);
  expect(Object.keys(p.exercisesById).sort()).toEqual(
    raw.lessons.flatMap(l => l.exercises.map(e => e.id)).sort());
});
```

- [ ] Run `npm test -- tests/lesson-schema-v2.test.ts tests/lesson-normalize.test.ts` and confirm failures expose missing behavior.
- [ ] Implement explicit version dispatch. Adapt every old lesson to an information step followed by legacy exercise activities. Default its family to discovery; do not claim the metadata alone implements a story or conversation.
- [ ] Preserve optional exercises and completion rules. Preserve audio hash checks and coming-soon empty-pack validation. Do not mechanically raise the CEFR range without authored content.
- [ ] Run focused tests plus `tests/course-pack.test.ts` and typecheck. Scope the `-meet`-first pin in that file to v1 packs here (Task 7 updates the affected e2e walks). Commit contracts and fixtures; send OpenCode the commit and ownership map.

### Task 3 — Evaluation and deterministic session engine (Hermes)

**Files:** `activity-evaluation.ts`, `lesson-session.ts`, associated tests.

**Interfaces:** `evaluateActivity(activity: Activity, response: Response, assistance: Assistance[]): Evaluation`; `startLesson(pack: RuntimePack, lessonId: string): LessonSession`; `submitResponse(pack: RuntimePack, state: LessonSession, response: Response, assistance: Assistance[]): LessonSession`; `advanceLesson(pack: RuntimePack, state: LessonSession): LessonSession`.

Define/export `LessonSession` with lesson ID/revision, active step ID, visited step IDs, selected branches, draft response, accumulated assistance, current evaluation, completed step IDs, and status `active | complete`. A submission evaluates; advancing requires the caller's durable event write first. Reducers do not perform storage, clocks, or random ID generation.

- [ ] Write tests for repeated word tokens, wrong response variants, pair matching, branch choice, no advancement before evaluation, and self-comparison. Example:

```ts
it('does not credit a revealed answer independently', () => {
  const p = normalizePack(makePilotPack());
  const a = p.activities.find(a => a.id === 'it-cafe-order-text')!;
  expect(evaluateActivity(a, {kind:'text', text:'Un caffè, per favore.'}, ['model']))
    .toMatchObject({outcome:'correct', independent:false});
});
```

- [ ] Run `npm test -- tests/activity-evaluation.test.ts tests/lesson-session.test.ts` and confirm the expected failures.
- [ ] Use exhaustive variant switches and existing text normalization. Reject duplicate IDs in submitted selection/order responses instead of accepting a misleading set conversion. Text cloze assesses every named blank.
- [ ] On incorrect response allow retry or supported continuation according to completionPolicy; never synthesize successful evidence. Branch selection follows the selected authored reply after feedback. Support returns to the current step and carries assistance into retries.
- [ ] Calculate required participation over the actual valid path, with shared required steps guaranteed by validation. A terminal branch must not make unvisited alternate branches mandatory.
- [ ] Run focused tests and typecheck; commit with contract changes documented.

### Task 4 — Events, migration, backup, sync, and resume (Hermes)

**Files:** `attempts.ts`; modify `progress.ts`, `storage.ts`, `sync.ts`, `environment.ts`, `portable-environment.ts`, `src/app/api/course-progress/route.ts` and their existing tests. Locate backup export call sites with `rg 'format: 1|decodeBackup|JSON.stringify' src/features/course-pack`.

**Interfaces:** `LearningEvent = PracticeEvent | ActivityAttempt | StepCompletion`; `mergeLearningEvents(...collections: LearningEvent[][]): LearningEvent[]`; `projectLessonEvidence(pack: RuntimePack, events: LearningEvent[]): LessonEvidence`; preserve the legacy APIs until callers are migrated.

Define `ActivityAttempt` with `eventVersion:2`, `type:'attempt'`, id, packId/version, lessonId/revision, stepId, activityId/revision, evidenceKey when graded, response, assistance, evaluation, at. `StepCompletion` has `eventVersion:2`, `type:'step-completed'`, id, packId/version, lessonId/revision, stepId, optional selectedBranchId, optional attemptId, at. Validate that a graded step completion references a matching attempt. `LessonEvidence` includes participation-completed lesson IDs, legacy completion credits, per-evidence-key SRS, and independent skill counts.

- [ ] Write tests before implementation: v1 import preserved byte-for-byte at object level; mixed event round trip; duplicate idempotency; conflicting ID atomic rejection; unknown-version rejection; scope isolation; revealed-answer reload; and changed-revision quarantine. Assert no old row is overwritten.
- [ ] Run `npm test -- tests/lesson-attempts.test.ts tests/portable-environment.test.ts tests/course-sync-api.test.ts`.
- [ ] Implement format-two backup envelopes and a decoder accepting formats one and two. Keep input byte/event limits. Format-one imports never invent completion events. Do not normalize old stored events by adding fields that change their conflict identity.
- [ ] Store attempts and associated step completion atomically. Compute progress from committed events. Persist local checkpoint/draft separately per account, pack, lesson, revision; do not export unfinished draft text by default. Increment IndexedDB version only if adding stores, with upgrade tests preserving the events store.
- [ ] Preserve old completion by projecting legacy events over retained legacy exercise metadata. If content meaning changes, assign a new evidence key; old evidence remains exportable and never grades the new target. Already unlocked lessons remain unlocked.
- [ ] Extend sync pagination/envelopes and API validation together. Keep eventVersion in payload JSON of `FoundationPracticeEvent`; avoid a Prisma migration unless the inspected repository now requires one. Deploy compatibility requires reader support before new writers; old clients must reject v2 explicitly, not strip fields.
- [ ] Resume validates lesson revision and graph. If incompatible, restart that lesson's active session with an explanation while preserving attempts and completion credits. Media failure is a blocked outcome, not an incorrect answer or a lapse.
- [ ] Repeat focused tests plus existing account-sync and storage tests. Commit. Hand OpenCode a persistence adapter example.

### Task 5 — Lesson shell and initial family layouts (OpenCode)

**Files:** `LessonPlayer.tsx`, `lesson-player.css`, Story/Conversation/Listening layouts, `tests/LessonPlayer.test.tsx`, `tests/LessonLayouts.test.tsx`.

**Interfaces:** `LessonPlayer({pack, lessonId, environment, onExit})`; types are `RuntimePack`, string, existing `CourseEnvironment` after Hermes' agreed extension, and `() => void`. Until Task 4 merges, use a test adapter, never a second production store. Layouts consume context and activity React nodes; they do not grade or persist.

- [ ] Write behavior tests for context retention, one progress indicator, no generic preamble in story, no autoplay, focus after advance, and save failure keeping the current response.
- [ ] Run `npm test -- tests/LessonPlayer.test.tsx tests/LessonLayouts.test.tsx` and confirm targeted failures.
- [ ] Implement shell and the three distinct layouts. Desktop context/activity split is 40/60; mobile at <=760px stacks, with labeled context disclosure. Reuse existing Quiet Ink tokens and gloss components; keep CSS scoped under `.lesson-player`.
- [ ] Implement save → commit local state → advance sequencing. A failed save exposes retry without generating a new logical event ID; temporary storage remains labeled temporary.
- [ ] Add an accessible status region for feedback, heading focus, a back action preserving checkpoint, and explicit transcript reveal. Verify model text never leaks via accessible labels before reveal.
- [ ] Run component tests and typecheck. Capture initial 390px and 1280px screenshots for Hermes review; commit only assigned files.

### Task 6 — Core typed activities (OpenCode)

**Files:** `activities/ActivityView.tsx`, Selection, Ordering, Matching, InlineCloze, DialogueChoice, TextResponse, Information components; `tests/LessonActivities.test.tsx`.

**Interfaces:** all receive `{activity: Activity, response: Response | null, disabled: boolean, onChange(response: Response): void, onAssist(kind: Assistance): void}` plus resolved stimulus/media only where required. Narrow the discriminated activity type inside each component. The exhaustive registry reports unsupported activities clearly.

- [ ] Write interaction tests using userEvent. Example assertion after choosing a labeled option:

```tsx
await user.click(screen.getByRole('radio', {name:'Un caffè'}));
expect(onChange).toHaveBeenLastCalledWith({kind:'selection', ids:['coffee']});
```

- [ ] Test two identical visible tokens can be independently placed and removed, blank labels are unique, matching is keyboard usable, and a new activity clears the old response/feedback.
- [ ] Run `npm test -- tests/LessonActivities.test.tsx` before and after implementation.
- [ ] Implement variant-specific controls; use radio/checkbox groups, named blank inputs, selectable pair lists, and add/remove/move token buttons. Do not introduce a drag library.
- [ ] Dialogue choices send stable IDs; textual production is a subsequent text activity. Branch feedback is authored and factual. Existing legacy exercises keep their existing renderer until migrated through an explicit wrapper.
- [ ] Run jest-axe checks on the major activity states and typecheck; commit the component work package.

### Task 7 — Loaders, workspace integration, and pilot activation (Hermes)

**Files:** `CourseWorkspace.tsx`, environment implementations, `HostedCourseWorkspace.tsx`, offline/portable entry modules and content tooling consumers as discovered by `rg 'validatePack|CoursePack|loadPack' src scripts`.

- [ ] Add loader integration tests proving old packs still open and a v2 lesson launches its own sequence. Keep legacy reference tabs, dialogues, downloads, and account controls functional.
- [ ] Run focused loader/workspace tests to expose missing normalization.
- [ ] Normalize once at each pack load boundary. The normalized legacy activity embeds the validated exercise so the evaluator needs no pack lookup; authored JSON keeps only exerciseId. Keep consumers needing legacy fields on an explicit compatibility view rather than pervasive unchecked casts.
- [ ] Route v2 lessons into LessonPlayer; retain old player for v1 during rollout. Remove duplicate practice progress indicators only in the integrated path. Wire course completion/review copy to the correct projection.
- [ ] Incorporate Task 8 pilot content behind an explicit development/pilot selection until edition checks pass; record its access path in the verification report. Do not use a hidden production-only flag that prevents portable parity.
- [ ] Run `npm run content:validate`, typecheck, existing course-pack and thinking-lesson tests plus the pilot browser test. Commit integration after both workers' changes pass together.

### Task 8 — Three-family Italian pilot (OpenCode)

**Files:** `courses/italian/manifest.json`; associated audio/provenance only if necessary; `tests/e2e/lesson-variety.spec.ts`. Author source only; Hermes owns generated build output.

- [ ] Pick three existing Italian lessons with appropriate prerequisites to receive story, conversation, and listening sequences. Keep IDs and legacy exercises; add v2 activities with new stable IDs. If café vocabulary is absent, introduce it within the existing vocabulary budget and validate prerequisites instead of bypassing them.
- [ ] Author a 40–70-word café story, three evidence/sequence questions, and one independent response; a finite conversation with two meaningful reply branches and a shared closing transfer task; and listening gist, distinction, reconstruction, and transcript comparison using real matching audio.
- [ ] Include the fixture text activity `it-cafe-order-text` with accepted `Un caffè, per favore.` in the test fixture contract; production IDs may follow existing lesson naming conventions.
- [ ] Write an end-to-end journey that completes a story, enters a dialogue branch, reloads and resumes that branch, completes a listening question, then reveals the transcript and verifies assisted evidence. Assert each family has a distinct visible structure.
- [ ] Run `npm run content:validate` and `npm run test:e2e -- tests/e2e/lesson-variety.spec.ts`. New audio follows the voice-sidecar workflow (venv with `HF_HUB_OFFLINE=1`, batch manifest, `reconcile_provenance.py`, faster-whisper exact-match QA); validate audio hashes and listen manually; never claim a transcript alone is listening QA. The listening pilot targets the ~10-minute multi-concept pattern per §0.1.
- [ ] Return content changes, exact lesson IDs, screenshots, audio review notes, and test results. Pilot success unlocks the remaining families; it does not complete this plan.

### Task 9 — Preferences, review selection, and authoring reports (Hermes)

**Files:** `lesson-preferences.ts`, `progress.ts`, `scripts/content.ts`; scoped preferences UI component assigned exclusively before editing; preference tests.

**Interfaces:** export `PracticePreferences` with fields in the spec, `rankEligibleLessons(pack: RuntimePack, evidence: LessonEvidence, preferences: PracticePreferences): string[]`. Eligibility is calculated before preference ranking. Stable tie-break uses authored course order.

- [ ] Add tests showing preference changes cannot unlock unmet prerequisites, remove due review, or upgrade a reading fallback to listening evidence.
- [ ] Implement per-profile local preferences with schema defaults and “Practice options” UI. If audio is unavailable, offer an authored alternate; preserve unmet listening evidence. No microphone prompt or recording pipeline.
- [ ] Update review selection to use independent evidence keys and preserve existing SRS scheduling. Optional mode preferences may adjust ordering, never delete due targets. Self-comparison remains outside independent SRS success.
- [ ] Extend existing content commands to traverse normalized activities and report family counts, response types, repeated runs, answer reuse, and production opportunities. Implement thresholds from the spec as warnings with an authored rationale override. Graph/reference violations remain hard errors.
- [ ] Run `npm test -- tests/lesson-preferences.test.ts tests/lesson-attempts.test.ts`, `npm run content:stats`, `npm run content:coverage`, and `npm run content:duplicates`; inspect actual reports and commit.

### Task 10 — Remaining five families and Italian collection (OpenCode)

**Files:** Discovery/Construction/Scene/Mission/Recall layouts, SceneSelection/SelfCompare activities, component tests, Italian manifest, local scene assets and attribution.

- [ ] Add tests for discovery prediction before explanation, construction substitutions with independent transfer, scene keyboard region selection, mission checklist persistence, and recall repair using a new item.
- [ ] Implement each family using the existing engine and typed activities. Mission checklist reflects committed step completion, not UI-only toggles. Recall branches to targeted support only when appropriate; a retry does not erase a prior failure.
- [ ] Implement self-comparison with optional model audio, reveal, and self-rating. Do not present it as pronunciation scoring.
- [ ] Author the other five Italian lessons: paired-pattern discovery; sentence construction; a café menu scene; an order-and-price mission; and later recall of the same concepts with different sentences. Use an original static SVG/PNG/menu asset and verified attribution; include accessible text and local asset hashes.
- [ ] Add fallback tests for unavailable scene/audio assets and text alternatives with correct skill labels. Required unavailable media can be skipped as blocked, never passed.
- [ ] Run component tests, typecheck, content validation, and the expanded variety browser journey. Provide screenshots for all eight families at mobile/desktop sizes; commit assigned files.

### Task 11 — Media, offline, portable, and desktop compatibility (Hermes)

**Files:** `media-references.ts`, `storage.ts`, `scripts/content.ts`, `scripts/portable/build.ts`, `scripts/portable/verify.ts`, `public/sw.js` (bump `STATIC_CACHE` + pinned asset list whenever referenced assets change — required, not optional), existing portable/offline/desktop tests.

**Interfaces:** `collectMediaReferences(pack: RuntimePack): string[]` returns deduplicated asset IDs used by legacy exercises, stimuli, dialogue turns, and self-comparison. All build/install validators consume this same traversal.

- [ ] Add regressions for story-only audio, scene images, corrupt hashes, interrupted installation, portable embedded asset resolution, and mixed-event backup round trips.
- [ ] Implement unified media traversal and embed/cache all referenced assets. Remove the dictation-only orphan/audio-use assumption for v2 while retaining reference integrity. No runtime external font/image/audio requirement in portable output.
- [ ] Preserve atomic offline install and old ready cache until new installation completes; test failed media download leaves the installed course available. Ensure service worker caches don't return stale v1 content with a v2 version label.
- [ ] Run `npm run portable:build`, `npm run portable:verify`, `npm run test:e2e:portable`, and `npm run test:e2e -- tests/e2e/offline.spec.ts tests/e2e/foundation-sync.spec.ts`.
- [ ] Run `npm run desktop:compile`; run the repository's Electron test configuration on a compatible Mac using the inspected config and artifact prerequisites. Verify local profile isolation, reopen/resume, and no non-loopback requests in local mode. If hardware/artifacts are unavailable, record that exact unverified gate; do not mark desktop acceptance passed.
- [ ] Add explicit old-client compatibility tests. Version-one applications are not expected to consume v2 packs; preserve previous release downloads and reject unsupported new pack versions clearly. Commit integration evidence and source changes only.

### Task 12 — French eight-lesson sequence; ES/PT/DE gated (OpenCode; Hermes accepts)

**Files:** `courses/french/manifest.json`, needed verified local media/provenance, `docs/lesson-variety-authoring.md` (new), language-specific content tests. Do NOT touch `courses/{spanish,portuguese,german}/` in this task: those packs have 1 lesson each and are gated on foundation depth (German additionally gated on a TTS decision — Kokoro has no German voice).

- [ ] Document a complete authoring example with a stimulus, typed activity, step graph, completion policy, assistance handling, and validated media reference. Include the no-repeated-preamble rule and the report thresholds.
- [ ] Select eight suitable existing French lessons and assign all eight families in a coherent prerequisite order. Preserve lesson IDs and legacy exercise collections. Introduce new vocabulary within constraints; keep day-zero learners supported with words/examples before unaided sentence production. New listening audio follows the voice-sidecar workflow (venv with `HF_HUB_OFFLINE=1`, batch manifest, `reconcile_provenance.py`, faster-whisper exact-match QA); new listening lessons target the ~10-minute multi-concept pattern per §0.1.
- [ ] Author natural French prompts, accepted variants, feedback, branches, and transfer tasks. Check gender, articles, agreement, word order, register, and regional variants deliberately. Do not copy token order or culturally specific café assumptions mechanically from the Italian pilot.
- [ ] Run validation, audio-check, duplicates, and coverage after authoring. Assert that every terminal path has valid completion criteria. Keep exceptions explicit and pedagogically justified.
- [ ] Record reviewer identity/method and reviewed lesson IDs. If reliable language or audio review is unavailable, leave the affected new sequence out of default release selection and report the blocked content gate while completing unaffected work. Do not claim the entire feature complete.
- [ ] Smoke-test one new lesson per family plus one full French sequence. Return per-language commits for Hermes review.

### Task 13 — Final integrated verification and handoff (Hermes)

**Files:** verification report; README/course-authoring documentation where behavior changed; tests only for concrete regressions discovered during review.

- [ ] Review all changes against the spec and dirty-work baseline. Ensure every family changes the sequence and interaction, not just title, CSS class, or icon.
- [ ] Run the suite below once after integration; repeat only checks affected by subsequent fixes. Record command, commit, exit status, summary, and any environment limitation.

```sh
npm run content:validate
npm run content:audio-check
npm run content:coverage
npm run content:duplicates
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm run test:e2e:webkit
npm run portable:build
npm run portable:verify
npm run test:e2e:portable
npm run desktop:compile
git diff --check
```

- [ ] Inspect actual screenshots at 390×844 and 1280×900, plus 760px/761px breakpoint checks. Test keyboard-only navigation, screen-reader labels, 200% zoom, no page overflow, reduced motion, and focus after feedback/advance. Automated accessibility checks supplement visual/manual inspection.
- [ ] Complete the acceptance matrix below and the compatible-Mac Electron gate from Task 11. Do not equate desktop compilation with installed desktop verification.
- [ ] Review generated outputs for accidental secrets, caches, binary build artifacts, and unrelated modifications. Stage named task files only. Keep pre-existing changes intact.
- [ ] Deliver a concise implementation summary with commits, eight-family coverage per language, verified editions, migration behavior, screenshots, exact remaining blockers, and launch/test instructions. Leave deployment and publishing untouched unless separately authorized.

## 5. Acceptance matrix

| Scenario | Required observation |
| --- | --- |
| Existing v1 lesson and backup | Same IDs, old success-based progression, no lost events |
| Existing completed lesson becomes v2 | Remains unlocked/completed by legacy credit; new practice offered |
| Story | Persistent context; evidence selection/sequence; explanation appears when authored |
| Conversation | Finite branches; feedback per reply; reload restores chosen branch |
| Listening | Real audio; usable replay; transcript changes evidence to assisted |
| Discovery / construction | Predict before reveal; manipulate form; independent transfer |
| Scene | Keyboard-selectable regions; meaningful text alternative |
| Mission | Goal and committed checklist persist across steps/reload |
| Recall | Old due evidence retrieved; targeted repair; new independent item |
| Save error / repeated retry | No false saved state and no duplicate logical event |
| Assistance then reload | Assistance persists; no falsely independent attempt |
| Imported duplicate / conflicting event | Idempotent duplicate; atomic conflict rejection |
| New content revision | No old answer evidence silently applied to changed target |
| Account switch | No cross-account progress, draft, or preference leakage |
| Missing audio / offline | Honest blocked or labeled alternate task; no false listening pass |
| Portable file | No network dependency; embedded media works; backup round trip |
| Desktop local | Installed app resumes and isolates profiles; no external requests |
| Italian + French | Reviewed eight-family sequence in each; correct prerequisites |
| Spanish / Portuguese / German | Explicitly gated: foundation depth (all three) + TTS decision (German); no sequence claimed |

## 6. Ready-to-paste worker instructions

### Hermes startup prompt

Read `docs/superpowers/specs/2026-09-08-lesson-variety-design.md` and `docs/superpowers/plans/2026-09-08-lesson-variety.md`. Implement this plan as integration lead alongside OpenCode. First verify the checkout, branch, worktrees, and dirty-file ownership: the inspected branch was `opencode/lesson-variety`, with existing edits in `scripts/content.ts` and `src/features/course-pack/schema.ts`. Preserve them. Own contracts, migration, persistence, shared files, and acceptance. Assign OpenCode only the current dependency-ready work package with explicit allowed files and frozen interfaces. Complete all eight families and the active-language sequences; the three-family pilot is only a checkpoint. Keep checks and evidence in the verification report. Do not deploy or claim unrun tests passed.

### OpenCode startup prompt

Read `docs/superpowers/specs/2026-09-08-lesson-variety-design.md` and `docs/superpowers/plans/2026-09-08-lesson-variety.md`. Work alongside Hermes on the assigned renderer/layout/content package. Confirm the base commit, allowed files, and schema contract before editing. Preserve existing dirty work, especially the current schema/content changes. Use the shared runtime and grading APIs; request a contract change instead of inventing a parallel schema or store. Implement accessible, distinct family workspaces in Quiet Ink and author valid offline content. Return a task-scoped commit or patch, exact test results, screenshots, and unresolved issues. Do not change Hermes-owned shared files or publish anything.
