# Codex review and continuation of Hermes / OpenCode lesson work

Date: 2026-09-08. Reviewed branch `opencode/lesson-variety`, starting HEAD `67bf2e5`.

## State and ownership

Hermes committed Tasks 1–4, including schema/normalization, evaluation/session reducers, and event/storage/sync work. OpenCode's Tasks 5–6 player, activity components, layouts, stylesheet, and activity tests were untracked. An active OpenCode Wave B process and files appearing during inspection confirmed ongoing UI authoring. Codex did not edit or commit those files. The user was asked whether to pause that work; no pause was assumed.

This continuation fixes the committed runtime and persistence and adds the missing account-bound hosted lesson store. It does not activate new content, complete Task 7, or certify the unfinished UI. No commits, deployment, or publication were performed. All changes remain in the local repository for integration.

Honor the later scope decisions in plan §0.1: Italian and French first; Spanish/Portuguese/German expansion is gated. Do not reinstate the superseded shape taxonomy. Resolve the existing visual-direction question before further styling; this review changed no styling.

## Confirmed defects fixed

1. **Mixed-version synchronization failed.** `pullPractice` returns one paginated event stream, but sync parsed `events` as v1-only. The client now validates the complete page, splits by version, persists to the appropriate stores, and avoids reuploading known events. A regression reproduced the old failure with one v1 row and one v2 attempt.
2. **Unsupported versions could be silently stripped.** A v1-first Zod union accepted hybrid versioned payloads as v1. Parsing now dispatches by version/type before stripping fields. The same rule applies in legacy and mixed backup arrays; unknown versions cause explicit failure before persistence.
3. **Incorrect or unrelated attempts could grant progress.** Projection now checks lesson/step/activity association, revision, authored evidence key, and evaluator agreement. Invalid records are quarantined instead of credited. Completion validates its attempt, chronology, outcome, and chosen branch. Missing branch resolution cannot shorten the path into a completed lesson.
4. **Migrating a completed lesson could remove old credit.** The new runtime field `legacyCompletionExerciseIds` preserves the original required exercise set independently of the new participation/evidence policy. The v1 adapter derives it excluding optional exercises. A v2 migration retaining old exercises must specify it, or derive it from a matching legacy-success policy. References and duplicate/conflicting sets are rejected. Independently successful valid v2 legacy attempts also count toward this preserved legacy requirement.
5. **Support could accidentally complete a graded step.** Opening support records assistance. Returning from support clears its evaluation without treating it as the parent response. A failed resubmission cannot retain a stale completed-step flag.
6. **Matching IDs could collide.** Matching comparison uses unambiguous pair encoding rather than joining IDs with a delimiter that IDs themselves may contain.
7. **Portable storage failures hid durable history.** The durable lesson store no longer switches to an empty memory store after a read/write failure or conflict. Errors remain visible and retries address the same durable store. Checkpoint connections close on success and failure. Initial capability detection may still select temporary storage as designed.
8. **The memory adapter accepted conflicts and leaked mutable references.** It now validates/merges events idempotently, rejects conflicting IDs, validates checkpoints, and clones values at its boundaries.
9. **Hosted lesson persistence was unwired.** `createHostedEnvironment(scope)` now supplies a lesson store bound to that scope. `HostedCourseWorkspace` memoizes the environment per account and retains its existing scope key. A previously captured store remains bound to its original account after switching.
10. **Pure validators triggered React hook lint rules.** Renamed `useMedia` and `useStimulus` helpers to validation names. They are ordinary functions, not hooks.

## Contract addition for Hermes / OpenCode

Normalized `RuntimeLesson` now requires:

```ts
legacyCompletionExerciseIds: string[];
```

Authored v2 accepts this field optionally for new lessons without retained legacy content. When migrating a v1 lesson, copy its original exercises and explicitly populate the field from exercises not listed in its original optionalExerciseIds. Do not infer that every retained exercise used to be required. For a legacy-success policy, its exerciseIds must match this field exactly as a set. New participation/evidence policies may have different new targets without erasing the old completion requirements.

