# Hermes — development roadmap progress

Run started 2026-09-10. Model: **deepseek-v4-flash** (as instructed; no work routed elsewhere).
Roadmap source: `docs/superpowers/plans/2026-09-10-development-roadmap.md`.
Worktree: `/Users/spkoehl/Documents/ChatGPT/VerbaLibera/.worktrees/hermes-830d4bcc`
Branch: `hermes/hermes-830d4bcc` (base `e825dd1`, from `feat/fr-it-variety`).

This file is updated as each phase lands. "Pending" below always means *not performed*, never
"assumed fine".

## Current phase

**Phases 0, 1A, 1B, 2A and 3A-v1 are complete. Phase 3A's offline and portable entry points landed —
Listen now exists in all three editions.** The remaining 3A items are the offline matrix (range
requests, interrupted download, recovery after reconnect), WebKit's offline service-worker run, and
the gate's physical-device pass, which is human work.

The next packages, in the order they are written up below: **3B** (audio expansion, blocked on the
human listening checklist), **2B** (the German/Portuguese/Spanish flip — its CEFR gate is now cleared,
so it is mechanical work plus one decision about repairing French and Italian), the new **Listen
player brief** (`docs/superpowers/briefs/listen-player-design.md`, which appeared in the tree mid-run),
and **Phase 4**. Phase 7 stays behind its evidence gates.

## Phase status

| Phase | State | Notes |
| --- | --- | --- |
| 0 — baseline and reproducible release inputs | **Complete** | 0A report reconciliation, 0B reproducible bundles + CI parity |
| 1 — complete the first ten minutes | **1A and 1B complete** | 1A: onboarding state machine, completion/resume rules, placement capability. 1B: the short first-win sequence for French and Italian, text-first and sound-optional, with resume and a concrete recap. The gate's observed five-user pilot is a human session and stays pending. |
| 2 — consistent activities and progress | **2A complete; 2B's blocker cleared** | French migrated to schemaVersion 2 (`473b90d`) with identity parity and history replay proven by test, plus the compensating think-first gate the move would otherwise have deleted. The CEFR loss that blocked the remaining flips is fixed in the migration (`4bac558`). 2B content work is a separate package. |
| 3 — listening and speaking everywhere | **3A substantially complete** | Position, resume and cold start (`2d00afd`); then the long tracks measured into a generated catalog, cached by the download, and Listen exposed in the downloaded and portable editions (`e34973a`). Remaining: the offline matrix's failure cases, WebKit service-worker coverage, and the device pass. 3B needs the human listening checklist |
| 4 — curriculum depth | Not started | Needs editorial/native-speaker capacity; do not start before Phase 2 |
| 5 — daily practice and visible learning | Not started | Depends on stable event contracts from Phase 2 |
| 6 — verified releases | Not started | Physical-device QA and signing decisions are human tasks |
| 7 — evidence-led A2 / advanced tools | **Deliberately not started** | Conditional on reviewed A1 pilot and learning evidence that does not exist yet |

## Explicitly pending human work (do not report as done)

- Native-speaker review of any lesson or audio clip (`review.nativeSpeaker` stays `"pending"` in
  every generated report).
- The human listening checklist for audio (`review.audioListening` stays `"pending"`).
- The Phase 1 gate's observed pilot with five new users.
- Physical iPhone / Safari PWA QA, and any signed or notarised distribution decision.
- Deployment, release tagging, merging to `main`, and pushing: **not performed in this handoff.**

## Changes and evidence

### Phase 0A — reconcile status and content reports

Problem: `scripts/content.ts` counted `lesson.legacyExercises` as the course's exercise total and
derived `lessonsWithAudio` from the existence of a legacy `dictation`. For the Italian v2 pack
that reported 199 "exercises" while a learner actually meets 259 reachable activities, and it made
the entire speaking rollout invisible in the numbers that govern expansion.

What changed:

- New `scripts/content/report.ts` (`buildContentReport`) produces a schema-aware report. Reachable
  runtime activities and retained v1 records are counted and labelled separately; every metric
  carries a `basis` string naming what it counts and over what denominator.
- `scripts/content.ts` uses it for every command and writes it to `docs/astra/reports/<language>.json`.
- New `tests/content-reporting.test.ts` (19 tests) pins the reporting contract against the raw
  manifests: reachability is recomputed independently of the reporter, denominators must add up,
  no report may claim a complete A1 level from lesson count, review status must stay `pending`, and
  each committed report must equal a fresh computation.
- `README.md`, `docs/cefr-coverage.md` and `docs/astra/phase-status.md` now carry measured numbers
  and split foundation-course coverage from the older travel fixture.

Measured result (generated, `npm run content:stats`):

| Course | Schema | Lessons | Practice activities | Notice steps | Speaking | Lessons with model audio |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| French | v1 | 25 | 222 | 25 | 0 | 25/25 |
| Italian | v2 | 25 | 233 | 26 | 23 | 25/25 |
| German | v1 | 8 | 48 | 8 | 0 | 1/8 |
| Portuguese | v1 | 8 | 48 | 8 | 0 | 1/8 |
| Spanish | v1 | 8 | 49 | 8 | 0 | 1/8 |

74 lessons, 600 practice activities, 23 speaking steps. Italian's 259 reachable activities now
appear; its 199 retained v1 records are reported separately.

Two findings recorded rather than fixed here: the Italian v2 pack carries no `cefr` tag on its
lessons or concepts (metadata gap), and `self-compare` speaking exists in Italian only.

Gate check — "Italian's live activities appear in reporting; metrics explain their denominator; no
generated report claims full A1 from lesson count": met, pinned by test.

### Phase 0B — reproducible bundles and release checks

