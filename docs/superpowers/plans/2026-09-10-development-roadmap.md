# VerbaLibera phased development plan

Date: 2026-09-10. Scope: current-progress review and proposed upgrade roadmap; no application implementation is included.

**Goal:** Make VerbaLibera a dependable, approachable, varied five-language learning product, with demonstrable instructional depth and consistent web, offline, portable, and desktop behavior.

**Architecture:** Extend the existing static course packs, version-normalization boundary, deterministic evaluation, and event-based progress. Converge learner behavior across the existing players incrementally; preserve identities and progress while upgrading content. Continue author-time content/audio generation without requiring runtime AI.

**Tech stack:** Repository declares Next.js 16.3.3, React 19.2.8, TypeScript, Zod, Prisma/PostgreSQL, Vitest, Playwright, Electron, and an optional local Python voice service.

**Planning level:** This is a program roadmap with independently reviewable delivery packages, dependencies, and acceptance gates. Each phase should receive a focused implementation plan before code changes; this document is not a speculative file-by-file rewrite of every subsystem.

## 1. Review baseline and limits

- Active repository: `/Users/spkoehl/Documents/ChatGPT/VerbaLibera`. The Codex project's saved `VoxLibre` path is stale.
- Local branch: `feat/fr-it-variety`, HEAD `e825dd1` (September 10).
- Remote main fetched during this review: `8b1784d`, merge of PR #22. `git diff HEAD origin/main` is empty: the reviewed application source matches fetched main, despite different commit identities.
- Working tree was clean before this planning document.
- Package version is 0.3.1; a package version does not establish which deployment or distributable is live.
- Review method: source inspection, commit history, content census, existing verification records, and fresh local automated checks. This review does not certify the live deployment, physical iPhone behavior, native-language correctness, subjective audio quality, or packaged desktop startup.

### Current content census

| Language | Lessons | Authored schema | Reachable exercise/activity count | Main remaining imbalance |
|---|---:|---:|---:|---|
| French | 25 | v1 | 222 | 71 translate exercises; only 4 explicit think exercises; no self-compare activity |
| Italian | 25 | v2 | 259 | 126 text activities; 23 self-compare activities, but little dialogue branching |
| German | 8 | v1 | 48 | Only one dictation exercise and no self-compare activity |
| Portuguese | 8 | v1 | 48 | Only one dictation exercise and no self-compare activity |
| Spanish | 8 | v1 | 49 | Only one dictation exercise and no self-compare activity |

Total: 74 lessons and 626 exercise/activity records counted by `scripts/content/exercise-mix.py`. These counts mix v1 exercises and v2 activities, including information steps; they are not 626 equivalent graded tasks or a measure of proficiency coverage.

Five generated Listen tracks are registered in `src/features/listen/tracks.ts`. The README reports approximately 10–13 minutes per track. French and Italian have substantially more short-form lesson audio than the other courses. Audio assets being present does not establish that every important target phrase has an appropriate model recording.

**Reporting caveat:** `scripts/content.ts` counts `legacyExercises`, including for Italian v2, so its 199 Italian exercises omit newer activity work. Its `lessonsWithAudio` metric means a legacy dictation exists, not complete audio coverage. Repair this before using dashboards or reports to govern expansion.

### What has materially improved

1. **Lesson variety:** French adds transformations and changed ordering; Italian has revised rhythm and 23 self-compare speaking activities. German, Portuguese, and Spanish now have eight differentiated lessons each. Earlier reviews of identical lesson shapes are historical evidence, not current descriptions.
2. **Speaking:** `SelfCompareActivity.tsx` now records locally, permits playback, reveals the model, and collects self-assessment. Denied microphones have a fallback. This is not automatic pronunciation assessment or a hosted transcription service.
3. **Entry experience:** `WelcomeFlow.tsx`, onboarding state, and dashboard integration provide explicit language choice and beginner/placement choices. These are implemented components, not an untouched design proposal.
4. **Lesson feedback:** `feedback.ts`, next-lesson handling, and changes to the practice shell address part of the earlier cold-feedback/ending review. Audit remaining parity rather than redoing completed copy work.
5. **Presentation:** Warm Studio tokens, visual assets, navigation/accessibility work, and reduced-motion support have superseded the old Quiet Ink status description.
6. **Infrastructure:** Versioned packs, normalization, local storage, import/export, offline bundles, event sync, optional accounts, portable HTML, and desktop packaging already exist. These require hardening and release verification, not a new platform from scratch.
7. **Audio pipeline:** Listen catalog data now imports generated files. The service worker has a guard against caching partial audio responses. Recheck historical issues individually rather than reopening all old audio findings.

