# VerbaLibera completion review and implementation roadmap

> **For agentic workers:** Use superpowers:executing-plans to execute one bounded task at a time. Checkboxes below are outstanding work, not completed claims. Retain the approved portable and Electron specifications; this roadmap changes sequencing and acceptance tracking.

**Goal:** Finish a reliable hosted, portable, and Apple Silicon desktop release, then close the remaining learning-platform phases with explicit curriculum and verification gates.

**Architecture:** Preserve the shared foundation course workspace, deterministic evaluator, immutable practice events, and environment adapters. Keep legacy travel progress separate until an explicit migration is designed. Complete existing systems before expanding their scope.

**Tech stack:** Existing Next.js/React/TypeScript, Prisma/PostgreSQL, IndexedDB, SM-2, Electron Forge, Vitest and Playwright. Use the repository lockfile.

**Sources:** `docs/astra/phase-status.md`, `docs/astra/implementation-plan.md`, `docs/astra/study-plan-continuation.md`, `docs/astra/implementation-report.md`, the September 6 distribution specification and portable/Electron plans, landing-page plan, current source and tests.

## Review baseline and judgment

Reviewed local `main` at **767a57a** on September 6, 2026 (Pacific time). Commit authorship uses the shared account `sleuthy-sloth`; the repository cannot independently distinguish every Hermes edit from Codex work. This review evaluates the resulting implementation, including work continued after the interrupted task.

Hermes has delivered a substantial functional foundation and distribution implementation. The project is **not complete** against the 28-phase tracker. Packaging exists, but several lifecycle paths violate the approved contract and the browser tests cover less than the completion prose implies. Curriculum remains partial A1, with most depth concentrated in two languages. A percentage-complete estimate would obscure these differences.

Fresh verification:

- `npm test`: **91 files passed, 1 skipped; 593 tests passed, 1 skipped**.
- `npm run content:stats` and `npm run content:validate`: five packs successfully processed/validated.
- `npm run typecheck`: **failed** on duplicate `.next/types/* 3.ts` / `* 4.ts` declarations and untracked `tests/proxy-guard.test 2.ts`, which imports missing `../proxy`.
- Four pre-existing untracked duplicate source/script files were left intact. Their origin is unknown; do not automatically delete user files.
- Both DMG and HTML artifacts and checksum files exist locally. Their presence alone does not prove that they correspond to this revision or meet release acceptance.
- No new production build, full browser suite, DMG installation, remote database integration or physical-device QA was run in this review. Historical reports are evidence of earlier runs, not fresh verification of this head.

Current foundation inventory (not legacy travel content):

| Language | Lessons | Exercises | Vocabulary records | Referenced audio clips |
| --- | ---: | ---: | ---: | ---: |
| French | 25 | 202 | 102 | 26 |
| Italian | 25 | 199 | 102 | 26 |
| German | 1 | 7 | 6 | 1 |
| Portuguese | 1 | 7 | 6 | 1 |
| Spanish | 1 | 7 | 6 | 1 |
| Total | 53 | 422 | 222 | 55 |

Counts describe authored assets, not proficiency coverage or independent linguistic approval.

## Findings requiring action

### R1 — P1: Remote desktop passkeys receive the wrong origin configuration

`desktop/runtime/server.ts:65` constructs the server environment without `WEBAUTHN_RP_ID` or `WEBAUTHN_ORIGIN`. `desktop/main.ts` launches with that environment rather than inheriting a configured web origin. `src/lib/auth/webauthn.ts:25` consequently defaults to `localhost` and `http://localhost:3000`, while the desktop window runs at `http://127.0.0.1:43127`. Remote-mode registration/assertion cannot satisfy that origin/RP contract. Local-profile tests do not exercise this.

Acceptance: explicit fixed-origin WebAuthn configuration reaches the child process; a real packaged remote-mode registration and subsequent sign-in work against a disposable TLS database. If Chromium platform passkeys cannot support the chosen origin, resolve the specification deliberately before claiming remote accounts work.

### R2 — P1: Restart exits before owned services shut down

`desktop/main.ts:407` calls `app.relaunch()` followed by `app.exit(0)` without `shutdown()`. Reset repeats the direct exit at line 456 after stopping only PostgreSQL, leaving the Next child unmanaged. Cleanup is registered separately on `before-quit`; direct exit does not use that path. This risks an orphaned server occupying the fixed port on the next launch.