Problem 1: `scripts/content.ts` composed `public/study.css` from the canonical lesson stylesheet
**plus the previous contents of the generated `public/study.css`**. Reproduced in isolation with
the old expression (canonical source prepended to the previous generated file, starting from the
bundle's own CSS as esbuild writes it):

    start (bundle CSS only): 105 bytes
    after build 1: 22492 bytes
    after build 2: 44879 bytes
    after build 3: 67266 bytes      (source stylesheet alone: 22386 bytes)

So the old line is self-amplifying. In the real repo the file stayed at 34142 bytes across three
consecutive builds *only* because the esbuild step overwrote `public/study.css` with the bundled
lesson-player CSS first — the accumulation was masked, not absent. Fix: build with `write: false`
and compose the artifact explicitly from `src/features/course-pack/study.css` + the bundle's own
CSS output, throwing if either is missing. No generated file is read. Verified byte-preserving:
`public/study.{js,css,html}` and `catalog.json` were unchanged by the fix.

Problem 2: CI ran `npx next build`, skipping `prebuild` (the deployment-import guard and the
content build) and the `next build --webpack` pin the shipping path relies on. CI now runs
`npm run build`.

Problem 3: the deployment-import guard and the voice-service contract tests had no CI coverage.
Both now have explicit named steps. The voice-service suite needs only
`fastapi`/`uvicorn`/`python-multipart`/`httpx`/`pytest` because the speech and translation engines
are lazily imported — verified locally: **42 passed** with that dependency set and no model
environment.

New `tests/content-build-reproducibility.test.ts` pins: two successive builds are byte-identical;
the generated artifact set leaves no unexplained diff against the index; `public/study.css`
contains the canonical source block exactly once and still carries the player styles; and the
accumulation detector can fail (replaying the old composition yields two source blocks).

Gate check — "clean repeated build; no unexplained generated diff; CI exercises the intended
shipping build path": met, pinned by test.

### Phase 1A — onboarding completion, resumption and capability

Problems found in the source before changing it:

1. `WelcomeFlow.tsx` re-implemented the flag map, availability heuristic and benefit copy inline
   while `src/features/onboarding/state.ts` had the same three things and
   `src/features/onboarding/languages.ts` wrapped them with **no callers at all**.
2. Placement was offered for every displayed language. Only French and Italian have authored item
   sets; Spanish and Portuguese get the A1-only travel fallback, and for German the route does not
   exist (`generateStaticParams` covers the four travel-fixture slugs only). The dashboard's own
   "Take the 3-minute placement quiz" link interpolated `/learn/<course>/placement` for whatever
   course was selected — a dead link for German.
3. Nothing in production ever wrote `status: 'completed'`. Both buttons wrote
   `'welcome-in-progress'` and left it there, and the dashboard treated any stored record as "seen",
   so a learner who quit mid-flow never saw the starting-point screen again.
4. `chooseLanguage` called `setSelectedCourse` on the radio change, before Continue — browsing
   languages silently rewrote the saved course.
5. Corrupt storage and denied storage were indistinguishable from a new learner, so both re-asked
   with no explanation.

Changes: `OnboardingLanguage.placement` derived from the authored sets; `onboardingDestination`
refuses an unsupported placement and a new `preview` intent routes to the course page;
`completeOnboarding()` is the single completion transition; `onboardingResumeScreen()` defines the
resume rule; `readOnboardingOutcome()` separates `unseen` from `invalid`; a session-only storage
mirror (populated only when a write actually fails) makes denied storage finishable in-session, and
the copy says the choice will not survive a reload. The language list now derives its availability
label from the generated foundation catalog, which `content:build` extended with per-pack
lessons/units/practice counts.

Test evidence: 61 unit tests across `tests/onboarding-state.test.ts`, `tests/WelcomeFlow.test.tsx`
and `tests/DailyPathDashboard.test.tsx`; **10/10** e2e in `tests/e2e/onboarding.spec.ts` on
Chromium, including refresh-mid-flow resume, the unsupported-placement alternative, and the
completion record. The spec's old Spanish expectation pinned the over-promise and was rewritten.

Gate check — the code half of Phase 1's gate (capability, completion, resumption, unsupported
placement) is met and pinned. The gate's *observed five-user pilot* is **pending**: it is a human
session and nothing in this repository can close it.

### Phase 2A — French migration pilot: the evidence

The proof was written before any content moved, which is what made the flip reviewable:
`tests/french-pack-migration-parity.test.ts` (all five packs) and
`tests/french-migration-replay.test.tsx` (history replay). Both were then rewritten to describe the
world after the flip — the parity file now runs its real-content equality assertions against the
three packs still at v1 and pins the migrated French pack's own identities, and the replay file
drives the stored v2 pack. Details in the flip section below.

### Phase 2A — the flip (`473b90d`)

`npx tsx scripts/migrate-pack-v1-v2.ts courses/french/manifest.json`, then `npm run content:build`.
French now renders in the v2 player. `public/packs/french.json` (the PWA payload) and
`docs/astra/reports/french.json` were regenerated in the same commit.

Lineage check worth repeating on the next pack: the migration was re-run from the v1 file recovered
from git (`git show HEAD:courses/french/manifest.json`) after a late adapter change, and the result
`git diff --no-index`'d against the earlier output — 4 changed lines, exactly the 4 `practice` →
`predict` purposes, no other byte. The German report's `packBytes` moved by exactly −7 (seven steps,
one character shorter) in the same pass, which is the same kind of check.

What is proven about the migrated pack:

- **Identities.** 247 reachable activities (222 practice + 25 notice), 222 retained v1 exercise
  records replayed as activities, 26 media clips with unchanged hashes, 102 vocabulary entries,
  23 retrieval links, and the lesson/step/exercise identity mapping itself — all asserted against
  the stored artifact, not against a re-run of the migrator.