### Highest-priority gaps supported by source

- **Onboarding promise exceeds the implemented handoff.** The beginner choice promises a two-minute first phrase, but `onboardingDestination()` resolves directly to `foundationStartHref()`. A complete short welcome experience and its durable completion transition are not evident; source searches found state writes for `welcome-in-progress`, not a production completion write. Verify this with a journey test before implementation.
- **Placement choice needs capability checks.** WelcomeFlow offers placement for every displayed language; route availability and actual authored assessment depth must be verified separately. Unsupported courses should offer a truthful alternative.
- **v1/v2 experience divergence:** Italian's richer player supports capabilities the other courses lack. Shared normalization and `migratePackV1ToV2()` already exist, making a controlled migration feasible.
- **Offline Listen reachability:** Offline entry mounts the course workspace, with no dedicated Listen catalog/player found in that path. A cached MP3 or a lesson containing a track is not equivalent to independently accessible screen-off study.
- **Build reproducibility:** `scripts/content.ts` reads existing `public/study.css` and prepends source styles when building. Repeated builds appear capable of growing the generated CSS. Verify with an isolated two-build checksum/size test and fix before routine release automation relies on generated output.
- **Curriculum/editorial depth:** All packs explicitly describe partial A1. Native-speaker review remains open. Twenty-five lessons must not be presented as proof of a complete A1 syllabus.
- **Documentation drift:** `docs/astra/phase-status.md` still describes one-lesson starter packs and Quiet Ink; `docs/cefr-coverage.md` describes older travel-fixture counts. Foundation and travel coverage need separate, current reporting.

## 2. Product direction and constraints

Recommended approach: complete the first-session experience, establish one reliable learning contract, then expand audio and curriculum against editorial gates.

Alternatives considered:

| Approach | Benefit | Cost/risk | Decision |
|---|---|---|---|
| Add many lessons immediately | Visible catalog growth | Multiplies uneven audio, schema, and editorial work | Limit to small reviewed batches until core gates pass |
| Rewrite the platform/player | Potential architectural uniformity | Large migration risk and delayed learner improvements | Avoid; use existing normalization and adapters |
| Finish learner journeys and converge incrementally | Faster useful releases with preserved progress | Requires disciplined compatibility tests | Recommended |

Global constraints:

- Keep practice free of mandatory accounts, runtime AI, hearts, timers, and punitive streak mechanics.
- Preserve Think → Try → Compare as instructional behavior, not merely an activity label.
- Distinguish lesson completion, listening exposure, self-assessment, and demonstrated retrieval.
- Keep recordings ephemeral by default. Model comparison must work without microphone access or a local voice service.
- Preserve pack, lesson, exercise, and event identities across migrations; version authored content and define deliberate remapping where needed.
- Retain the current visual system; improve comprehension and flow before introducing another redesign.
- Use course metadata for availability; specify Portuguese variety and regional usage consistently in text and audio.
- Restrict initial expansion to the five existing languages.

## 3. Delivery sequence

Estimates below are planning ranges for one primary engineer with agent assistance and access to editorial reviewers. They are not promises; native-language review and physical-device testing are separate capacity constraints. Phases 0–2 form the first delivery block. Later work is re-estimated after those gates.