The account store is now available through `createHostedEnvironment(scope).lessonPractice`. Do not replace it with a global mutable account selector or a production memory adapter. The player still needs its own asynchronous scope-change guards before activation.

## Remaining UI blockers: read-only findings in active OpenCode work

Line locations refer to the inspected LessonPlayer.tsx and may move as OpenCode continues. Reverify each against its final returned patch.

- **P1 — Assistance leakage between steps.** Context is retained by stimulus ID (around 973), but assistance is cleared when advancing (around 795). A visible translation/transcript can remain available while the next correct answer is recorded independently. Persist stimulus-level reveal state and apply its taint to every affected step; add a story-info → reveal → next → correct-answer regression. Reload must preserve that taint too.
- **P1 — Async account/lesson state races.** The effect around 492 resets some fields but does not clear the old session immediately. Save completion callbacks lack a scope/generation guard. Switching accounts/lessons while an async save resolves must not restore an old session in the new view. Existing keyed hosted remount helps but should not be the only protection in a reusable player.
- **P1 — Lost checkpoints on exit/reload.** `saveCheckpoint` catches failures around 619; explicit exit around 814 proceeds. Draft/assistance changes are not saved immediately, so revealing then reloading can lose assistance. Failed explicit save/exit must keep the current screen and offer retry. Preserve event IDs on retry.
- **P1 — Unavailable audio can still receive listening credit.** AudioContext around 270 has no error state or blocked grading path. A failed recording must present retry or a clearly labeled alternative without granting listening evidence.
- **P2 — Resume without a checkpoint ignores committed events.** Existing completion events are not used when a checkpoint is absent. Recover from committed events after a crash between event commit and checkpoint write.
- **P2 — Self-comparison is incomplete.** Its primary action is enabled without a complete supported renderer/response workflow. Keep it unavailable until an honest model-reveal/self-rating path exists.
- **Lint blockers.** Current player has three errors: ref write during render around 467, synchronous state reset in effect around 497, and another state-setting effect around 574. Fix through lifecycle/state ownership rather than disabling the rules.

## Verification actually run

- Initial focused baseline: 60 tests passed in 6 files.
- Full unit/component suite during integration: **730 passed, 1 skipped**, 103 passed test files and 1 skipped file. This included the in-progress activity tests, but not a completed LessonPlayer browser journey.
- After final backup/legacy-contract additions: **54 passed in 6 focused files**, covering backups, normalization, attempts, persistence, sync, and API.
- Final runtime-agent focused suite: **41 passed** before the final backup/contract checks above.
- `npm run typecheck`: passed after final source/test changes.
- `npm run content:validate`: passed; output at `/private/tmp/verbalibera-review-content-validation.log`.
- Targeted ESLint over all files changed by this continuation: passed without errors or warnings.
- `git diff --check`: passed.
- Full repository lint was run and failed. Ten errors in the normalizer were fixed; three remain in OpenCode's active player, which was inspected separately. Other unrelated warnings remain. Do not report full lint as passing.
- Production build, browser E2E, portable artifact rebuild, and installed Electron acceptance were not run in this review. The player is not integrated and content has not been activated.

## Next work, in order

1. Let OpenCode return Wave B or explicitly pause it before taking over its files. Apply the UI blockers above with regression tests.
2. Integrate the completed player through the workspace and normalized loaders (Task 7), using the account-bound lesson store. Do not pass v2 content into the old v1 validator or assume CourseEnvironment.loadPack already returns RuntimePack; that boundary still needs its planned migration.
3. Migrate backup UI/export/import to the mixed envelope and ensure imports across both event stores are atomic. The new decoder handles version compatibility; it does not itself persist an import.
4. Author and activate the Italian three-family pilot with real reviewed media, then validate browser/offline/portable behavior.
5. Continue the remaining families, preferences, review scheduling/reporting, and French sequence according to §0.1. Preserve the existing original audio authoring constraints.
6. Run full lint/build/browser and edition checks after integration. A passing runtime suite is not evidence that the complete lesson collection is ready.