- **History.** A learner whose practice was written by the v1 player keeps their credit:
  `legacyCredits` names the same lessons, and `CourseWorkspace` rendered against the migrated pack
  shows "1 of 25 lessons practised", the finished lesson as `Complete — select to review`, and the
  next lesson enabled. The companion case with no history asserts "0 of" so the first cannot pass
  vacuously. The e2e walk extends this past a reload, which is the "stored, not just in memory"
  half.
- **Cross-edition.** `tests/portable-environment.test.ts` now loads the migrated pack through the
  portable edition's `loadCourse` and asserts the same lesson ids and the same activity map as the
  hosted `normalizePack`. Phase 2A's gate — "web, offline and portable editions interpret the same
  pack consistently" — is therefore closed at the projection level, and the portable artifact was
  built and verified in this run (`npm run portable:build && npm run portable:verify`, digest
  `c0197aa4…`).

**The migration would have deleted the think-first pause, and nothing would have failed.** The
v1→v2 adapter maps a `think` exercise to a plain `text` activity, which renders its input
immediately — so French's four predictions (`…-think-bonjour`, `…-think-marc`, `…-think-marie`,
`…-identity-foundation-transfer`) would have become fill-in-the-blanks. The adapter now marks those
steps `purpose: "predict"` and the v2 player gates them behind a shared
`src/features/course-pack/ThinkGate.tsx` (the same copy the legacy player renders, so the promise
cannot drift between engines). Clearing the gate is a *commitment, not assistance*: it does not call
`onAssist` and does not taint the attempt, so the prediction keeps full credit — asserted in
`tests/e2e/thinking-lesson.spec.ts` ("a prediction keeps full credit when its gate is cleared").

Suites that pinned the legacy engine were retargeted rather than deleted: CourseExercise,
exercise-feedback, course-start, course-environment, course-storage and the validator /
daily-selection cases in `course-pack.test.ts` now run against German, the remaining v1 pack with
the widest spread of kinds. The v1 dialogue-graph case moved onto the synthetic v1 fixture, because
no shipped pack carries dialogues at v1 any more. The e2e walks detect the player by probing `Check`
vs `Check answer`; the French walks were rewritten as v2 walks.

Known consequences, recorded not hidden (also in `docs/cefr-coverage.md`):

- The v1-only `cefr: "A1"` lesson tags have no home in the v2 schema and were dropped — 25 authored
  tags. Nothing in the product read them; the reports did, and `docs/cefr-coverage.md` now says
  "none on the pack" for French where it said "A1 × 25 lessons". German, Portuguese and Spanish still
  carry their tags, so each of their flips is lossy in the same way: **decide the field's fate
  (schema field or drop) before those three.**
- The v2 course shell keeps concepts and vocabulary behind one "Grammar and vocabulary" disclosure
  instead of the legacy Review/Vocabulary/Grammar views with a vocabulary search, and renders no
  dialogue surface at all. French's two authored dialogues are therefore unreachable in the UI after
  this change (they are still intact in the pack, and Italian has had exactly the same shape since
  before this run). Also recorded as a Phase 3/4 follow-up below.
- `<details>` reference browsing and the language switcher were verified at 320/390/430/844px with
  no horizontal overflow in `tests/e2e/course-packs.spec.ts`.

### Phase 1B — the short first win (`9e69a44`)

A beginner who picks French or Italian now spends one short sequence with the language before the
course opens: hear the phrase, recognise it, build it, optionally say it, concrete recap. Four
practice steps plus the recap, pinned by test so the sequence cannot quietly grow into a lesson.

- **Content comes from the course.** `src/features/onboarding/first-win.ts` holds the two sequences,
  the same shape as the authored placement sets and with the same capability predicate: French and
  Italian have one, Spanish, Portuguese and German go straight to lesson 1 as before. Each sequence
  uses its course's first-lesson words and the pack's existing model recording
  (`fr-first-words-foundation-model.wav`, `it-first-words-foundation-model.wav`), so the welcome
  cannot drift from the course, and adds **no new audio** — which matters, because new audio would
  need a native-speaker pass of its own. Tests assert the reuse, the file sizes on disk, that the
  recognition answer is a meaning the learner was just given, and that the build step leaves exactly
  one distractor.
- **Preparation, not a lesson.** `FirstWinFlow` takes no practice store, no environment, and imports
  nothing from `course-pack`; a source assertion pins that. The e2e walks the whole sequence and
  asserts `localStorage` still holds no practice/lesson key — before *and* after landing in the
  lesson, because landing in a lesson is not practising it.
- **Text-first and sound-optional.** Nothing autoplays, the clip is `preload="none"` and loads only
  when pressed, a failed load degrades to a note with the transcript still on screen, no step touches
  a microphone, and the say step is skippable. The muted-audio e2e case blocks the **service worker**
  so aborting the audio route actually reaches the player — the PWA precaches pack audio and a
  worker-served response is not a page-level route, which is why the first version of that test
  passed against a clip that had loaded fine.
- **The completion transition still happens once.** Choosing the beginner path writes
  `welcome-in-progress` with `entryIntent: 'beginner'` and opens the sequence;
  `completeOnboarding` runs on the recap's action. `onboardingResumeScreen` returns `first-win` only
  where a sequence is authored, and Back drops the recorded path so a reload does not reopen it.
- **The recap ends on three named actions** — start lesson 1, look around the course, run through it
  again — and says in plain words that this was not lesson 1 and nothing here counts as finished.

The pilot's other conditions are covered by test rather than by claim: 390px (the e2e runs the whole
walk there and asserts no horizontal overflow), keyboard alone (tab order is asserted through the
play control, the words and the action), reduced motion (no transforms anywhere in the module, plus
the module's own `prefers-reduced-motion` block — the app-wide kill-switch in `globals.css` does not
reach the portable bundle, so modules that can ship offline carry their own), muted audio and a
broken recording (above), and no microphone (nothing asks for one). The **observed five-user pilot**
remains a human session and is not claimed anywhere.

### Phase 3A — standalone offline Listen, first slice (`2d00afd`)

