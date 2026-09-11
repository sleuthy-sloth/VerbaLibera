# Phased upgrade status

Status after the schema-aware content reporting pass, French and Italian L0 (words-first openers) plus Units 6 (25 lessons/language), German/Portuguese/Spanish at eight lessons each, foundation-aware placement from first words, meet-the-word onboarding, hear-it-first autoplay, guest blank-slate, and Warm Studio brand artwork. “Partial” means working functionality exists, with the named gaps still open; it is not a completion claim for the full phase.

Numbers in this file come from the generated reports in `docs/astra/reports/`, not from memory: `npm run content:stats` prints a schema-aware report per course. Retained v1 records and reachable runtime activities are counted separately, because counting the former as the course total is what previously hid the whole Italian speaking rollout (199 reported vs 259 reachable).

| Phase | Status and remaining work |
| --- | --- |
| 1 Audit | Completed initial audit and baseline verification. |
| 2 Content architecture | Versioned JSON packs, schema and references implemented; richer level/stage/skill metadata remains partial. French, German and Portuguese migrated from schemaVersion 1 to 2 through `migratePackV1ToV2()` with identity parity, history replay and a flip rehearsal proven by test; Spanish remains v1, and it is the last pack that can be flipped with real v1 content still in the tree. The v2 lesson shape now carries the optional `cefr` and `culturalNote` fields the migration used to drop, so German kept all 8 authored tags and notes; French and Italian predate the fields and report none (a data decision, not a silent loss). |
| 3 Curriculum | French and Italian: 25 lessons each (L0 words-first opener + Units 1–6); partial A1. German, Portuguese and Spanish ship as active starter packs (8 lessons each, v0.4.0, 48–49 practice activities). More domains, depth and native-speaker review remain. |
| 4 Exercises | Reusable registry and seven contracts; five populated forms. French has 222 practice activities, Italian 233. `transform` now exists in French, German, Spanish and Portuguese. Full proposed catalogue remains partial. |
| 5 Answer evaluator | Deterministic variants, normalization, authored errors and conservative typo handling implemented; broader morphology data remains. |
| 6 Mastery | Mode-separated concept evidence and exercise schedules implemented; richer concept stability summaries remain. |
| 7 SRS | Existing SM-2 retained with separate recognition/production/listening histories. FSRS intentionally deferred. |
| 8 Daily lessons | Due/weak/prerequisite selection and session bounds implemented; diversity and goal weighting remain partial. |
| 9 Interference | Deferred. |
| 10 Dialogues | Four static branching scenarios; wider situations and constrained typed branches remain partial. |
| 11 Reading | 50 short original readings, lookup and optional translation; saved words and longer materials remain partial. |
| 12 Listening | 50 new prerecorded models: every foundation lesson now has optional listening practice plus hear-it-first autoplay on practice start. Five audio-only Thinking Method tracks (teacher guide + think-pauses + reveals, bottom Listen tab, precached offline, heard-logging without mastery claims). Reportable coverage: French 25/25 lessons, Italian 25/25, German/Portuguese/Spanish 1/8 each with 1 clip each (German via Piper `de_DE-thorsten-medium`). Slow replay/dictation work offline; minimal pairs, listen-and-order, longer dialogue audio and human prosody review remain. |
| 13 Pronunciation | Existing optional local transcription retained; no invented pronunciation score. Italian is the only course with speaking steps (23). Spanish is schemaVersion 1 and needs a player capability before content; French, German and Portuguese run the v2 player and could carry speaking steps, but none are authored. |
| 14 Course packs | Validated downloadable packs, compatibility/content versions, media hashes and attribution implemented. |
| 15 Offline | Static cold-start study, teaching, audio and durable practice verified in Chromium. Single-file portable edition (`VerbaLibera-Portable.html`, all five foundation packs, IndexedDB-or-memory progress, export/import) verified in Chromium and WebKit. Full Electron macOS edition (bundled PostgreSQL 18.6 + OpenSSL, local profiles or user remote Postgres, fixed-origin server) built, packaged, and covered by first-run/recovery e2e. Physical Safari/PWA QA remains open. |
| 16 Sync | Account-scoped immutable foundation events, duplicate/conflict handling and reconnect synchronization implemented. Travel study plans and placement results now save/load/reset across accounts and devices. Foundation study preferences remain open. |
| 17 Placement | French and Italian each have a fixed 15-item A1/A2/B1 assessment with account sync and foundation-lesson recommendations persisted to the account. These are rough starting-point suggestions, not CEFR certification. Deeper adaptive assessment remains open. |
| 18 Study plans | Travel plans now drive account sessions with paired teaching/retrieval, due reviews and pace bounds; account plan storage and derived completion are connected to the builder/dashboard. Guest checklists remain browser-local; signed-out visitors see an honest blank slate, never fiction progress. Goal-driven foundation scheduling and preference sync remain open. |
| 19 Vocabulary | Search, meaning, examples and evidence labels implemented; richer metadata and dedicated per-word scheduling remain partial. |
| 20 Grammar | Linked explanations, examples, errors and concept evidence implemented; paradigms and targeted drill selection remain partial. |
| 21 Conjugation | Dedicated reference/search/drill system deferred. |
| 22 Learner experience | Warm Studio branding (logo, hero, course banners, day-zero art), mobile controls, focus handling and visible storage/sync states improved. Broader user testing remains. |
| 23 iPhone QA | Chromium/WebKit layouts and online audio tested; physical keyboard/standalone/offline Safari testing remains open. |
| 24 Pipeline | Validation/build/stats/coverage/duplicates/audio integrity commands implemented; reports are schema-aware and count reachable activities separately from retained v1 records. Two successive content builds are byte-identical and a test pins that. Linguistic checks require editorial review. |
| 25 Static authoring | Course content and audio stored as ordinary assets. Authoring uses local tooling; no runtime LLM added. |
| 26 Tests | Expanded unit, browser, account, offline and audio coverage. See implementation report for latest totals. |
| 27 Performance | Per-language loading and asset-size reports implemented; load timing/database query benchmarks and incremental sync remain open. |
| 28 Documentation | Architecture, behavior, testing, provenance and honest implementation reports maintained. `docs/cefr-coverage.md` now reports foundation packs and the older travel fixture separately and never adds them together. |

See `study-plan-continuation.md` for the September 5 review and continuation scope. No numbered slice-4 specification was present in the repository or the two latest commit messages.

Next priorities: deepen Italian/French A1 domains and varied retrieval; improve foundation placement and operational study preferences; add curated conjugation references; then broader listening forms and interference content. Avoid expanding language count before the first two courses have adequate instructional depth.