| Phase | Outcome | Indicative effort | Dependencies |
|---|---|---|---|
| 0 | Trustworthy baseline and reproducible release inputs | 2–4 engineering days | None |
| 1 | Complete, approachable first session | 4–7 days | Phase 0 baseline |
| 2 | Consistent activities and progress across languages | 1–2 weeks | Phase 0; pilot alongside Phase 1 |
| 3 | Useful listening and speaking online/offline | 1–2 weeks plus audio review | Phase 2 for course-wide speaking; offline player can start earlier |
| 4 | Reviewed A1 depth across existing courses | 3–6 weeks plus editorial lead time | Phase 2; audio standards from Phase 3 |
| 5 | Coherent daily practice and visible learning | 1–2 weeks | Stable event contracts and concept mapping |
| 6 | Verified releases across supported editions | 1–2 weeks plus device access | Acceptance gates from Phases 1–5 |
| 7 | Evidence-led A2 and optional advanced tools | Scoped after evaluation | Reviewed A1 pilot and learning evidence |

Release candidates: first-session improvement after Phase 1; learning/audio parity after Phases 2–3; curriculum and distribution milestone after Phases 4–6. Assign actual version numbers when release scope is fixed.

## 4. Phase 0 — establish a dependable baseline

### 0A. Reconcile status and content reports

- [ ] Generate schema-aware counts from reachable runtime activities, reporting legacy counts separately.
- [ ] Report lesson families, target-language production, speaking opportunities, audio coverage, prerequisite vocabulary, and review status per language.
- [ ] Split foundation-course coverage from older travel fixture coverage; update README and phase status from measured data.
- [ ] Record commit, tested edition, commands, results, limitations, and artifact digest in each release verification note.

Files: `scripts/content.ts`, `scripts/content/exercise-mix.py`, `docs/astra/phase-status.md`, `docs/cefr-coverage.md`, `README.md`. Extend `tests/quality.test.ts` or add `tests/content-reporting.test.ts`.

Gate: Italian's live activities appear in reporting; metrics explain their denominator; no generated report claims full A1 from lesson count.

### 0B. Reproducible bundles and release checks

- [ ] Reproduce the CSS accumulation concern in an isolated checkout; build generated assets from canonical source without reading prior generated output.
- [ ] Compare two successive content builds for byte identity; validate copied packs and referenced media hashes.
- [ ] Align CI and local build paths deliberately: CI currently invokes `npx next build`, while package build specifies `next build --webpack` and runs prebuild checks.
- [ ] Ensure deployment-import checks and relevant local voice-service tests have explicit CI coverage.

Files: `scripts/content.ts`, `package.json`, `.github/workflows/ci.yml`, `public/study.css`, `scripts/portable/`, existing deployment-import and artifact tests.

Gate: clean repeated build; no unexplained generated diff; CI exercises the intended shipping build path.

## 5. Phase 1 — finish the first ten minutes

### 1A. Complete the onboarding state machine

- [ ] Reuse existing WelcomeFlow; consolidate duplicated language metadata and derive capability labels from course data.
- [ ] Add explicit completion and resumption rules for beginner and placement paths, language changes, returning learners, invalid storage, and storage denial.
- [ ] Offer placement only when authored assessment is supported; otherwise offer course preview or first words.
- [ ] Ensure course deep links preserve deliberate selection without silently overriding saved progress.

Files: `src/features/onboarding/state.ts`, `languages.ts`, `src/components/onboarding/WelcomeFlow.tsx`, `src/components/dashboard/DailyPathDashboard.tsx`, placement routes.

Tests: extend `tests/onboarding-state.test.ts`, `tests/DailyPathDashboard.test.tsx`; add `tests/e2e/onboarding.spec.ts` for new visitor, return, refresh mid-flow, language switch, and unsupported placement.

### 1B. Deliver the promised first win