An eleven-minute track that forgets where you stopped is one you never finish.
`src/features/listen/position.ts` now stores the position browser-locally, with the same rules as
every other local record here (session mirror when storage is denied; never a claim of progress — a
position is not listening, and listening is not mastery). Two rules keep the stored value honest:
under `MIN_RESUME_SECONDS` it is a stray tap and is dropped; within `COMPLETE_WITHIN_SECONDS` of the
end the track is finished, so it is cleared rather than resuming the learner into the last seconds of
something they already heard.

The player says where it will pick up before playing, seeks on metadata, offers "start over" as one
tap, saves on pause / seek / a throttled `timeupdate` / `pagehide` (the usual way a long track ends),
and drops a stored position that is past the end of the file — reachable when a track is re-encoded
shorter. `tests/ListenPosition.test.tsx` (14 tests) pins the store and the player; the roadmap's
cold-start case is now in `tests/e2e/listen.spec.ts`: play, really seek to 4:00, reload the page,
pick the lesson again, find the place kept, then "start over" clears it for good.

**Still open in 3A, and not implied to be done:** exposing Listen from the **portable** single-file
edition needs the long tracks embedded in that bundle, and they are not in pack media yet — which is
also the roadmap's size-reporting item ("include every advertised downloadable track in pack media
and size reporting; allow learners to understand the storage cost"). Inlining five multi-megabyte
tracks as base64 into one HTML file is a real design decision, not a mechanical edit, so it is
deliberately not rushed here. The offline matrix (full cached responses, range requests, interrupted
download, recovery after reconnect, WebKit) is untouched, and so is the gate's device pass.

### Phase 3A, the rest — the audio is part of the download, and Listen is everywhere (`e34973a`, `0acc977`)

The first slice made the player remember where it was. This one makes the audio reach the learner in
the editions that are not the hosted app, and it starts with a measurement, because the roadmap's
size-reporting item and the portable decision both depend on the number.

**The tracks were invisible to every generated figure.** They live in
`src/features/listen/generated/*.json` as `audioUrl` + `durationS` and as five mp3 files under
`public/audio/*-foundations/`, and they are in **no** pack's `media` array — so `installPack` never
cached them, the portable collector never embedded them, and the reports could not total them. They
are also, by a wide margin, the largest thing a learner stores: **28.66 MB across five courses**
(French 4,941,357 B, Italian 5,312,109 B, German 6,082,989 B, Spanish 6,182,445 B, Portuguese
6,127,533 B).

`scripts/content/listen.ts` now measures each one from the file that ships — bytes and sha256 — and
`npm run content:build` writes `src/features/listen/catalog.json`. Every other `content:*` command
re-derives it and refuses to run against a stale catalog, so a re-recorded, truncated or renamed
track cannot keep quoting an old size or silently drop out of the download. The five generated
reports carry the real per-course totals under a `listen` block with its own `basis` string, and the
catalog is in the reproducibility test's `GENERATED` list, so it is held to the same byte-identical
guarantee as `study.css`.

**The download takes the audio with it.** `installPack` gained an `extras` parameter
(`OfflineExtraAsset[]` — url plus digest) and verifies those digests exactly as it verifies pack
media, discarding the whole cache on a mismatch. `OfflineDownload` passes
`listenAssetsFor(language)` and tells the learner the cost **before** they press the button: "24
lessons, practice, recorded audio and 4.9 MB of audio lessons". This is what closes the hole the
first slice left: a learner who saved French for a flight had no audio lessons at all, because the
only thing that had ever cached the track was playing it online first.

**One Listen surface, three editions.** `src/components/listen/ListenLibrary.tsx` (list, states,
player) and `ListenView.tsx` (loads the lesson titles through whatever reader the edition has and
renders the library) were extracted from the hosted page, which now uses them too. Each edition
supplies only what is genuinely different about it: the hosted tab fetches `/packs/<lang>.json`, the
downloaded shell reads the same JSON out of the service-worker cache (`/study.html?view=listen`), and
the portable file reads its own embedded pack. The paper-card rules moved with the list into
`listen-library.module.css`; `tests/paper-motion.test.ts` follows them there rather than quietly
dropping its coverage. The hosted page also stopped rendering a second "Listen" heading and a
duplicate lede once the view carried them.

Listen stays independent of lesson unlocks in all three editions — it is a separate way into the
language, and a locked lesson must not lock its audio.

**The portable file makes the size decision explicit.** One track is ~5-6 MB and base64 adds a
third, so embedding all five would add ~37 MB to a file that is 16.4 MiB; that is a decision for
whoever builds the artifact, not a default it inherits. `npm run portable:build -- --with-listen=french`
(or `=all`) embeds the requested courses' audio (verified against the measured catalog) and writes
`VerbaLibera-Portable-audio.html` — 22.7 MiB for French. Without the flag, the default file still
lists every track and each row says "Not in this file — it was built without the audio lessons",
because a player that fails silently is worse than saying so. Both artifacts pass `auditPortableHtml`.

**Smaller things this needed:** both esbuild bundles (offline and portable) now declare the `@/`
alias the shared components import through; `tests/e2e/portable-listen.spec.ts` drives the real
`--with-listen` CLI rather than importing the builder, because Playwright's loader cannot import the
JSON the builder reads; and `ListenView` is written to satisfy the repo's React Compiler lint rules
structurally (results tagged with their course, the reader ref refreshed in its own effect) rather
than with suppressions.

**Proof, not just green tests.** The stale-catalog detector was shown to fail on three doctored
inputs (a size that no longer matches, a digest that no longer matches, a catalogued track that is
not on disk). The offline e2e test downloads French for real, asserts the track is in the installed
pack cache **before** the network is switched off, then opens the downloaded edition with the network
off, seeks to 5:00, reopens it, and finds the position kept. The portable e2e plays the embedded
track from a `blob:` URL on Chromium **and** WebKit, and separately checks the honest state of the
file built without audio.