Acceptance: one serialized shutdown/restart path stops server and database, waits for termination, then relaunches. Repeated restart, reset, and mode changes leave no listeners or child processes behind.

### R3 — P1: Remote-first installations cannot initialize local storage when switching

Startup promotes `settings.pending` immediately, then the local branch reads `local-db.json`. A remote-first installation has never created that secret or local database. Switching to local therefore enters recovery instead of first-time local initialization. Activation is also saved before the new mode successfully starts.

Acceptance: remote-first → local creates credentials and database; local → remote → local preserves local progress. Failed activation retains a recoverable previous configuration without merging stores.

### R4 — P1: Existing remote databases bypass downgrade rejection

`desktop/main.ts:637` only checks whether packaged migrations are pending. A database containing all packaged migrations plus newer migrations proceeds directly to `bootServer`; it never calls `assertCompatibleSchema`. The protection in `migrateDatabase` therefore does not cover ordinary remote startup.

Additionally, `desktop/runtime/migrations.ts:34` discovers available migrations relative to `process.cwd()`, despite packaged paths already being available in `ResourceLayout`. Launching from Finder must not depend on the repository directory.

Acceptance: pass an explicit packaged migration directory, reject unknown/newer applied schemas before server startup in both modes, and test launch from an unrelated directory. Preserve explicit remote migration approval.

### R5 — P1: Runtime failure supervision is incomplete

The server's `exited` promise is consumed during shutdown, but startup does not attach a post-health crash recovery handler. A server dying after initial health success leaves the learner window without the promised recovery flow. PostgreSQL's returned `kill` is a no-op, so the fallback after a failed `pg_ctl stop` cannot reap it.

Acceptance: kill the server after dashboard load and force graceful database stop failure; recovery appears, owned processes are verified and reaped, and relaunch succeeds without killing unrelated processes.

### R6 — P2: Release tests and audit do not establish the published guarantees

Electron tests launch `node_modules/electron` with `args: ['.']`, not the application from the DMG. The first-run test persists a profile, not lesson progress, placement or a study plan. Portable tests save one Italian choice result, check a blob URL, and export; they do not prove audio playback, complete-lesson behavior, import round-trip or all-course navigation.

`verify-artifact.ts` scans staging trees, while its mounted-DMG audit mostly checks required paths. Developer-path detection depends on whether the path exists on the auditor's machine; a leaked path from another builder can pass. The workflow uploads to an existing GitHub release but does not create it or declare `contents: write`, so tag-only publishing is not self-contained.

Acceptance: test the installed artifact, extend behavioral coverage, scan shipped contents independently of the build machine, and make release creation/permissions explicit. Verify the workflow in a non-production release exercise before publishing.

## Evaluation against all original phases

| Phase | Current assessment | Remaining closure work |
| --- | --- | --- |
| 1 Audit | Initial audit complete; refreshed here | Maintain revision-specific evidence |
| 2 Content architecture | Working versioned packs | Level/stage/skill metadata and compatibility tests |
| 3 Curriculum | 53 lessons; partial A1 | Reviewed Italian/French A1 coverage, then other courses and later levels |
| 4 Exercises | Seven populated kinds including think | Additional catalog forms and meaningful retrieval diversity |
| 5 Answer evaluator | Working deterministic core | Curated morphology/variants and false-positive/negative corpus |
| 6 Mastery | Mode-separated evidence | Concept stability summaries with truthful interpretation |
| 7 SRS | SM-2 working | Scheduling evaluation; FSRS remains intentionally deferred |
| 8 Daily lessons | Due/weak/prerequisite selection | Foundation goals, diversity and operational preferences |
| 9 Interference | Deferred | Authored confusable sets and targeted practice |
| 10 Dialogues | Static branching working | More situations and constrained typed branches |
| 11 Reading | Short readings and glossary working | Saved words, longer graded texts, linked review |
| 12 Listening | Model/dictation coverage; French guided-track pilot | Actual playback QA, more guided tracks, minimal pairs/order/dialogue audio |
| 13 Pronunciation | Optional local transcription | Honest supported workflow and human usability review; no invented score |
| 14 Packs | Validation, versions and hashes working | Upgrade/migration and stale-pack compatibility acceptance |
| 15 Offline | Hosted static workspace and portable implemented; desktop packaged | Desktop blockers, complete artifact QA, physical offline devices |
| 16 Sync | Foundation events, travel plans and placement implemented | Foundation preference sync, large-history incremental reconciliation |
| 17 Placement | Fixed French/Italian tests and foundation starting points | Broader calibrated coverage and adaptive follow-up; no certification claim |
| 18 Study plans | Operational account travel plans | Foundation scheduler integration and synced preferences |
| 19 Vocabulary | Search/examples/evidence | Saved-word workflow, richer metadata and word-specific reviews |
| 20 Grammar | Linked references | Paradigms and targeted retrieval |
| 21 Conjugation | Deferred | Curated searchable paradigms and drills |
| 22 Experience | Landing page, dashboard separation, profile/navigation, onboarding/art | Cross-surface continuity and learner usability validation |
| 23 iPhone | Automated layout/WebKit evidence | Physical Safari/PWA keyboard, audio and offline testing |
| 24 Pipeline | Build/validation/stats/audio commands | Editorial sign-off and publish gates |
| 25 Static authoring | Ordinary assets; no runtime LLM | Reproducible reviewed publication workflow |
| 26 Tests | Broad unit coverage | Current typecheck repair and missing complete release journeys |
| 27 Performance | Per-language assets and reports | Cold-start/DB/sync benchmarks and measured budgets |
| 28 Documentation | Extensive but inconsistent | One current status record; archive historical counts clearly |