- [ ] Pilot one genuinely short French and Italian entry sequence using existing activities: hear/see a useful phrase, recognize it, construct a small response, optionally say it, receive a concrete recap.
- [ ] Provide text-first and silent-use equivalents; autoplay failure must not block the lesson.
- [ ] Treat the welcome sequence as preparation, not fabricated completion of the full foundation lesson.
- [ ] Follow with Spanish, Portuguese, and German after pilot usability checks.
- [ ] Make the next action clear at the end of every pilot: next lesson, repeat, or dashboard; keep backup/settings outside the active exercise.

Files: course manifests, `CourseWorkspace.tsx`, `LessonPlayer.tsx`, `feedback.ts`, onboarding components; targeted first-session content/audio assets.

Gate: in a small observed pilot of five new users, at least four can choose a language and finish the first interaction without guidance; target first success within 30 seconds of entering the lesson and the short welcome within three minutes. These are proposed usability targets, not current measurements. Test keyboard, 390px viewport, reduced motion, denied microphone, and muted audio.

## 6. Phase 2 — make varied learning consistent

### 2A. Migrate one course safely, then roll out

- [ ] Use `migratePackV1ToV2()` and existing parity tests for a French pilot. Separate mechanical migration from authored changes in reviewable commits.
- [ ] Prove replay of existing attempts, due schedules, prerequisites, backups, sync events, and unfinished lessons before exposing the migrated course.
- [ ] Add new activities only after migration parity passes; then migrate the smaller courses in separate batches.
- [ ] Keep old-pack import support through the migration window; reject genuinely unsupported versions with recovery instructions.

Files: `schema-v2.ts`, `normalize-pack.ts`, `lesson-runtime.ts`, `attempts.ts`, `lesson-session.ts`, `storage.ts`, `sync.ts`, `courses/*/manifest.json`.

Tests: `tests/pack-migration-parity.test.ts`, `tests/lesson-backup-version.test.ts`, `tests/lesson-attempts.test.ts`, `tests/course-sync.test.ts`, portable recovery tests. Add fixtures with real mixed-version histories.

Gate: existing learner histories replay without loss or inflated mastery; web, offline, and portable editions interpret the same pack consistently.

### 2B. Improve instructional variety, not just screen ordering

- [ ] Build a reviewed rotation of discovery, conversation, story, listening, practical mission, and retrieval sessions using existing contracts before adding new ones.
- [ ] Add meaningful target-language production and a think-before-answer opportunity to each appropriate lesson; avoid counting/meta questions that do not test the lesson objective.
- [ ] Audit accidental answer exposure separately from purposeful worked examples.
- [ ] Expand dialogue-choice, matching, and scene-based work where the objective benefits; do not impose identical proportions on all languages.
- [ ] Use deterministic feedback and authored acceptable alternatives; preserve partial-credit distinctions for accents and morphology.

Gate: each pilot unit has at least three meaningfully different lesson experiences, while every required step has a valid response/evaluation/assistance contract. Human review verifies pedagogy; shape tests detect repetition but do not certify teaching quality.

## 7. Phase 3 — listening and speaking that work everywhere

### 3A. Finish standalone offline Listen

- [ ] Expose the track catalog and player from downloaded and portable entry points, independent of course prerequisite unlocks.
- [ ] Include every advertised downloadable track in pack media and size reporting; allow learners to understand the storage cost.
- [ ] Persist playback position; provide transcript access, useful seeking, and resume behavior.
- [ ] Test full cached responses, range requests, cold offline navigation, seek, interrupted download, and recovery after reconnect.

Files: `src/features/listen/`, `src/components/listen/`, `offline-entry.tsx`, `portable-entry.tsx`, `storage.ts`, `public/sw.js`, `scripts/portable/content.ts`.

Tests: `tests/ListenAudio.test.tsx`, `tests/service-worker.test.ts`, `tests/e2e/listen.spec.ts`, `tests/e2e/offline.spec.ts`, portable Playwright suite.

Gate: install a course, close the app, disconnect, reopen, find Listen, play and seek its track, then resume after reopening. Repeat on Chromium, WebKit, and a physical iPhone before claiming iPhone support.

### 3B. Expand audio with editorial controls