**Still open in 3A, and not implied to be done:** the offline matrix's failure cases (range requests,
an interrupted download that resumes, recovery after reconnect), a WebKit run of the *service-worker*
offline path (the WebKit coverage above is the portable file), and the gate's physical-device pass,
which is human work. The 4.9-6.1 MB figure is also a download cost the learner is told about for the
first time — a smaller-track option (a lower bitrate, or a shorter first track) is a content decision,
not an engineering one.


### Phase 2B's blocker, resolved: the migration now carries the CEFR tag (`4bac558`)

The user's instruction was explicit — do not flip German, Portuguese or Spanish until the CEFR
metadata loss is resolved deliberately. It is resolved now, in the place the loss happened.

**What was lost and why it was invisible.** Every v1 lesson carries `cefr: "A1"` (the v1 schema
requires it). The v2 lesson shape had no field for it, and `migratePackV1ToV2` builds its lessons from
the *runtime* shape, which never carried the tag — so the French flip dropped 25 tags. Nothing failed.
The packs validated, the parity and replay tests passed, and the only trace was `authoredCefrTags`
going to zero for a v2 pack while the v1 packs kept theirs: a reporting gap that reads exactly like a
pack that claims nothing.

**The fix.** `lessonSchemaV2` gains an optional `cefr: z.literal("A1")`, and `migratePackV1ToV2`
re-attaches the tag from the raw source by lesson id rather than from the runtime shape. Three
deliberate properties:

- **optional**, because a v2 pack authored without a level claim must stay quiet rather than acquire
  one, and `tests/pack-migration-cefr.test.ts` asserts the untagged case reports `{}`;
- **narrow**, because `A1` is the only level this project claims — a `B2` tag is rejected by the
  schema, so the field is a claim that can be checked rather than a free-text label;
- **sourced from the authored file**, so the migration cannot invent a tag it was not given.

The test runs against the three packs still at v1 — German, Portuguese and Spanish — and writes no
manifest, so the guarantee is proven on real content without touching a shipped pack. It includes a
non-vacuity case: stripping the carry from the output reproduces the French failure exactly (tag
count zero while the source has tags).

**The design decision the user asked for, recorded rather than taken:** French and Italian were
flipped before the field existed, so their committed manifests have no tags. Re-running
`npx tsx scripts/migrate-pack-v1-v2.ts` on each language's v1 source would restore them — that is a
data change to an already-shipped pack (with its own parity/replay re-verification), so it is left as
an explicit choice. Flipping German, Portuguese and Spanish is now non-lossy, which was the gate.


### Graphics acceptance item — the German banner

The untracked brief (`docs/superpowers/briefs/graphics-review.md`) asked for the German course
banner defect on mobile. Diagnosis first, because "the banner looks wrong" has three different
causes:

- **Not the asset.** `public/brand/courses/german.jpg` is a finished 2064×512 illustration (a
  half-timbered street with a fountain), subject horizontally centred and filling 85–95% of the
  frame height, identical geometry to the other four banners.
- **Not the crop.** At 390px the banner renders 390×96.7px from `aspect-ratio: 2064 / 512` — the
  same as the four that already worked.
- **The two hand-maintained "no art" flags.** German was the only course with no banner on the
  landing page (`noArt: true` in `CourseShowcase.tsx`, which skips the whole `<Image>`) and in the
  course library (`alt: ''` in `src/app/courses/page.tsx`, where the banner is gated on a truthy
  `alt`). Both surfaces encoded a filesystem fact as a flag to keep in step, and neither had been
  updated since the artwork landed.

Fixed by removing the flag and its now-unreachable badge branch (the type no longer accepts
`noArt`, so re-adding it fails `tsc`) and giving German real alt text on both surfaces. The German
card now carries the same `Structured · A1` badge as the other four.

Guards, both proven to fail: `tests/course-banners.test.ts` (7 tests) compares both listings against
`public/brand/courses/` in both directions and against the lesson-view `BANNER_BY_LANGUAGE` map;
`tests/e2e/landing-page.spec.ts` gained the assertion the existing loop could not make — that loop
asserts every image on the landing page loads, which passes trivially for a card with no image. The
new one asserts the opposite: every course card has a visible banner taller than 60px at 390px on
`/` and in `/courses`.

The injection proof itself was worth the two attempts. Re-adding `noArt: true` left the e2e test
green, and the reason was not staleness: with the flag's consumer deleted, the JSX ignores the flag,
so the banner still rendered — the removed branch is what makes the flag unreachable. A second
injection that actually skipped the German `<Image>` turned the e2e test red at
"german has no banner on the landing page". A guard proved with an injection that no longer reaches
the code it is supposed to protect proves nothing.

Two related findings, one fixed in the same pass: the course library's "Already know some German?"
placement link was gated on `kind === 'foundations'` rather than placement capability — the same
class as the Phase 1A bug, and correct today only by coincidence. German's absence from
`progress.courses` still stands (see the blockers).

**The fourth surface, found during the French flip.** The brief asked whether the portable/offline
player uses the same asset. It did not: `scripts/portable/content.ts` hand-listed four banner paths
and skips a missing file silently, so `german.jpg` was never embedded in the offline bundle. That
bundle is a single HTML file under `img-src blob: data:` and `media-src blob: data:`, so a banner
that is not embedded cannot load at all — no broken-image icon, no request, just an empty frame. The
list is now derived from the generated catalog, and the guards are behavioural rather than a bare
count: `tests/course-banners.test.ts` asserts the collected bundle carries one banner per catalogued
course, and `tests/portable-builder.test.ts` asserts assets = pack media + one banner per pack.
Proven non-vacuous by restoring the old four-entry list: the new test failed with the exact message
"the offline bundle does not embed public/brand/courses/german.jpg". The previous assertion
(`toHaveLength(60)`) would have caught the extra asset but could not have said which one it was.