Latest additions are retained: landing page with `/dashboard`, profile and navigation, words-first L0, hear-first/Thinking Method practice, French audio-only listening pilot, three starter packs, portable HTML, and Electron local/remote modes. Do not restart those as unimplemented projects.

## Completion scope and constraints

Recommended first finish line: a dependable release with **reviewed Italian/French A1**, honestly labeled German/Portuguese/Spanish starters, working hosted/portable/macOS distributions, and completed foundation study preferences. This is an explicit release milestone, not a claim that every original ambition is finished.

Full roadmap closure additionally requires the remaining exercise/reference/adaptation work and a separately tracked course-level matrix. Complete A1–C2 coverage, if retained from the original ambition, must remain open until each language/level has authored, reviewed and tested material. Do not quietly redefine five starters as five complete courses.

Preserve no-runtime-LLM grading, existing accounts and event IDs, explicit guest/account transfer, separate recognition/production/listening evidence, truthful CEFR language, and original attribution. Retain SM-2 until evaluation warrants changing it. Portable excludes accounts, server routes and sync. First desktop release stays Apple Silicon-only and unsigned, with no updater or bundled speech models, as approved.

## Ordered execution plan

### Milestone A: Establish a clean, reproducible baseline

**Files:** duplicate files listed above; generated `.next/types`; `docs/astra/phase-status.md`, `docs/astra/implementation-report.md`, `README.md`.

- [ ] Compare each duplicate with its tracked counterpart; preserve unique edits in a recovery location before removing accidental copies. Regenerate build outputs rather than broadening type/lint ignores.
- [ ] Run `npm run content:validate`, `npm test`, `npm run lint`, `npm run build`, then `npm run typecheck`. Capture exit codes and revision in a new verification record.
- [ ] Correct stale claims: German has one lesson, not zero; foundation event sync is implemented; historical 408/506 totals are not current; distribution existence is distinct from acceptance.
- [ ] Commit only reviewed baseline/documentation changes.

**Exit:** clean checks from a reproducible checkout, with any skipped test named and explained. No unexplained duplicates remain in the build inputs.

### Milestone B: Repair desktop lifecycle and account contracts

Depends on A. Work through the following independently reviewable tasks; each starts with a failing regression, receives the minimal repair, then focused tests and a commit.

- [ ] **B1 Remote authentication:** modify `desktop/runtime/server.ts`; extend `tests/desktop-server.test.ts`; add `tests/e2e/electron-remote.spec.ts`. Assert fixed-origin configuration and real registration/sign-in. Consumes `APP_ORIGIN`; produces a server environment matching it.
- [ ] **B2 Controlled restart/crash:** modify `desktop/main.ts`, `desktop/runtime/server.ts`, `desktop/runtime/postgres.ts`; add `tests/desktop-lifecycle.test.ts` and extend `electron-recovery.spec.ts`. Exercise restart twice, crash after healthy launch, database stop failure and reset with an active server. Produce one idempotent lifecycle shutdown path.
- [ ] **B3 Storage transitions:** modify `desktop/main.ts`, `desktop/runtime/reset.ts`, `desktop/settings/store.ts`; extend storage unit tests and add `tests/e2e/electron-storage.spec.ts`. Exercise remote-first → local, local → remote → local, failed activation and preserved progress. Activate pending settings only after successful preparation.
- [ ] **B4 Migration correctness:** modify `desktop/runtime/migrations.ts` and its callers; extend migration tests and add `tests/e2e/electron-upgrade.spec.ts`. Pass `migrationsDir` explicitly; test unrelated working directory, newer remote schema, failed forward migration, preserved prior progress and approval rejection. Document exactly what metadata backups can restore; do not describe them as full data backups.