- [ ] Bring usable short model audio to all eight lessons of German, Spanish, and Portuguese; audit French/Italian target coverage separately.
- [ ] Add one new reviewed long track per language, then deepen French/Italian to a small coherent sequence before mass production.
- [ ] Generate audio, transcript order, timing, media hashes, and provenance from one authored source. Review teacher instructions and target dialogue together.
- [ ] Reuse self-compare recording in migrated courses. Keep it optional and avoid equating transcription accuracy with pronunciation quality.

Gate: every new recording passes integrity checks and a human listening checklist; dialect and target/transcript agreement are recorded. Publication can retain an explicit review-pending state, but those tracks do not count toward the reviewed-content milestone.

## 8. Phase 4 — build credible curriculum depth

### 4A. Define the syllabus and editorial queue

- [ ] Build an outcome matrix by language: communicative objective, prerequisites, introduced/retrieved vocabulary, grammatical pattern, recognition/production/listening practice, and review status.
- [ ] Audit the existing 25 French and Italian lessons against that matrix; identify missing objectives before setting a lesson-count target.
- [ ] Route the first three lessons and their audio through native-speaker review first, followed by the remaining units.
- [ ] Track corrections with content version, reviewer/date, affected activity IDs, and revalidation status.

Files: `courses/`, `docs/cefr-coverage.md`, `docs/audio-provenance/`, content scripts and correction issue template.

### 4B. Expand in complete instructional units

- [ ] Deepen French/Italian A1 gaps with practical situations, cumulative retrieval, and integrated tasks.
- [ ] Expand German/Spanish/Portuguese from eight to approximately 12–16 lessons in the first tranche, then reassess toward comparable outcome coverage. Counts are capacity targets, not CEFR evidence.
- [ ] Author language-specific situations and explanations; reuse schemas and validation rather than translating one course wholesale.
- [ ] Give new units short audio, a reading/dialogue, productive practice, and later retrieval of earlier material.

Gate: each released unit passes structural validation and editorial checks, references taught prerequisites, and includes evidence-producing practice for its stated objectives. No full-A1 claim until an explicit coverage and assessment review supports it.

## 9. Phase 5 — connect daily practice to actual learning

- [ ] Make the dashboard's next action reflect current course progress, unfinished session, due review, available time, and learner goals across foundation and guided paths.
- [ ] Store foundation preferences locally and sync them for optional accounts with clear conflict rules.
- [ ] Preserve separate recognition, production, listening, and self-assessment histories. Track listening exposure without granting retrieval mastery.
- [ ] Show understandable progress: phrases practised, situations attempted, and what to revisit, without false proficiency claims or punishment.
- [ ] Add saved vocabulary and targeted grammar practice through existing concept links before introducing a separate scheduling subsystem.
- [ ] Improve placement with reviewed items and valid course entry recommendations; limit recommendations to material actually available.

Files: `src/features/session/`, `src/features/study-plan/`, `src/features/srs/`, `src/lib/progress/`, `src/features/placement/`, dashboard/profile components, account APIs and Prisma schema if necessary.

Gate: the same event history produces consistent progress online and offline; duplicate sync cannot inflate completion; guest-to-account handling is explicit; returning learners have one clear, relevant next action. Retain the existing scheduler until data demonstrates a need for a replacement such as FSRS.

## 10. Phase 6 — qualify supported releases

- [ ] Run a fixed edition matrix: hosted guest, signed-in web, installed offline PWA, portable file in Chromium/WebKit, and packaged Apple Silicon desktop.
- [ ] Verify fresh install, upgrade with old progress, backup/restore, offline start, interrupted writes, account switching, sync replay, and recovery.
- [ ] Test actual iPhone Add to Home Screen, offline relaunch, microphone denial/permission, background audio, interruption, and foreground recovery. Assign a human/device owner; automation alone cannot close this gate.
- [ ] Measure launch time, lesson interaction delay, largest pack, audio download size, and sync payloads before setting performance budgets.
- [ ] Resolve manual contrast checks where axe reports undetermined results; test focus and reading order in both players.
- [ ] Verify desktop runtime provenance, first-run setup, port conflicts, restart, database recovery, and update rollback. Treat signing/notarization as a separately costed distribution decision; keep unsigned status explicit until completed.
- [ ] Attach checksums and verification records to release artifacts; document what requires network, local storage, or the optional voice service.