## Test evidence

Run in this worktree, macOS 26.6.2 / Node v25.9.0 / npm 11.16.0.

| Command | Result |
| --- | --- |
| `npm run content:validate` (runs inside every `content:*` command; verifies every declared media hash) | exit 0, five packs |
| `npm run content:build` ×3 before the fix | exit 0, `public/study.css` stable at 34142 bytes — masked accumulation, reproduced separately (22492 → 44879 → 67266 → 89653 bytes) |
| `npm run content:build` ×2 after the fix | exit 0, byte-identical, pinned by test |
| `npx vitest run` (after 1B and the 3A slice, `2d00afd`) | **137 files passed, 1 skipped; 1061 passed, 6 skipped** |
| `npx vitest run` (after the 3A entry points, `0acc977`) | **140 files passed, 1 skipped; 1081 passed, 6 skipped, 0 failed** (an intermediate run showed one red file, `content-build-reproducibility`, reporting the not-yet-committed regenerated bundles — see the note under the table) |
| `npx vitest run` (after the CEFR carry, `4bac558`) | **141 files passed, 1 skipped; 1089 passed, 6 skipped, 0 failed** — the same reproducibility file was red until the regenerated `public/study.js` was committed with it |
| `npx vitest run tests/pack-migration-cefr.test.ts` (alone) | **9 passed** — three v1 packs' tags carried, the untagged v2 case quiet, `B2` refused, and a non-vacuity case |
| `npx tsc --noEmit` | exit 0 (run after `npm run build`; a bare `tsc` on a freshly deleted `.next` reports `Cannot find name 'PageProps'`, which is the documented ordering quirk, not a break) |
| `npm run lint` | exit 0 (0 errors, 31 pre-existing warnings) |
| `npm run build` | exit 0 (`next build --webpack`), all routes emitted |
| `python -m pytest services/voice/tests -q` | **42 passed** (contract deps only, no model environment; unchanged this run — the voice service was not touched) |
| `npm run portable:build && npm run portable:verify` | exit 0, 16.4 MiB, no audio lessons embedded by default; digest recorded by `portable:verify` as `dist/portable/VerbaLibera-Portable.html.sha256` |
| `npx tsx scripts/portable/build.ts --with-listen=french` + `verify.ts` | exit 0, **22.7 MiB** (the French track, 4,941,357 B → 6,588,476 B of base64), audit clean |
| `E2E_BASE_URL=http://localhost:3101 npx playwright test --project=chromium --workers=1 tests/e2e/listen.spec.ts tests/e2e/offline.spec.ts` | **8 passed** — including "the downloaded edition can listen to the audio lesson with the network off" (download → cache asserted → offline → decode → seek → reopen → resume) |
| `npx playwright test --config playwright.portable.config.ts` | **8 passed** (Chromium **and** WebKit): the audio file plays and resumes its Listen track, the default file states what it cannot play, and the two pre-existing portable cases still hold |
| `E2E_BASE_URL=http://localhost:3101 npx playwright test --project=chromium --workers=1` (whole suite, after 1B and 3A, previous run) | **74 passed, 3 skipped** — the 3 are the account specs that need `E2E_ACCOUNT_TEST` and a disposable Postgres. `tests/e2e/portable.spec.ts` ran for the first time here: it had been failing on `ERR_FILE_NOT_FOUND` because the portable artifact is built by `npm run portable:build`, a CI step the earlier local runs did not reproduce. |
| `E2E_BASE_URL=http://localhost:3101 npx playwright test tests/e2e/onboarding.spec.ts` (alone) | **13 passed** — the phase's own gate conditions (390px, keyboard, muted audio, resume) read worst-case when run on their own |

`tests/content-build-reproducibility.test.ts` deliberately fails between a code change and the commit
that carries its regenerated bundles: it compares the artifacts on disk against the index, which is
what makes a hand-edited `study.js` impossible to slip through. It is green at `0acc977`.

Earlier phases' runs (onboarding 10 passed, landing-page 8 passed) are in the Phase 0/1A sections
above; the numbers in this table are the post-flip state and supersede them.

Full record with artifact digests: `docs/superpowers/verification/2026-09-10-phase-0-baseline.md`.
The template for future notes is `docs/superpowers/verification/RELEASE-VERIFICATION-TEMPLATE.md`.

**E2E hazard found during this run (worth fixing in the harness).** Playwright reuses any dev server
already answering on `:3100` (`reuseExistingServer: !process.env.CI`). A `next-server` from the main
tree had been listening there for three hours, so the first e2e attempt ran the spec against the
**other tree's code**: the three oldest tests passed and the four new ones failed, which reads
exactly like a broken change. Nothing in the output says which commit is being served. The run above
was redone against a dev server started from this worktree on `:3101` with `E2E_BASE_URL` set, which
also skips the config's own `webServer`.

## Commits