**Exit:** R1–R5 resolved with integration evidence, no orphaned processes, no unintended remote migration, and no progress loss during upgrade or mode switching.

### Milestone C: Validate the actual deliverables

Depends on B. Existing distribution plans remain implementation references; these are their missing acceptance gates.

**Files:** `tests/e2e/electron-first-run.spec.ts`, `electron-recovery.spec.ts`, `portable.spec.ts`, `playwright.electron.config.ts`, `scripts/desktop/verify-artifact.ts`, `.github/workflows/macos-release.yml`, new `docs/releases/acceptance-matrix.md`.

- [ ] Launch the `.app` copied from the built DMG using an isolated user-data directory and an unrelated working directory. Complete placement, study-plan creation, a lesson and audio playback; quit and recover all saved state. Repeat with two local profiles to prove isolation.
- [ ] Run local-mode tests with outbound traffic blocked and observed; test actual requests rather than infer no-network behavior from regex scans. Validate renderer origin restrictions, permissions and IPC on the shipped window.
- [ ] In Chromium and WebKit portable tests, navigate all five packs, finish a full lesson, verify advancing audio time, export/import into a fresh store, duplicate import, reload, denied storage and mid-session write failure.
- [ ] Audit actual shipped files, architectures, licenses, resources and credentials. Reject realistic developer paths even when they do not exist on the verifier's machine. Tie SHA-256 outputs and test evidence to the exact source revision.
- [ ] Give the release job explicit scoped permissions and create-or-upload behavior; test first-time and repeated publication in a disposable release context before real publication.
- [ ] Record physical Mac Safari/Chrome portable tests, clean Apple Silicon DMG install, and physical iPhone Safari/PWA tests. Include screen lock, keyboard, offline relaunch, audio interruption and storage recovery.

**Exit:** every row names artifact hash, OS/browser, result and evidence; no untested row is marked passed. Human/device access is needed for physical QA, not for earlier engineering work.

### Milestone D: Complete foundation daily learning

Depends on A; integrate after distribution fixes settle shared boundaries.

**Files:** `src/features/course-pack/progress.ts`, `schema.ts`, `sync.ts`, `CourseWorkspace.tsx`; new foundation-preferences module and authenticated API; additive Prisma migration; corresponding unit/account/offline tests.

- [ ] Define a versioned preference contract for pack, daily budget, goal and listening preference. Keep guest storage separate and account identity bound to requests.
- [ ] Add deterministic scheduler cases: due review remains in budget, weak work is included, new material respects prerequisites, practice varies exercise modes, disabled audio is respected, and an exhausted course gives review rather than an empty dead end.
- [ ] Implement preference save/load/reset and reconnect semantics; test two browsers, account change during request, offline edits and explicit conflict policy.
- [ ] Connect placement recommendations and daily plans to the same foundation entry point. Dashboard links must resume the selected foundation course without confusing travel completion with foundation evidence.

**Exit:** a new learner completes placement → bounded daily session → saved review → next-day review on a second device, with visible storage/sync truth throughout.

### Milestone E: Finish reviewed Italian/French A1

Depends on D for final learner acceptance; editorial inventory can begin after A.

**Files:** `courses/french/manifest.json`, `courses/italian/manifest.json`, `docs/cefr-coverage.md`, `docs/astra/curriculum-system.md`, content/audio reports and provenance.

- [ ] Create an objective-by-objective A1 matrix mapping teaching, vocabulary, grammar, independent retrieval, reading, dialogue and listening. Identify uncovered objectives before setting lesson counts.
- [ ] Author missing domains in small vertical slices using existing pack contracts and stable IDs. Include retrieval of earlier material and plausible authored errors, not just more parallel translations.
- [ ] Extend the Thinking Method/listening pilot where it supports those objectives; ensure assistance never earns unaided mastery credit.
- [ ] Have qualified reviewers check both linguistic correctness and audio prosody; record reviewer, asset version, corrections and disposition. Automated waveform/transcription checks remain preliminary evidence.
- [ ] Validate content, hashes and duplicate detection for each slice, then complete sampled learner journeys in all three editions.