Files: `.github/workflows/`, `desktop/`, `scripts/desktop/`, `scripts/portable/`, Playwright configs, `docs/astra/testing.md`, release docs.

Gate: no unresolved data-loss, critical navigation, or advertised-offline-function failure in the supported matrix. A failing edition can remain explicitly experimental without blocking verified editions.

## 11. Phase 7 — evidence-led next upgrades

After the preceding milestones, prioritize from observed learning needs:

1. **French/Italian A2 pilot:** coherent everyday routines and past/future situations, cumulative conversations, longer readings, and reviewed assessments.
2. **Conjugation/reference tools:** searchable paradigms linked to current mistakes and lesson concepts, with focused practice using existing scheduling evidence.
3. **Interference lessons:** contrast confusing constructions within a language or across languages only where repeated learner mistakes justify authoring.
4. **Richer branching scenarios:** authored practical dialogue with deterministic accepted variants; do not require an online chatbot.
5. **Optional local voice enhancements:** transcription-assisted comparison where available, with honest fallback and no unsupported pronunciation score.
6. **Additional platforms or languages:** only after maintenance, curriculum review, and distribution capacity are established.

Defer broad B1/B2 claims, new-language proliferation, mandatory cloud AI, social competition, and a scheduling rewrite. Reassess after user testing rather than reserving implementation effort now.

## 12. Execution and handoff rules

Each delivery package should have one accountable owner and a short implementation plan containing exact files, input/output contracts, regression fixtures, acceptance commands, and rollback strategy. Hermes can coordinate sequential assignments to the preferred implementation routes; this roadmap does not launch any agents or authorize a release.

Recommended first queue:

1. Correct schema-aware reporting and reproduce/fix generated CSS accumulation.
2. Close onboarding completion/resumption and placement capability gaps.
3. Deliver and user-test the French/Italian short first-session pilot.
4. Run a progress-preserving French v2 migration pilot.
5. Add standalone offline Listen and its cold-start/seek test.
6. Begin native review and short-audio expansion for the existing starter courses.

Keep mechanical migration, content edits, and visual behavior changes independently reviewable. Before every content release, validate source, rebuild packs, inspect generated changes, verify media, and run relevant runtime/portable tests. Never regenerate tracked bundles casually during a review without inspecting the resulting diff.

Success measures to baseline during delivery: unassisted first-session completion; time to first meaningful response; one-week delayed retrieval on reviewed objectives; return-to-practice behavior where users consent to measurement; blocking errors by edition; and percentage of published objectives with reviewed text/audio and productive practice. Use small observed usability sessions or opt-in aggregate measurement; no raw learner recordings are needed.

## 13. Verification from this review

- `npm run content:validate`: passed for all five packs, including declared references and media hashes.
- `npm run content:audio-check`: passed; this is mechanical integrity, not subjective listening review.
- `npm run typecheck`: passed.
- `python3 scripts/content/exercise-mix.py`: completed; census above reflects reachable authored content.
- `npm run test -- --reporter=dot`: 128 test files passed, 1 skipped; 922 tests passed, 1 skipped. Non-failing React act warnings and an axe preload timeout appeared, so this does not close browser accessibility verification.
- Production build, browser journeys, physical-device tests, desktop artifact tests, live deployment status, and native-language review were not performed as part of this source/planning review.

Related prior plans: `2026-09-09-approachable-first-learning-experience.md`, `2026-09-08-lesson-variety.md`, and the September 10 lesson-experience review/tier-1 plan. Use them as implementation history; this roadmap supersedes their stale current-state assumptions, not completed work.