| Commit | Contents |
| --- | --- |
| `d8f1b55` | Phase 0A — schema-aware content reporting, regenerated reports, README/CEFR/phase-status updates, `tests/content-reporting.test.ts` |
| `0f9cbe3` | Phase 0B — `public/study.css` composed from source, reproducibility test, CI on the shipping build path, voice-service CI coverage |
| `b355e51` | Phase 1A — onboarding completion/resume/capability, generated catalog facts, updated unit + e2e specs |
| `e29fdb8` | Phase 2A evidence — French migration parity and history-replay proof |
| `9239350` | Run record — evidence, blockers and continuation instructions |
| `8abc711` | Placement capability on the course library (same class as the Phase 1A bug) |
| `64ba98a` | Graphics acceptance item — German's banner restored on both surfaces, with unit + e2e guards |
| `473b90d` | **Phase 2A — French migrated to schemaVersion 2**, the shared think-first gate, retargeted legacy suites and e2e walks, the offline banner fix |
| `02aa8d6` | Run record — the French flip, its evidence and its losses |
| `9e69a44` | **Phase 1B — the short first-win sequence** for French and Italian, text-first and sound-optional, with resume and a concrete recap |
| `2d00afd` | **Phase 3A slice 1 — Listen remembers where a long track was left**, and resumes there across a cold start |
| `e34973a` | **Phase 3A — the long tracks measured into a generated catalog, cached by the download, and Listen exposed in the downloaded and portable editions** |
| `0acc977` | ListenView rewritten to satisfy the React Compiler lint rules structurally; portable Listen spec drives the real CLI |
| `0fb7889` | Run record — the Listen slice, its numbers and what is left |
| `4bac558` | **The v1→v2 migration carries the authored CEFR tag** (Phase 2B's blocker, resolved in code with tests, without flipping a pack) |

Nothing was pushed. No merge to `main`, no tag, no deployment.

## Next tasks

1. **Phase 3A, the remainder.** (a) the offline matrix's failure cases in `tests/e2e/listen.spec.ts`
   and `tests/service-worker.test.ts`: a range request (the SW already refuses to cache 206s — see
   the comment in `public/sw.js`), an interrupted download that resumes, recovery after reconnect,
   and a cold offline navigation straight to the Listen view; (b) the same offline walk on **WebKit**
   (the WebKit coverage that exists is the portable file, not the service-worker path); (c) the gate's
   physical-device pass, which is human work.
2. **The Listen player brief** (`docs/superpowers/briefs/listen-player-design.md`, appeared in the
   tree mid-run and is still untracked): a Warm Studio player card with 15-second back/forward,
   playback speed, a transcript toggle and a visible download/offline state, preserving the position
   and offline behaviour above. The player has the transcript and the save-audio link today; the
   transport controls and the speed control are new work, and the brief asks for focused component
   tests plus updated e2e coverage. This is the natural next slice — it is the same surface, and it
   should land before any further Listen expansion.
3. **Phase 3B — audio expansion** for German/Spanish/Portuguese and one reviewed long track per
   language. Blocked on the human listening checklist; can be prepared but not closed here.
4. **Phase 2B — the remaining packs' flip** (German, Portuguese, Spanish). **The `cefr` gate is
   cleared** (`4bac558`): the migration carries the authored tag and three tests prove it against the
   packs still at v1, so a flip is no longer lossy. What remains is the mechanical work the French
   flip paid for (see the flip section below) — and one decision: whether to repair French's and
   Italian's committed manifests by re-migrating them from their v1 sources.
5. **Phase 4 — curriculum depth**, which needs editorial/native-speaker capacity.
6. **`docs/superpowers/briefs/graphics-review.md`** — the German banner defect is fixed on all four
   surfaces (landing, course library, lesson view, offline bundle); the brief's "commission new art"
   half is a design decision for the user, and the file is still untracked.

## Precise continuation instructions

### To finish Phase 3A (standalone offline Listen)

Landing status: the audio is installed with the download and Listen is reachable in the hosted,
downloaded and portable editions, with position kept in all three. What is left is the failure side
of the matrix and the device pass.

1. Range requests. `public/sw.js` already refuses to cache a 206 (`response.status === 200` guard) —
   assert it: play a track, seek, confirm a 206 came back and that nothing partial was stored in
   `verbalibera-static-*`. A cached 206 is how a long track would come back truncated offline.
2. Interrupted download. `installPack` deletes its own cache on any failure and only writes
   `/__course_pack_ready__` last, so an interrupted install is invisible to the SW — prove it with an
   aborted `fetch` (Playwright `route.abort()` mid-sequence) and then a successful retry.
3. Recovery after reconnect, and a cold offline navigation straight to `/study.html?view=listen` with
   the app never having been online since install.
4. WebKit service-worker run: the portable config covers WebKit; the offline spec runs Chromium only.
   Add a WebKit project for `offline.spec.ts` (the dev server must be started from this worktree, or
   Playwright reuses the main tree's — see the e2e section below).
5. The rest of the gate is a human device pass. Nothing in this repository can close it.

### To extend Listen to another course or edition

The catalog is the single source of sizes and digests: `src/features/listen/tracks.ts` lists the
tracks, `scripts/content/listen.ts` measures the files, and `npm run content:build` writes
`src/features/listen/catalog.json`. Add a track to `tracks.ts`, put the mp3 at the `audioUrl` it
names, rebuild, and the Listen view, the download flow and the content reports pick it up with no
further edits — `tests/listen-catalog.test.ts` fails if the catalog, the files and the app disagree.
A new edition needs only a `readCourse` (how it reads a pack) and, when its audio is not at the plain
URL, a `resolveAudioSrc`; everything else is shared.

### To start Phase 1B for another language

`src/features/onboarding/first-win.ts` is the only file to edit: add an entry keyed by course slug
and it becomes available, because the flow asks `firstWinFor(slug)` rather than listing languages.
Reuse the course's own first-lesson words and its existing model recording — new audio needs a
native-speaker pass, which is why neither existing sequence records anything. `tests/first-win.test.ts`
asserts the invariants for every authored sequence, so a new one is covered by adding it to
`AUTHORED`.

### To flip the next pack (German, Portuguese, Spanish)

The CEFR gate is cleared as of `4bac558` — the migration carries the authored tag, and
`tests/pack-migration-cefr.test.ts` proves it on the packs still at v1. Re-run that test after a flip:
it will then be asserting the *committed* v2 manifest carries the tags, which is the check that the
French flip failed silently.

The migration itself is mechanical — `npx tsx scripts/migrate-pack-v1-v2.ts
courses/<language>/manifest.json`, then `npm run content:build`. What costs the time is the same
list the French flip paid:

1. Recover the v1 file if you need to re-run after an adapter change:
   `git show <commit>:courses/<language>/manifest.json`, then `git diff --no-index` the two
   migration outputs and check the delta is exactly what you changed and nothing else.
2. Move every legacy-engine suite that reads the pack onto a pack that is still v1. After all five
   are flipped there is no such pack left, and `tests/fixtures/lesson-variety.ts` becomes the only
   host for those suites — that is the moment to extend the fixture rather than delete the
   assertions.
3. Rewrite the e2e walks for that language as v2 walks (`tests/e2e/helpers/complete-l0.ts` has the
   pattern) and re-check the course-page assertions in `tests/e2e/course-packs.spec.ts`, which
   describe the v2 shell's disclosure rather than the legacy links.
4. Run the whole suite, not the language's specs: the reports and the portable bundle are generated
   across all five packs, and `tests/content-reporting.test.ts` will catch a stale report.

### To run the e2e suite here (the trap that cost a cycle twice)

Playwright reuses any dev server already answering on `:3100` (`reuseExistingServer: !CI`). The main
tree keeps one running for hours. Start your own from this worktree on a free port and pass
`E2E_BASE_URL`, and build the portable artifact first (`npm run portable:build`), or
`tests/e2e/portable.spec.ts` fails with `ERR_FILE_NOT_FOUND` and reads like a broken change.
`next build` and `next dev` cannot share `.next`: delete it before starting a dev server after a
build.

## Blockers and open questions

- **Human work that cannot be closed here:** native-speaker review, the observed five-user pilot,
  the audio listening checklist, physical-device QA, and any signed/notarised distribution decision.
- **`docs/superpowers/briefs/graphics-review.md`** (untracked, not written by this run) is now
  **actioned**: see the graphics section above. Its broader "audit the existing graphics and
  consider commissioning new art" half is a design decision, not a defect fix, and is untouched.
  The brief itself is still untracked — decide whether it belongs in the repository.
- **Found, not fixed (out of the packages above):** German has a foundation pack and a course page
  but is absent from `progress.courses` (the travel fixture's four slugs), so it never appears in
  the dashboard's language switcher or the welcome flow, and `/courses` is its only entry point
  besides a direct URL. Adding it means changing the dashboard's course universe — a Phase 1B-scale
  change, not a Phase 1A fix.
- **Found, not fixed — the v2 dialogue gap, with the next plan.** After the French flip no shipped
  course reaches a dialogue through the UI: `DialogueView` is rendered only by the legacy shell
  (`CourseWorkspace.tsx:638`) and the v2 shell (`RuntimeCourseWorkspace.tsx`) has no dialogue surface,
  so French's and Italian's dialogues sit in the pack unreachable. This is now answerable with the
  same extraction that fixed Listen, and it needs no new content:
  1. `src/features/course-pack/DialogueView.tsx` already takes `{dialogue, language}` and does the work;
     what is missing is a way in. Add a **Dialogues** view to the v2 shell's navigation beside Course
     and Listen, fed from `pack.dialogues` (the runtime pack carries them — `normalizePack` keeps the
     array, which is why the migration preserved them).
  2. Guard it on content, not on a flag: render the view when `pack.dialogues.length > 0` and say so
     honestly when it is empty, the way Listen says a course has no recording yet.
  3. Tests: a component test for the view's states, plus an e2e walk of one French dialogue (the pack
     has two) reaching the choice graph and a `complete: true` node.
  4. Then decide the opposite case deliberately — a v1 pack with no dialogues renders no such view,
     which is the same "capability derived from data" rule the placement link and the banner list now
     follow.
  Deliberately not started in this run: it is a new surface (navigation, focus order, and a shell that
  is generated into `public/study.js`), and the Listen player brief above sits on the same shell.
- **Found, not fixed (app-wide layout):** on a ≤767px viewport the floating bottom tabs own the last
  ~84px of the screen. `globals.css` reserves that space at the *end of the document*, which does not
  stop a control that happens to land in that band mid-page from being partly covered: measured at
  390×844, `elementFromPoint` at the centre of the first win's "Skip this step" button returned the
  tab bar, so a centre-tap goes to the tabs. A human taps the visible part, and the tests scroll a
  control to the viewport centre before tapping (`tests/e2e/helpers/first-win.ts`), but the band is
  real for every screen and worth a proper fix — `scroll-padding-bottom` on the scrolling container,
  or making the tab bar part of the layout instead of floating over it.
- **Solved this run, kept for the record:** the long Listen tracks are no longer invisible — they are
  measured into `src/features/listen/catalog.json`, cached by the download, embedded by the portable
  build on request, and totalled in the content reports. The earlier note ("not in any pack's `media`
  array, so the offline bundles and the size reporting cannot see them") no longer holds.
- **`docs/superpowers/briefs/listen-player-design.md`** (untracked, appeared in the tree mid-run while
  this run was working on the same surface) is **not implemented**. It asks for a Warm Studio player
  card with 15-second back/forward, playback speed, a transcript toggle and a visible offline state,
  preserving position and offline behaviour. The player already has the transcript, the save-audio
  link and the resume state; the transport and speed controls are new work. The brief's own
  constraints are sensible and it should be the next slice — it is written up as such in "Next tasks".
- **Found and fixed this run:** `authoredCefrTags` is no longer empty for migrated packs — the v1→v2
  migration carries the tag (`4bac558`). The three packs still at v1 will keep it when they flip.
  The two packs already flipped (French, Italian) have no tags in their committed manifests; repairing
  them means re-running their migration from the v1 source, which is a data change for the user to
  decide, so it is recorded rather than done.
- **Found and fixed in passing:** the course library's placement link was gated on `kind ===
  'foundations'`; German's two "no art" flags; the offline collector's hand-written banner list.
  All three are the same disease as the Phase 1A bugs — a capability encoded as a hand-maintained
  flag rather than derived from data.