**Exit:** every chosen A1 objective has adequate reviewed teaching and retrieval evidence; all blocking editorial/audio findings are closed. Keep other languages labeled starters.

### Milestone F: Close remaining learning-system phases

Depends on E's stable content/evidence contracts. Each deliverable needs its own bounded implementation specification before code.

- [ ] **Reference and retrieval:** extend schema and vocabulary/grammar views with saved words, paradigms, curated conjugation search and targeted drills. Tests distinguish reference lookup from successful recall (phases 19–21).
- [ ] **Richer practice:** authored interference sets, constrained typed dialogues, longer graded readings, minimal-pair and listen-and-order exercises. Supply deterministic wrong-answer cases and offline media for each new form (4, 9–12).
- [ ] **Adaptation:** richer concept stability summaries and exercise diversity; evaluate placement recommendations against expert-reviewed samples. Keep unsupported higher-level placement visibly approximate (5–8, 17).
- [ ] **Voice boundary:** verify optional local transcription and its absence in packaged editions; preserve transcript-only feedback and avoid numerical pronunciation claims (13).
- [ ] **Scale:** benchmark cold starts, large event histories, database queries and synchronization. Establish measured budgets before optimizing; add incremental sync with stable cursors, retry/idempotency and account-isolation tests (16, 27).

**Exit:** all corresponding phase tracker gaps have tested deliverables or explicitly approved deferrals. FSRS is a separate evaluated decision, not a prerequisite imposed by this roadmap.

### Milestone G: Broader curriculum and final closure

Depends on E/F. Preserve the original ambition beyond the initial release.

- [ ] Expand German/Portuguese/Spanish through the same reviewed A1 matrix, one course at a time.
- [ ] For each retained higher CEFR level, define outcomes, author material, complete linguistic/audio review and assess progression before advertising that level. Track each language/level separately.
- [ ] Complete accessibility/usability rounds, performance budgets, content publication procedures, documentation and the final regression/release matrix.
- [ ] Mark a phase complete only with dated evidence against its scope; obtain explicit scope decisions for any remaining deferred feature instead of silently closing it.

**Exit:** every retained phase and language/level commitment is complete or explicitly removed from scope. The first stable release alone does not satisfy this gate.

## Immediate execution order

A → B1 → B2 → B3 → B4 → C is the release critical path. D → E establishes the useful learning-product finish line. F → G closes the broader original roadmap. Do not spend the next cycle adding another language opener while desktop lifecycle and foundation daily-learning gaps remain.

Effort should be estimated per milestone after its baseline and editorial inventory are established. Human linguistic review, clean-device access and higher-level curriculum authoring are real dependencies; commit counts and green unit tests cannot substitute for them.


## September 6 learner feedback: immediate implementation slice

User priorities added after review: Lesson 0 must be the default beginner entry; lessons need more visual and mental variety; offline PWA language downloads must be obvious.

This slice precedes milestone A/B execution because it repairs the primary learning journey. It does not close the desktop blockers or the complete curriculum-variety milestone.

- [ ] Route dashboard Start learning and the Practice tab to the selected foundation course, opening its next eligible lesson. New learners start at Lesson 0; saved foundation history advances normally; retain travel links and history.
- [ ] Put language downloads above the course list, link directly from the dashboard, report pending/success/failure accurately, and explain installed-app versus downloaded-content storage.
- [ ] Make the offline welcome page offer language entry points instead of only asking the learner to reconnect. Verify a downloaded course opens from an offline dashboard launch without caching account HTML.
- [ ] Introduce distinct choice cards, editable sentence construction, inline missing-word practice, reading layout and session progress. Collapse repeated explanations after correct answers; keep help and assisted-answer accounting intact.
- [ ] Improve a small set of early Italian/French prompts with everyday situations, preserving answer contracts and event IDs. Follow with the larger milestone E/F authoring pass: scenario diversity, visual content where instructional, varied retrieval and native-speaker review.
- [ ] Verify beginner entry, returning learner behavior, download failure/retry, offline cold start, mobile layout, accessible controls and all existing regression tests. Record what is implemented separately from future content work.
