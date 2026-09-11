# Hermes — development roadmap progress

Run started 2026-09-10. Model: **deepseek-v4-flash** (as instructed; no work routed elsewhere).
Roadmap source: `docs/superpowers/plans/2026-09-10-development-roadmap.md`.
Worktree: `/Users/spkoehl/Documents/ChatGPT/VerbaLibera/.worktrees/hermes-830d4bcc`
Branch: `hermes/hermes-830d4bcc` (base `e825dd1`, from `feat/fr-it-variety`).

This file is updated as each phase lands. "Pending" below always means *not performed*, never
"assumed fine".

## Current phase

**Phases 0, 1A, 1B, 2A, 2B (German) and 3A are complete apart from the gate's physical-device pass.**
The previous block flipped German to schemaVersion 2, fixed the second field the migration was dropping
(`culturalNote`), retargeted the legacy suites onto Spanish, and closed the v2 dialogue gap.

This block was the graphics/artwork pass, run against `docs/design/graphics-brief.md` — the project's
own brief, which the roadmap's acceptance item (`docs/superpowers/briefs/graphics-review.md`) sits on
top of. Three defects, all reproduced in a browser before they were fixed: **the v2 course shell
rendered no banner at all** (French, Italian and German had no artwork on their own course page while
the library kept showing the same file), **the banner was an ~85px strip on a phone** (the whole 4:1
frame scaled into the column with the drawing inside it too small to read), and **the lock screen
showed metadata with no artwork** while an audio lesson played. It also cleared the brief's named
leftovers: declared image dimensions are guarded now, and a 1MB asset from another project is out of
`public/brand`.

The graphics block continued with two things: **every shipped asset verified against the approved
references in `~/Downloads`** (measured, not asserted — the four other course banners and the lockup
are byte-faithful re-encodes, and `german.jpg` turns out to be the approved art *re-framed* 278px
inside its frame, which is documented in the design brief but had never been measured), and the
**offline reconnect page given the app's own state mark** so the one screen that has to work with no
network is not a bare card. `docs/asset-provenance.md`, which described two files that no longer
exist and none of the current set, is rewritten around the measurements.

Then the two approved assets the user supplied landed: **four vocabulary pictures** normalised to
the 16:9 contract and ground-snapped, with the alt text corrected where the old photograph's wording
no longer described the drawing (the drill's accessible name is that alt text), and the **German
banner restored to its approved framing** — measured at a 0px shift against the reference where the
re-framed file it replaced needed +278 px, with the narrow-viewport crop re-measured to 2.749 @ 100%
and the regenerated `study.js` carrying exactly those two numbers of change. The German banner
decision recorded as open in the previous block is therefore closed, and the four pictures are the
worked example for converting the remaining photographs.

The next block landed ten more of those assets: **five vocabulary pictures**
(key, bed, suitcase, ambulance, police — with `key.jpg` deliberately not
ground-snapped, because its most common colour is the drawn door rather than a
ground) and **five lesson scenes**, which are the app's first scene artwork. The
scenes are keyed by situation in `src/features/course-pack/scenes.ts` and render on
the travel-session intro and both lesson intros; they are embedded in the portable
edition and cached offline on view. Thirteen photographs remain unconverted, and the
one printed sign inside the approved scene art is recorded in
`docs/image-provenance.md` and barred from `src/` by a test.

The next packages, in the order they are written up below: **2B continues** — flip Portuguese, then
Spanish, now a mechanical repeat of the playbook below (German's flip is the worked example) — **3B**
(audio expansion, blocked on the human listening checklist, and the only thing standing between the
three starter packs and audio in every lesson), and **Phase 4** (needs editorial capacity). Phase 7
stays behind its evidence gates.

## Phase status

| Phase | State | Notes |
| --- | --- | --- |
| 0 — baseline and reproducible release inputs | **Complete** | 0A report reconciliation, 0B reproducible bundles + CI parity |
| 1 — complete the first ten minutes | **1A and 1B complete** | 1A: onboarding state machine, completion/resume rules, placement capability. 1B: the short first-win sequence for French and Italian, text-first and sound-optional, with resume and a concrete recap. The gate's observed five-user pilot is a human session and stays pending. |
| 2 — consistent activities and progress | **2A and the first 2B flip (German) complete; Portuguese and Spanish remain** | French migrated to schemaVersion 2 (`473b90d`) with identity parity and history replay proven by test, plus the compensating think-first gate the move would otherwise have deleted. German followed through the same migration, keeping all 8 authored CEFR tags and all 8 `culturalNote`s, both of which the migration used to drop (`4bac558` for the tags, then the schema + census fix for the notes). Portuguese and Spanish stay v1 until their turn; `tests/pack-flip-rehearsal.test.tsx` drives the v2 shell over each of them in memory and over the flipped packs as stored. |
| 3 — listening and speaking everywhere | **3A complete except the device pass** | Position, resume and cold start (`2d00afd`); the long tracks measured into a generated catalog, cached by the download, and Listen exposed in the downloaded and portable editions (`e34973a`); the player card the brief asked for (`4043f14`); the offline failure matrix and WebKit coverage (`bfc61d5`). The gate's physical-device pass is human. 3B needs the human listening checklist |
| 4 — curriculum depth | Not started | Needs editorial/native-speaker capacity; do not start before Phase 2 |
| 5 — daily practice and visible learning | Not started | Depends on stable event contracts from Phase 2 |
| 6 — verified releases | Not started | Physical-device QA and signing decisions are human tasks |
| 7 — evidence-led A2 / advanced tools | **Deliberately not started** | Conditional on reviewed A1 pilot and learning evidence that does not exist yet |

## Explicitly pending human work (do not report as done)

- Native-speaker review of any lesson or audio clip (`review.nativeSpeaker` stays `"pending"` in
  every generated report).
- **Art direction** (added by the graphics pass): whether the German banner's approved framing needs
  a wide-frieze regeneration to match the other four (it is the approved artwork now; the question is
  only whether that artwork should be redrawn wider), whether the remaining 13 vocabulary
  photographs are redrawn as illustrations, and the lesson-scene illustration set the brief lists.
  All of these need an image model and a human eye; making the *existing* art legible on a phone is
  the part that could be settled in code, and it was.
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
`tests/migrated-pack-parity.test.ts` (all five packs) and
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


### The Listen player card — the visual brief, implemented (`4043f14`)

`docs/superpowers/briefs/listen-player-design.md` asked for a compact Warm Studio card: cream paper,
dark outline, terracotta primary play, the existing hard-offset shadow, a readable progress bar with a
large scrubber, 15-second skips, a speed control, a transcript toggle, a visible download/offline
state, and mobile sizing that does not become a full-screen player — while preserving the native audio
element's accessibility role, the URLs, the caching and the stored position.

**What it renders now.** A header with a language mark (`FR`, `IT`, …) where cover art would go — an
image per track is bytes the offline bundle would carry and a licence nobody has checked — the lesson
title, the course, the length. Then the states (provenance note, heard, resume), a transport row of
±15s and one terracotta play/pause button, a real `input[type=range]` scrubber over a painted fill
with a time readout, a speed select (1×, 0.75×, 1.25×, 1.5×), and the offline line.

**The native element is still the layer.** `<audio controls>` keeps its `controls`, its `src` and its
`preload="metadata"`, and the card's controls only call into it. It is visually hidden now (the card
is the visible UI), which is a real decision: the custom controls are all genuine buttons, a select
and a range input, so keyboard and screen-reader users get the same transport, and the element remains
what a browser without our JavaScript falls back to. The e2e asserts the element is still attached
with the right source and label.

**The offline line reports Cache Storage**, the same store the service worker reads, so "saved on this
device" means what it means offline; a device that is offline with an unsaved track says exactly that.
The manual save link and the `download` attribute are untouched.

**Two defects found by the tests, not by eye:**

- the settings row's `flex-basis: 15rem` became a *240px-tall empty paragraph* in the phone layout, so
  the card was 756px on a 390px screen. The new e2e measures the card and caught it; it is now 571px,
  well under the brief's "not full-screen".
- ±15s read React state rather than the element, so a skip after any external seek moved from the
  wrong place.

**Copy change:** the resume state now reads "Resume from 4:32" (the brief's wording) instead of "You
stopped at 4:32", so the unit and e2e suites that pinned the old sentence were updated with it.

**Tests:** `tests/ListenPlayer.test.tsx` (18 cases: the transport drives the element, skips clamp at
both ends, the scrubber seeks and announces a time, speed changes playback, the offline line in all
four states — saved, unsaved, offline-unsaved, no Cache Storage — and the native element still
present), plus a new e2e case that measures every transport target at 390px, seeks, changes speed,
opens the transcript and checks the card's size. The portable run covers the same card in both engines,
which is where Safari's engine actually gets exercised.

### The offline matrix, and what WebKit will and will not do (`bfc61d5`)

The failure half of the roadmap's gate, plus the engine question. Four unit cases in
`tests/service-worker.test.ts` (a saved pack served with the network down; the long track served from
the *installed pack* rather than only the static cache; a download that never finished refused rather
than half-served; another app's cache not mistaken for an installation), one in
`tests/offline-install-listen.test.ts` (the transfer dies after the pack arrived — nothing left
installed, retry installs cleanly), and `tests/e2e/offline-matrix.spec.ts` for the browser cases:
a failed download that leaves nothing behind and succeeds on retry, an offline track that plays from
the saved copy while storing nothing partial, recovery when the connection returns, and a cold offline
start straight into Listen. `playwright.offline.config.ts` (`npm run test:e2e:offline`) and a CI step
run them on Chromium and WebKit on their own port, so no run can reuse another server.

**Three findings worth more than the tests themselves.**

1. **The download control told learners "Failed to fetch".** With no connection, `installPack`'s first
   fetch rejects before any of its own messages, and the component rendered the engine's words. It now
   says "Download failed — check your connection and try again. Nothing was saved.", keeps the
   actionable messages for the failures `installPack` detects, and `tests/OfflineDownload.test.tsx`
   covers all four ways that goes.
2. **Playwright cannot interrupt a download from outside.** `installPack` runs in the page but the
   service worker answers the fetch, and Playwright's routing does not see worker-initiated requests —
   probed: 0 routes matched and the install completed. So the mid-flight case lives at the unit level
   where it is deterministic, and the e2e covers the failure a learner can actually produce.
3. **Playwright's WebKit cannot navigate with the network emulated off** — any `goto` or `reload`
   raises "WebKit encountered an internal error", with no app code involved, and it cannot play media
   out of Cache Storage while offline either. The WebKit project therefore runs the cases it can
   express (install, Cache Storage contents, the failure copy) and the rest skip *with that reason in
   the test*, rather than being quietly dropped. **This is a tooling limitation, not a verdict on the
   app**: the gate's WebKit/iPhone pass remains human work, and the portable WebKit run — a file with
   no network to reach for — already covers "plays with no network at all" in both engines.

### Phase 2B preparation: a flip rehearsal, so the next flip is mechanical (`tests/pack-flip-rehearsal.test.tsx`)

`tests/migrated-pack-parity.test.ts` proves the migration is *identical* for each pack still
at v1 (same lessons, steps, reachable activities, media hashes, retrieval links) and
`tests/pack-migration-cefr.test.ts` proves the authored CEFR tags survive. Identical runtime output is
not the same claim as "the course still runs", though — the French flip needed a compensating
think-first gate for exactly that reason — so the rehearsal drives the **v2 shell over each pack as if
it had been flipped**, with the manifest on disk untouched: migrate in memory, validate the result,
open the first lesson, begin practice, clear any information steps, answer the first practice surface
(whichever kind the content uses), and require an outcome. It also walks the *unflipped* pack through
the legacy shell, because the flip must leave the old engine working for progress and replay.

**What a flip still costs** (the inventory, corrected by actually doing it): the suites pinned to
German as the last v1 host were `tests/CourseExercise.test.tsx`, `exercise-feedback.test.tsx`,
`course-start.test.tsx`, `course-environment.test.ts`, `course-storage.test.ts`, `course-pack.test.ts`,
`think-gate-migration.test.tsx`, `portable-environment.test.ts`, plus the four migration-evidence
suites that list the v1 packs by name. `DailyPathDashboard.test.tsx` and `course-banners.test.ts` were
listed here as German-pinned and are not: they read the travel fixture and the banner catalog. No e2e
spec walks German (checked: `tests/e2e/*` mention it only as static-media and banner data), so the
browser half of the retarget was empty — worth checking again after the next flip rather than assumed.
Spanish was chosen as the new host because all three v1 packs have an identical shape (8 lessons, 48-49
exercises, the same kind census, ids of the form `<xx>-<topic>-foundation`), so the retarget was
mechanical and the assertions kept real content. When the last v1 pack goes,
`tests/fixtures/lesson-variety.ts` has to become the host — that is the moment to extend the fixture
rather than delete the assertions.


### Phase 2B — the German flip, and the second field the migration was dropping

**The loss found before the flip, not after.** Preparing German turned up the same class of defect the
CEFR tags were: a v1 lesson field with no home in v2. `explanation` and `examples` look dropped if you
compare lesson objects — they are not, `adaptV1` relocates them into the lesson's opening
`information` activity body and an `examples` stimulus, which is what the v2 player renders. The one
field that really did vanish is `culturalNote` (8 on German, 1 on French, which the French flip lost
unnoticed). Nothing in either shell renders it, so no learner could have seen the loss — which is
exactly why it needed a test rather than an eye. The v2 lesson schema now carries it as an optional
field and `migratePackV1ToV2()` re-attaches it from the authored source, alongside `cefr`.

**The census, so the class cannot recur.** `tests/pack-migration-fields.test.ts` enumerates every
authored lesson field on each pack still at v1 and requires each one to either appear on the migrated
lesson or have a stated route (`explanation` → the information activity body, `examples` → the examples
stimulus, `exercises` → `legacyExercises`, `optionalExerciseIds` → `legacyCompletionExerciseIds`). A
new authored field with no route fails the test by name, and a non-vacuity case injects one to prove
the check can fail. The same file asserts the flipped German file still holds its 8 notes, and the CEFR
suite asserts its 8 tags, so a future re-migration that regressed either would be caught.

**The flip.** `npx tsx scripts/migrate-pack-v1-v2.ts courses/german/manifest.json`, then
`npm run content:build`. Measured before and after: 8 lessons, 4 units, 8 concepts, 34 vocabulary
entries, 1 media asset with an unchanged hash, 48 exercises retained under their own ids, 7 think-first
pauses mapped to `predict` steps, 56 reachable activities (48 practice + 8 notice), 39 review links,
7 of 8 lessons still carrying a prerequisite, and the 8 tags and 8 notes preserved. The stored file is
byte-identical to a fresh in-memory migration, so nothing in the script is unreproducible.

**What the retarget cost.** Six suites drove the legacy engine through German and now drive it through
Spanish: `CourseExercise.test.tsx`, `exercise-feedback.test.tsx`, `course-start.test.tsx`,
`course-environment.test.ts`, `course-storage.test.ts`, `course-pack.test.ts`. Two things were worth
more than a find-and-replace:

- `exercise-feedback.test.tsx` no longer writes a German sentence into a test that is about wording:
  it reads the authored answer for `es-cafe-requests-foundation-vary` ("Quisiera un té, por favor."),
  derives the missing-accent variant by stripping diacritics, and asserts the two differ before using
  them — so the diacritic case fails loudly instead of quietly testing nothing if that answer changes.
- `cross-language-variety.test.ts`, which pins that German/Spanish/Portuguese are not the same lesson
  three times, read raw v1 fields and compared an **empty list** for German after the flip: 32
  assertions would have passed vacuously. It now reads both shapes (`legacyExercises`, and the
  explanation from the `-intro` activity body) with a non-vacuity case that fails if either accessor
  stops finding text. `scripts/content/cross-language-similarity.py`, which the test mirrors, reads both
  shapes too — it would otherwise have printed every German pair as 0% similar.

**The evidence suites now describe reality.** `tests/french-pack-migration-parity.test.ts` →
`tests/migrated-pack-parity.test.ts` and `tests/french-migration-replay.test.tsx` →
`tests/migrated-pack-replay.test.tsx`. The parity suite keeps its v1 half for Portuguese and Spanish
and its "migrated pack" half is parameterised over French and German with per-pack counts (identities,
reachable activities, media hashes, prerequisite chains, retrieval links). The replay suite replays
both history shapes against both flipped packs and walks both course paths, proving a pre-migration
learner still sees their finished lesson and their unlocked next one. `tests/pack-flip-rehearsal.test.tsx`
rehearses the two packs still waiting and walks the two flipped packs as stored.

**Recorded, not hidden:** French and Italian were flipped before `cefr` and `culturalNote` had a home
in the v2 lesson, so they still report none of either (25 tags, 1 note). Re-running their migration
from the v1 source would restore them. That is a data change to authored content, so it is the user's
call, pinned in `tests/pack-migration-cefr.test.ts` and `tests/pack-migration-fields.test.ts` as the
expected zero rather than an accident.

### The v2 dialogue gap, closed (`adc939b`)

The loss the French flip opened, and the last piece of unreachable authored content in the tree.
`DialogueView` worked; the legacy shell rendered it under a Dialogues view; the v2 shell had no
dialogue surface at all. So the moment a course migrated, its scripted conversations stopped being
reachable through the UI — French two, Italian two, and after the French and German flips **nothing in
the product could reach any of them**. No test failed, because the component was still covered where it
was still rendered.

The v2 course shell now renders them under the course path: title, goal, the lesson to study first,
and the conversation with its recovery branches, reusing `DialogueView` unchanged and the same
tokens-only `study-grammar` styling the legacy shell gives it. The heading and lead paragraph are the
legacy shell's own words, so both shells describe the same feature the same way.

Three decisions worth stating:

- **The guard is content, not progress** (`pack.dialogues.length > 0`). Dialogue choices are explored
  freely and are not saved as mastery, in either shell, so gating them on lesson completion would
  invent a rule the content does not have. German, Portuguese and Spanish author none, so nothing
  renders for them — and that asymmetry is what makes the guard testable rather than hypothetical.
- **The prerequisite is named, not enforced.** "Study first: Names and introductions" tells the learner
  what the conversation assumes; it does not lock the branch, because a recovery branch exists
  precisely so getting it wrong is safe.
- **Nothing new to draw or author.** No new visual system, no new strings beyond the legacy shell's.

Evidence: `tests/DialoguesView.test.tsx` (4 tests) renders the authored dialogues with their
prerequisites, plays one to its terminal node and restarts it, asserts a course with no dialogues
renders no section at all, and checks that every authored prerequisite id resolves to a real lesson —
that last one because a broken link there would render the vague fallback and read as content rather
than as the defect it is. `tests/e2e/course-packs.spec.ts` walks the same path in a browser on
`/courses/french` and asserts `/courses/german` has no such section.

The shared shell is why this lands in every edition at once: `CourseWorkspace` renders
`RuntimeCourseWorkspace` for hosted, downloaded and portable alike, so the dialogues appear in
`public/study.js` too — one `content:build` regenerated it, and the reproducibility test required it
to be committed with the change.

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



### Graphics pass 2 — the banner on the course page, and legible on a phone (`de7d463`)

**The v2 shell had no banner.** `BANNER_BY_LANGUAGE` lived inside `CourseWorkspace.tsx` — the legacy
shell — and the v2 shell never rendered an image at all, so the three courses that had migrated lost
their artwork on their own page. Reproduced in a browser before the fix: at 320/390/430/1280 the only
`<img>` on `/courses/german` was the 32px header logo. The map now lives in
`src/features/course-pack/banners.ts`, both shells consume it, and the v2 shell renders the same
`img.course-banner`. `alt=""` on both: the page's own heading names the course, and the library is
where the picture carries authored alt text ("A half-timbered German street with a fountain"), which is
the right split — decoration beside a heading, culture in a gallery.

**On a phone the banner was ~85px tall.** The five banners are 2064×512 (4.03:1) and the drawing inside
each frame is narrower than the frame, so scaling the whole picture into the column left the artwork
illegible — worst on German, whose scene fills 56% of the width with empty ground either side.

Below 768px the banner now crops to a window **measured from the artwork** rather than chosen.
`scripts/brand/banner-crops.py` finds each banner's non-ground bounding box (the method
`frame-audit.py` already used) and writes `src/features/course-pack/banner-crops.json`:

| course | art fills | cropAspect | focusX | window |
| --- | --- | ---: | ---: | ---: |
| german | 56% × 94% | 2.39 | 50.4% | 1224px of 2064 |
| portuguese | 68% × 88% | 2.89 | 100% | 1479px |
| spanish | 76% × 93% | 3.24 | 100% | 1659px |
| french | 79% × 91% | 3.38 | 100% | 1729px |
| italian | 81% × 93% | 3.44 | 100% | 1764px |

The window is the art plus 6% breathing room, anchored on the art's own horizontal centre, expressed
as the two numbers CSS needs: `--banner-crop` (aspect ratio) and `--banner-focus` (`object-position`).
Four courses have their art against the right edge, so their focus is 100% — the crop keeps the ground
on the left and nothing else.

Measured at 320px (280px column), before → after: German 69px → 117px tall with the drawing 1.69×
larger; Portuguese 1.40×; Spanish 1.24×; French 1.19×; Italian 1.17×. Nothing is cut, and the desktop
frame is untouched — reapportioning a legible 4:1 hero would be an art-direction change nobody asked
for. The library gallery also keeps the full frame per card, deliberately: per-card crop heights would
make a column of cards ragged.

Guards, and how they were proved:

- `tests/banner-crops.test.ts` re-derives the visible window from the generated data using the
  browser's own `object-position` rule and fails if any artwork falls outside it; asserts the art fills
  90–97% of its window (breathing room, not a crop); asserts the phone render beats the uncropped frame
  everywhere and ≥1.6× for German; and proves non-vacuity by setting the window back to the full frame,
  where that assertion fails. It also re-runs the generator as a check when Python + Pillow are present.
- `tests/e2e/course-banner.spec.ts` drives a real browser — German, French and Spanish at 320/390/430
  (decodes, measured ratio, taller than the strip, no horizontal overflow), desktop at 4.03:1, and the
  library at the frame ratio for all five cards. **Non-vacuity proved by injection**: removing the crop
  from the stylesheet turns the three phone tests red on the ratio assertion while desktop and the
  library stay green.
- `tests/e2e/offline.spec.ts` asserts the downloaded Italian edition renders its banner from the
  service worker's precache with the network off; `tests/e2e/portable.spec.ts` asserts the single file
  renders it from an embedded blob with every http request aborted.

### Graphics pass 2 — the audit's named leftovers (`e1c229f`)

The brief ends with a technical pass, two of whose items were already fixed and two of which were
still real. Both are now done *and guarded*, which is the part that was missing.

- **Declared image dimensions.** `next/image` reserves layout space from the declared `width`/`height`,
  so a declaration whose shape differs from the file shifts the page when the picture lands. The brief
  listed `hero-banner.jpg` declared 1536×1024 for a 1584×672 file and `empty-journal.jpg` declared
  1024×683 for a 1024×1024 one; both were already corrected in the tree.
  `tests/image-dimensions.test.ts` now parses every `<Image>`/`<img>` element under `src/`, reads the
  file's own header, and fails when the declared ratio differs from the file's by more than 1%.
  `tests/helpers/image-size.ts` reads PNG (IHDR) and JPEG (SOF) in about thirty lines, so it runs in CI
  where Pillow is absent — the first pass compared pixels and flagged three false positives (a 1024px
  mark legitimately shown at 32px), which is why the assertion is on the ratio.
- **`public/brand` is the shipped brand system.** It held `voxlibre-app-icon-source.png` — 999,158
  bytes of icon source from a different project, added in `5d8ff79`, referenced by nothing but the
  brief. Removed (sha256 `e59b88313a3f5245f6ac446afc7eba4fed7481f4046e697663af392782567e9f`, recoverable
  with `git show 5d8ff79:public/brand/voxlibre-app-icon-source.png`), and the same test now asserts
  every file in `public/brand` is referenced by the app.
- **The brief no longer points at fixed work.** Its "wiring the German banner" instruction, its
  dimension table, its "32 vocabulary images" (the tree has 22 — referenced and present, no orphans,
  checked in both directions) and its housekeeping ask are all corrected in place, and it gained the
  section the crop work needs: what the window is, how to re-measure it, and what it asks of new art
  (keep the drawing inside the frame, nothing meaningful in the outer margins).

### Graphics pass 2 — lock-screen artwork for the listening lessons (`70a9482`)

The brief's "compact audio-state artwork for screen-off study". A long audio lesson is mostly listened
to with the screen off, so the lock screen and the notification shade are the surface a learner
actually looks at — and `navigator.mediaSession.metadata` was set with a title, an artist and an album
and **no artwork**. The catch block's own comment admitted it ("the player still works, just without
lock-screen art").

The metadata now carries the course banner at the file's real size (`sizes: "2064x512"`, taken from the
same measured data as the crop, because a platform picks artwork by declared size). It is the same file
the course page uses, it is already offline — the service worker precaches every banner and the
portable build embeds them — and in the single file the library resolves it through the audio resolver,
so the lock screen gets an embedded blob. `artwork` is omitted entirely when an edition has no cover: a
`src` that 404s reads as a load failure on some platforms instead of falling back to the text.

Guards: `tests/ListenCover.test.tsx` (5 tests) captures the `MediaMetadata` and asserts the
title/artist/album, the artwork path and type, a `sizes` equal to the real JPEG header (read the same
way the dimension guard reads it), the portable blob passed through untouched, no `artwork` field when
there is no cover, and that a browser without the Media Session API still renders the card.
`tests/e2e/listen.spec.ts` asserts the live metadata in Chromium for Spanish, Portuguese and German;
`tests/e2e/portable-listen.spec.ts` asserts the embedded blob in the single file.

### Graphics pass 2 — what was audited and deliberately left alone

Recorded because "we looked and it was fine" is information too, and because the next person should not
re-audit it:

- **No overflow anywhere.** At 320/390/430/1280 the course page, the library and the lesson shell keep
  `scrollWidth == innerWidth`; the banner never pushed a page sideways.
- **No missing or orphaned artwork.** Every catalogued course has a banner file; every vocab image the
  travel fixture references exists (22/22, no orphans) — the brief's "32 files" was wrong, not the tree.
- **Offline and portable inclusion is already complete.** The service worker precaches all five banners
  and the icon set; the portable collector embeds one banner per catalogued course. Both are pinned by
  tests that name the missing file rather than counting.
- **Alt text split.** Decorative on the course page (`alt=""`, beside the course heading) and
  descriptive in the library and landing showcase ("Pena Palace and Porto"), which is the meaningful
  surface for the artwork's content.
- **No new raster assets, and none were justified.** Every candidate in the brief's broader list that
  would need new art — lesson-scene illustrations, regenerated vocabulary illustrations, a course-map
  illustration — needs an image model and a human art-direction pass, neither of which exists in this
  run. Reusing the existing banners (with measured crops) and the existing vocabulary photographs is
  the honest alternative, and it is what shipped.
- **The Listen player's cover treatment stays as it is.** The card's two-letter language mark was the
  brief's "restrained cover treatment", and adding per-track art to a list of eight tracks would be the
  noise the brief warns against. The lock-screen artwork above is where a picture earns its place.


### Stage 2: the first-run block, rebalanced for a 320px phone (`5f52fa6`)

The complaint was that the blank learner's block opened with the wide raster logo lockup,
squeezed, and a journal illustration that read as an oversized card. Both were measured
before anything changed, in a real browser at 320×568 and 390×844:

| | before | after |
| --- | --- | --- |
| brand | `logo-lockup.jpg` (1792×592) rendered **197×65** at 320px — the name is *inside* the image, so it cannot scale | the app's own mark at **44×44**, `alt=""`, beside `VerbaLibera` in live text in the display face (`--font-display` → Fraunces) |
| journal | **172×172** at 320 (86% of the block's 246px width) | **103×103** (42%), capped by `min(150px, 42%)`, declared 1024×1024 so it reserves its space |
| copy | `0.98rem` = **15.68px** | `1rem` = **16px** |
| block height | 559px at 320 / 575px at 390 | **498px / 449px** |

The raster lockup is now referenced by no surface at all. Rather than delete the user's
approved artwork, it is **kept in the tree and no longer precached** — nothing renders it,
so 30KB in every install is not free — and a `RETAINED` map in
`tests/image-dimensions.test.ts` records it with that reason, so the brand guard still
fails by name for anything else that stops being shipped. Fixing that guard turned up a
gap of its own: its scan listed `*.ts, *.tsx, *.css, *.json` and therefore never read
`public/sw.js`, `public/offline.html` or any generated bundle. It reads `.js`, `.mjs` and
`.html` now.

**No bottom-tab overlap**, in the sense that matters and can be tested: the floating bar
does pass over content while the page scrolls — that is what a floating bar is — but the
one action can always be brought fully clear of it. The body reserves 84px for the ~66px
capsule, and the new e2e case scrolls the action to the bar's edge and asserts nothing
overlaps. Measured at both widths, and the assertion fails on both.

Coverage: `tests/FirstRunOnboarding.test.tsx` (6 cases — the name is text, no raster lockup
is drawn, the wordmark is in the display face, the journal's width cap and declared
dimensions, the 16px floor, one clear way in) and two e2e cases, one per width, measuring
the mark, the journal's share of the block, the copy size, the action's tap height, the
absence of horizontal overflow, and the tab-bar clearance. Proven non-vacuous by putting
the journal back to 260px: the 320px case failed at "expected < 110.7, received 191.875".

What the block still does not do, said plainly: the mark and the journal are both book
imagery, and the heading and the page's own "Start learning" button compete a little as
instructions. Both are judgement calls rather than defects, and neither was asked for.

### Stage 1: the seven supplied replacements, and the last three photographs (`b61ffa2`)

Seven of the ten CC0 photographs are now the project's own illustrations, supplied as
files and adopted against the exact mapping given: door, museum, street, map, card,
wallet and hotel. `station.jpg`, `phone.jpg` and `passport.jpg` stay as they are —
station and phone because the user approved them and said so, passport because it was
never in the list.

| file | source | shipped | ground |
| --- | --- | --- | --- |
| `door.jpg` | `1-Photo-1.jpg` | 800×449, 61,729 B | snapped (the plain wall, 6 → 1, 27% remapped) |
| `museum.jpg` | `3-Photo-3.jpg` | 800×449, 104,772 B | snapped (17 → 1, 28%) |
| `street.jpg` | `4-Photo-4.jpg` | 800×449, 115,426 B | snapped (20 → 1, 25%) |
| `map.jpg` | `5-Photo-5.jpg` | 800×449, 153,327 B | **left alone** — its most common colour is the drawn wooden tabletop (`#d9bb87`, 95 off) |
| `card.jpg` | `8-Photo-8.jpg` | 800×449, 110,021 B | snapped (24 → 1, 39%) |
| `wallet.jpg` | `9-Photo-9.jpg` | 800×449, 99,301 B | snapped (27 → 1, 34%) |
| `hotel.jpg` | `10-Photo-10.jpg` | 800×449, 73,776 B | snapped (11 → 1, 41%) |

Six of the seven are snapped even where the background was 17–27 units off the canvas,
because in those files the most common colour is the picture's **background field** (the
wall, the cream margin, the cream table surround) rather than a drawn object — which is
the distinction the script is for. `map.jpg` is the fifth file where it is the other way
round, after `key.jpg`'s door, `bill.jpg`'s leather folder, `hospital.jpg`'s tan facade
and the player card's wooden table. Every source was checked at full size for baked
lettering and **all seven are clean**: blank screens, blank keypads, a blank hanging
sign, blank sign bands, an unlabelled map, blank cards and blank coins. Nothing had to be
guarded this time, unlike the hotel scene's reception sign.

Two alt texts were wrong rather than stale, and both are the same class of error as the
shopkeeper's last block:

- `card.jpg` claimed "A bank card in a payment terminal". The drawing is a terminal with a
  **blank screen and no card inserted**, so the picture never supported the words. It now
  reads "A card payment terminal on a table".
- `wallet.jpg` claimed "A quilted purse" — the photograph's subject, not the drawing's. It
  now reads "A wallet with cards and coins".

The rest were reworded to describe what is actually there: a shop door under an awning, a
museum with columns and steps, a city street of shopfronts, a city map spread out with a
compass, a hotel entrance with a luggage cart. The second `door.jpg` occurrence sits in
the "entrance" drill, where the alt is now "A doorway with a step up to it" — the same
drawing, described so the two drills stay distinguishable.

`docs/image-provenance.md` moves from ten CC0 photographs and twelve illustrations to
**three and nineteen**, names each replaced source file, and records the three that
remain. A new guard, `tests/vocab-ground.test.ts`, runs `scripts/brand/snap-ground.py
--check` over all 28 pictures the app draws and asserts *both* halves: the nineteen that
sit on the canvas pass, and the nine that do not are exactly the recorded exceptions, each
with its reason written down. Proven non-vacuous by snapping `map.jpg` and watching it
fail.

The old non-vacuity case in `tests/image-dimensions.test.ts` reported its own
obsolescence: it asserted the folder held more than three distinct sizes, and with
nineteen files at the contract size only three remain. It now pins what still matters —
that the three pictures outside the 16:9 list are exactly the three kept photographs.

### The player's own artwork: a cover on the card, a square on the lock screen (`da2b3dc`)

The Listen player had one mark and no picture, deliberately: the stylesheet said an image
"per track would be bytes the offline bundle carries and a licence nobody has checked".
That reasoning does not cover what arrived — **two files for the whole feature**, the
project's own artwork — so the card gets a cover treatment and the lock screen gets a mark
drawn for the slot. The comment is corrected rather than left contradicting the code.

| | source | shipped | ground | where |
| --- | --- | --- | --- | --- |
| `player-card.jpg` | 1280×714 | 800×449, 117,009 B | **not snapped** (the drawn wooden table, `#cfb286`, 96 off — the fifth file the snapping premise does not fit) | the card's cover, and only that |
| `player-lock.jpg` | 1024×1024 | 1024×1024, 142,010 B | snapped (cream field, 9 → 1, 65% remapped) | `navigator.mediaSession` artwork, ahead of the course banner |

**A test forced the layout, and it was right.** The first attempt put the wide cover across
the card at every width. On a 390×844 phone that made the card 774px tall — 92% of the
screen — and `the player card is usable on a phone and from the keyboard`, which asserts the
card stays under three quarters of the viewport, failed at 774 against a 633 limit. The
brief's "without making the player full-screen" was already encoded in that assertion. So
the phone now gets the cover at **album-thumbnail size inside the header row it already
had** (76×43, costing the card no height at all, card back to 612px), and above 480px the
full 16:9 frame opens up across the card, capped at 420px (237px tall). Measured, not
assumed: card 612 vs a 633 limit, cover clear of every transport control, nothing spilling
sideways at 390, and the 76px thumbnail still reads as a small album cover — checked by
rendering it at 5× and looking at it, because "unreadable blur" was the thing to rule out.

Both files are **decorative** (`alt=""`): the heading beside the cover names the lesson and
the transport names the state, so nothing informative lives in either picture. The cover's
URL goes through the edition's media resolver (`resolveMedia`, the same one the audio and
the banner use), because the portable single file cannot fetch a shipped path — the failure
`tests/ListenCover.test.tsx` exists to catch, and it now covers this path too.

Surfaces: both files are **precached** (the service worker moves to `verbalibera-static-v10`
so existing installs refetch) and both are **embedded in the portable file**, derived from
`PLAYER_ART_URLS` rather than hand-listed. The portable artifact was opened and both entries
are really in it. There is **no in-app compact player** — the Listen tab renders the library
and then this one card — so the square is used for the lock screen and nowhere else; that is
recorded rather than papered over with an invented surface.

One more thing worth knowing before touching this again: an e2e spec **cannot import
`player-art.ts`**. That module reaches `banners.ts`, which imports `banner-crops.json`, and
Playwright's transform refuses a JSON import without an import attribute ("needs an import
attribute of type: json"). Two e2e files died on it with a one-line TypeError and no test
reported. So the artifact check in `portable.spec.ts` reads the **folder**
(`public/brand/player-*.jpg`), the way the scenes check reads `public/images/scenes`, and the
behavioural check — the cover rendering as a resolved blob and decoding inside the single
file — lives in `portable-listen.spec.ts`, where a real card is on screen.

Two real defects turned up while wiring this:

- `scripts/brand/asset-table.py` named `public/favicon.ico`, which does not exist — the file
  is `src/app/favicon.ico`. The generated table had never been regenerated verbatim, so the
  wrong path sat in the generator unnoticed. Fixed, and the table is now generated rather
  than hand-kept.
- The service-worker guard asserted `not.toMatch(/verbalibera-static-v1/)`, and **`v10` and
  `v11` both match `v1`**. A worker that never left v1 would have passed that check. The
  pattern is now anchored on the closing quote.

And one slip worth writing down: the two hashes in `docs/image-provenance.md` were first
written **by hand** from a `cut -c1-40` reading, with the tail invented. It was caught before
the commit and corrected against `shasum`, and `tests/asset-provenance.test.ts` now checks
the recorded hashes against the files on disk, so the next one cannot be typed from memory.

### The last two pictures: bill and shopkeeper (`2632799`)

The two drill pictures that were still photographs are now illustrations, because the user
supplied them as standalone files. That is the whole fix, and the block's job was to land
them and to keep the *reason* the approved six-panel sheet was never the source, since
that reasoning is the answer to "why not just crop the sheet".

| | source | shipped | ground | alt text |
| --- | --- | --- | --- | --- |
| `bill.jpg` | 1280×714 | 800×449, 103,418 B | **not snapped** (dark leather `#41392c`, 187 off — the largest miss in the set) | "A restaurant bill" → "A restaurant bill in a folder on a table" |
| `shopkeeper.jpg` | 1280×714 | 800×449, 124,093 B | snapped, 10 → 1, 35% remapped | "A market vendor at his stall" → "A market stall with baskets of fruit and vegetables" |

The shopkeeper alt is the block's one correctness fix rather than a wording preference:
**the approved drawing has no vendor in it at all** — it is the stall, with a striped
awning, baskets of potatoes, green apples, onions and red apples, burlap sacks, a brass
balance scale and a blank hanging sign. The old wording announced a person who is not in
the picture. The pairing with "un commerçant" is unchanged and still approved; it is the
picture's subject that moved from the seller to the stall.

The bill drawing is a leather folder with a **blank** sheet, a pencil, coins and the base
of a metal cup on a wooden table, and that blankness is the point: the photograph it
replaces was a receipt full of legible text, and a bill with readable figures would be
copy living inside an image — the same rule that keeps the hotel scene's reception sign
and the sheet's "BILL" out of the UI. Nothing anywhere in either new file is written on;
the shopkeeper's tags, labels, crate markings and papers were checked panel by panel.

`docs/image-provenance.md` moves from ten CC0 photographs and twelve illustrations, names
the two Wikimedia/Unsplash photographs these replace in the history paragraph, and turns
the waiting note into "The last two pictures, and why the six-panel sheet was never the
source". `tests/asset-provenance.test.ts` checks 10/12/6/1, both new hashes, both new alt
texts, and pins the sheet's reasoning so a later reader cannot delete the only explanation
of why the collage was not cut up. `tests/image-dimensions.test.ts` pins both at 800×449.

Nothing generated moved: `content:build` leaves `study.css` and `study.js` byte-identical.

**Still open from the earlier inventory:** six supplied illustrations have never been
assigned (see Next tasks), which is now the only remaining artwork the app has files for
and no home.

### The hospital picture, and the two pictures that still need artwork (`b8ca6c3`)

The last of the three assets this pass asked for landed; the other two do not exist,
and the block's job was to establish that rather than fill the gap with something.

**The hospital illustration** takes the drill's 16:9 contract (1280×714 → **800×449**,
83,360 B) and is **not** ground-snapped: its most common colour is the drawn tan facade
(`#e1caa0`, 70 units from the canvas, 5.7% of the frame), which makes it the third file
where the snapping script's premise fails — after `key.jpg` and two of the scenes. Its
alt text is **unchanged**, and that is the deliberate part: the new drawing is still a
hospital entrance (steps, green glass doors, potted plants, a serpent-and-staff sign
above), so "A hospital entrance" remains accurate and remains distinct from the other
three options in that drill — an ambulance, a police car and a mobile phone. Previous
replacements rewrote alts because the picture *contradicted* the old words ("A pink
piggy bank" for a white one); this one did not, and inventing a change would have been
churn.

`hospital.jpg` also leaves the public-domain table, because it is no longer a photograph
of the Hakodate Red Cross Hospital: the record's counts are now **12 CC0 photographs, 10
project illustrations, 6 lesson scenes and 1 course map**, and the test checks all 28
recorded hashes against the bytes on disk.

**`bill.jpg` and `shopkeeper.jpg` stay exactly as they were, as photographs.** The
instruction was conditional — complete them from the approved six-panel reference "if
possible", and otherwise keep the photographs and document the gap — so this block
answered the condition, and the answer is no:

- **The sheet cannot be the source.** It is a collage, and its receipt panel has the word
  "BILL" drawn into the artwork. That rules it out twice over: it cannot ship as an
  asset, and it cannot be cut up into one, because instructional copy must not live inside
  an image and this repo's rule is that artwork lettering never becomes UI (the same rule
  that keeps the hotel scene's reception sign out of `src/`). Cropping was excluded on
  those grounds before the instruction repeated it.
- **No standalone file exists here.** Every attachment folder delivered to this project
  has now been accounted for, including the ten-file batch that arrived with the hospital
  picture and had not been opened before. Those ten are: a shop door, two building
  entrances, a street of facades, a map spread out with a compass, a desk with a phone and
  a coiled cable, a desk with a clipboard and a blank badge, a card payment terminal with
  blank receipt paper, a wallet with cards and coins, and a hotel entrance with a luggage
  cart. None is a receipt or a market stall. `~/Downloads` holds only the brand
  references, and the repo carries no source art.

What that costs and what it needs are written into `docs/image-provenance.md` as "The two
pictures still waiting for standalone artwork": two standalone files, supplied at any
size like the rest of the set, after which they take the same four steps as every other
replacement. The note is **pinned by a test** — it has to mention the collage and the
baked-in word — so the next person to find a receipt on that sheet reads why it is not
the answer instead of cutting it up.

**One thing the scan turned up, deliberately not acted on.** Six of those ten files look
like standalone art for options the drills still show as photographs: the shop door
(`door.jpg`), the card payment terminal (`card.jpg`), the map with a compass (`map.jpg`),
the wallet with cards and coins (`wallet.jpg`), the hotel entrance with a luggage cart
(`hotel.jpg`, and it is unmistakably a hotel) and the street of facades (`street.jpg`,
probably — it is a street, but the drill's option is one specific photograph today). None
was requested in this pass, so they are recorded as candidates in Next tasks rather than
wired now. Two of the remaining four describe a desk rather than a word the drills teach,
and the last two are entrances — one with a clock over the door, one with columns — that
are ambiguous between museum, station and shop without the drill's own label. Assigning a
doorway by its shape is the kind of guess that should come from the person who approved
the art.

### The minor-emergency scene and the course map (`b255217`)

Two more approved illustrations, and both went somewhere the app already had a place
for — one into the situation model, one onto the progress surface that describes a
route.

**The emergency scene** takes the lesson-scene contract (1200×896 → **800×600**, the
frame the other six are drawn in) and is **not** ground-snapped: its most common
colour is the drawn flagstone paving (`#dcc99f`, 71 units from the canvas), so the
script's premise ("the most common colour is the flat ground") fails here, exactly as
it did for `key.jpg` and the bill scene. It joins `scenes.ts` as the sixth situation,
`minor-emergency`, reached both ways the module already supports:

- the authored scenario **"Getting help in an emergency"** — a travel pattern in all
  four languages, so all four get the picture;
- the lesson-id segment **`emergency`** — `fr-emergency-foundation` and
  `it-emergency-foundation` exist; German, Spanish and Portuguese ship no emergency
  lesson, and the lookup simply renders nothing there rather than reaching for a
  near-miss.

The two lookups being updated together is the point: adding a picture to one and not
the other is how a scene ends up reachable in a session but not in a course.

**The course map** is 1264×848 (1.49:1) and was resized on width alone to **800×537**,
matching the set's 800px width without cropping the route: its six stations run to the
frame's edges, so forcing it into the scenes' 4:3 would cut the flashcards and the
notebook off the ends of the path. Its ground was snapped (the parchment field,
`#f9f1dc`, 10 units off, remapped on 58% of the frame).

It went to `/learn/<course>/plan`, and the reason is that this is the app's **one
progress surface that describes a route**: the daily path and the course path are
lists of what is unlocked, with up-next, complete and locked rows marked in words and
tokens, while the plan page lays the course out week by week and is titled "Your …
study plan". It renders under the heading, in the same 34rem column as the lesson
scenes and with the same 12px radius, declared at its own 800×537 so the checklist
below it does not move when the picture arrives. Measured in a browser at 390px:
358×240, ratio **1.49 against the file's own 1.49**, `alt=""`, no horizontal overflow.
The e2e walks it as a guest, because the page renders the map before anyone signs in.

**What was deferred, and said so rather than invented.** Three things:

1. The map is deliberately **absent from the portable and downloaded editions**. The
   plan page is a hosted account surface (`src/app/learn/[courseSlug]/plan/page.tsx`
   reads a session cookie), so there is nothing to embed; those editions carry the
   course path and the audio lessons. `course-map.ts` records that in the module
   rather than leaving it to be discovered by someone porting the page.
2. The map is **not a situation scene**, so it did not go into `scenes.ts`: it lives in
   `src/features/course-pack/course-map.ts` with a comment explaining why the two
   shapes differ.
3. The **emergency situation is wired only where the content exists**. The scene
   mapping covers the four travel patterns and the two foundation lessons the packs
   ship; adding it to the German, Spanish or Portuguese courses would need authored
   lessons there, not a code change.

**Artwork text: both files measured clean.** The emergency scene's wall plaque is
blank, the clock has tick marks and no numerals, and the map's books, cards and
notebook are all blank. The one piece of lettering in the whole approved set is still
the hotel scene's reception sign, and it is still absent from `src/`.

**Tests.** `tests/scenes.test.ts` moved from five situations to six, with the
emergency in *both* lookups and a near-miss pinned as unmapped
(`"Finding a place quickly"` must not resolve); `tests/image-dimensions.test.ts` pins
six scenes at 800×600 plus the map at 800×537; `tests/course-map.test.ts` (new) pins
the file against the constant and — the half that drifts — that the plan page imports,
declares and renders it decoratively; `tests/asset-provenance.test.ts` now counts
13 CC0, 9 project illustrations, 6 scenes and 1 map, and checks **all 28 recorded
hashes** against disk. The e2e gained two course-map tests (its own size on a phone,
and that it does not widen the column) and one emergency-scene walk.

### Ten more approved assets, and the first lesson scenes in the app (`f0513bc`)

Five vocabulary pictures and five lesson scenes, all supplied as files, normalised
here through the existing brand scripts, and wired where the app can show them.
The interesting half is the second group: the app had no scene art anywhere, and the
question of *where* a picture belongs turned out to have an answer in the data.

**Five vocabulary pictures** (1280×714 → the 16:9 contract at **800×449**):

| file | bytes | ground | alt text |
| --- | ---: | --- | --- |
| `key.jpg` | 85,847 B | **not snapped** | An old-fashioned room key with a blank tag |
| `bed.jpg` | 62,458 B | 10 → 1 | A made hotel bed with a folded towel |
| `suitcase.jpg` | 82,462 B | 12 → 1 | A green suitcase beside a folded map |
| `ambulance.jpg` | 95,653 B | 12 → 1 | An ambulance parked outside a building |
| `police.jpg` | 107,407 B | 14 → 1 | A police car with its roof lights on |

The alts matter more than they look: the drill's **accessible name is the alt**, so
"An ambulance" for a picture with a roof light bar and no red cross, or "A hotel
bed" for one carrying a folded towel, is a correctness problem rather than a wording
one. All five were rewritten against what the files actually draw, and
`tests/asset-provenance.test.ts` now checks the record's quoted alt against the
fixture.

**`key.jpg` is deliberately not ground-snapped**, and this is the first asset where
the script's premise fails: it assumes a file's most common colour *is* its flat
ground, and in this file that colour is the drawn door (`#7a8e6b`, 129 units from
the canvas cream) because the door fills more of the frame than the table does.
Snapping would have repainted the door cream. Measured, decided, recorded in
`docs/image-provenance.md`, and left visible to `snap-ground.py --check` — which
reports it "off" and is right to.

**Five lesson scenes** (1200×896 → **800×600**, the 4:3 frame they are drawn in, so
the shells render them with `height: auto` and never crop or stretch). Four were
snapped; `asking-for-the-bill.jpg` was not, for the same door-vs-ground reason (its
most common colour is the restaurant's tan wall).

**Where a scene belongs is a data question, and the app already had the answer.**
`src/features/course-pack/scenes.ts` keys the five pictures by *situation*, looked up
two ways because two surfaces name situations differently:

- the **authored pattern scenario** — `fixture.ts` gives every travel pattern a
  `scenario`, and the wording is identical across French, Italian, Spanish and
  Portuguese, so one table serves all four (`"Ordering coffee or food"`, `"Paying"`,
  `"Checking in at a hotel"`, `"Asking for directions"`, `"Finding a place"`);
- the **lesson id segment** — `de-cafe-requests-foundation`, `de-directions-foundation`,
  `fr-transport-foundation`. Only exact semantic matches are listed: `food-foundation`
  is not a café counter and gets nothing.

The alternative was the pack model's own `{ kind: "scene", mediaId, regions }` with a
`scene-selection` activity, and it was rejected on evidence rather than taste: no
pack authors one, and doing so means writing region labels and a quiz per lesson,
which is content work rather than wiring. The module says so where the next person
will read it.

Surfaces, both measured in a browser at the two widths that matter:

| surface | where it renders | 390px | 1280px |
| --- | --- | ---: | ---: |
| travel session (`GuidedSession`) | under the session heading, from the pattern's scenario | 358×269 | 544×408 |
| v2 lesson intro (`RuntimeCourseWorkspace`) | under the objective, from the lesson id | — | — |
| legacy lesson intro (`CourseWorkspace`) | above the aim line, from the lesson id | — | — |

Every one renders `alt=""` — the heading, the objective and the session's `Scenario`
line already say what the picture shows in words — at the file's own ratio (1.333
measured against 1.333 natural, so nothing is squashed), with a 12px radius and no
horizontal overflow on any of them. A pattern with no situation renders no picture:
`fr-greet-politely` was checked for exactly that.

**The portable and offline editions.** `RuntimeCourseWorkspace` resolves media
through `environment.resolveMedia`, which **throws** on an asset the file does not
carry — so a scene the app can render has to travel inside the portable artifact.
The collector now embeds them, derived from `SCENE_URLS` rather than hand-listed
(the hand-list is how German's banner went missing from that edition before), and
its URL allow-list was widened from `/audio|brand` to `/audio|brand|images`. The
artifact grew 17.3 MB → 18.2 MB. Offline is honest about a different trade: scenes
are cached on view by the service worker's `/images/**` rule rather than installed
with every visit, so the guarantee is "the picture you have seen is on the device",
which is what `tests/e2e/offline.spec.ts` now asserts (in the cache, and still there
with the network emulated off).

**The one piece of lettering in the artwork.** Checked file by file: the hotel scene
carries a wall sign reading `RECEPCIÓN`, in Spanish. It is recorded in
`docs/image-provenance.md` — the only place it appears — and `tests/scenes.test.ts`
greps `src/` for it, so it can never become a label, an aria name or a caption. That
test failed first time on this very module, whose comment had quoted the word, which
is the guard doing its job on its author. The same table records that
`station-counter.jpg` — the file the request warned might carry signage — measured
clean: the clock has tick marks and no numerals, the counter sign is blank. And the
note for whoever reviews the art: that Spanish reception sign will sit inside French,
Italian and German lessons too.

**Tests, and the two that needed the data rather than the code.**
`tests/scenes.test.ts` (6) pins the files, both lookups, the coverage in both
directions, the portable embedding and the lettering rule; it also fails if a
scenario string is reworded in `fixture.ts`, **proved non-vacuous by renaming one**
("the fixture no longer has the scenario …") and by removing the portable embed loop
("the portable edition does not embed /images/scenes/ordering-coffee.jpg").
`tests/LessonScenes.test.tsx` (3) renders both shells; building it turned up a real
trap — `CourseWorkspace` hands off to the v2 shell when the environment offers a v2
course loader, so an environment carrying both made the "legacy" case silently render
the German v2 intro. The lesson title exists in both languages, so the click worked
and only the intro's own wording gave it away; the case now asserts the legacy
shell's "Your aim:" line, which is what caught it.

### The approved vocabulary pictures and the German banner (`99970d6`)

Two approved assets landed in the app, both normalised through the existing brand
scripts rather than redrawn, and the German banner decision from the last block is
now taken: it **is** the approved reference.

**Four vocabulary pictures.** The supplied 1280×714 sources became the app's 16:9
contract at **800×449** (`sips --resampleHeightWidth 449 800`) and then had their
flat ground snapped to the canvas cream (`scripts/brand/snap-ground.py`), which
measured 7, 10, 10 and 16 units off before and reads back exact after, remapping
59–71% of each frame:

| file | bytes | ground before → after |
| --- | ---: | --- |
| `piggybank.jpg` | 87,393 B | 7 → 1 |
| `tea.jpg` | 70,608 B | 10 → 1 |
| `coffee.jpg` | 69,716 B | 16 → 1 |
| `table.jpg` | 75,844 B | 10 → 1 |

The **alt text had to change with them**, and not as polish: the drill's accessible
name *is* the alt (`PictureChoice` puts it on the radio), so "A pink piggy bank"
would have announced the wrong colour for a white pig on a table with coins. All
six occurrences in the fixture were corrected — piggy bank, teapot, saucer, two
chairs — and `tests/asset-provenance.test.ts` now checks the record's quoted alt
text against the fixture so the two cannot drift.

**The drill's 4:3 box was measured, not assumed.** `PictureChoice` renders these in
a 4:3 box with `object-fit: cover`, so a 16:9 file is cropped to its middle 75% of
width. In the browser at 390px the four choices render 285×214 each and the
approved compositions survive whole — the piggy bank, coins, table and plant are
all inside, and only the background cloth behind the piggy bank is clipped. No
layout change was needed, which is the useful half of that finding. A supplied
six-panel contact sheet in the same delivery was **not** used: one of its panels has
the word "BILL" drawn into the artwork, and a supplied picture is not worth baked-in
text.

**The German banner is now the approved framing.** The reference was snapped
(ground 7 → 1, 53.2% of pixels remapped) straight into `public/brand/courses/german.jpg`
at the same 2064×512 contract, and the two measurements that matter moved with it:

| | re-framed file (before) | approved framing (now) |
| --- | ---: | ---: |
| `compare-reference.py` difference at rest | 71.10 | **1.54** |
| best horizontal shift | +278 px | **0 px** |
| narrow-viewport window | 2.391 @ 50.42% | **2.749 @ 100%** |
| rendered on a 390px course page | 350×146 | 350×127 |
| rendered on a 1280px course page | 872×216 | 872×216 |

The history stays in `docs/asset-provenance.md` rather than being deleted: the
re-frame existed because the approved scene runs off the right edge through a
distinct building (the brief's column analysis, complete scene to x≈1890), and a
future maintainer comparing app against artwork needs to know both that they now
match and why they once did not.

**The phone crop was checked for clipping by measuring the render**, because the
band got shorter (146 → 127px) and the window wider: the first non-ground column in
the screenshotted band sits at **19px of 350 (5.4%)**, against the 5.6% the crop data
predicts — so the whole drawing is inside the window with a breathing margin, not
clipped at the edge. The library card (281×70, full frame, descriptive alt) and the
lesson shell (no banner while practising, by design) are unchanged, and there is no
horizontal overflow on any surface.

**The generated bundle moved, and by exactly two numbers.** `banner-crops.json`
feeds `banners.ts`, which is bundled into `public/study.js`, so the committed
artifact had to be regenerated. Extracting the crop block from `HEAD`'s bundle and
the new one shows German `2.391@50.42` → `2.749@100` as the whole of the data
change (831,028 → 831,026 bytes), which is what `content:build` was re-run to
produce. The full suite's generated-artifact guard caught this before the commit —
its message is the instruction, and it was followed rather than suppressed.

**Guards, and the one that needed proving.** `tests/banner-crops.test.ts` now
asserts German grows more than every other course and that its 320px band stays over
100px, instead of the fixed ×1.6 multiplier that only the re-framed file produced —
the approved framing measures ×1.47, and an assertion tied to the old artwork would
have been a lie the tests told. `tests/image-dimensions.test.ts` gained three cases:
the 800px ceiling for all 22 files, exactly 800×449 for the four approved ones, and
a check that the folder holds more than three distinct sizes so the 16:9 assertion
is discriminating rather than a rule the whole folder already follows.
`tests/asset-provenance.test.ts` pins the four sha256 values against the bytes on
disk — **proved non-vacuous**: corrupting one recorded hash fails with "tea.jpg no
longer matches its recorded hash", and restoring it passes.

### Graphics pass 3 — the German banner verified against its approved reference (`d73c34f`)

The correction this block started from: the German banner exists and is approved,
its reference is `~/Downloads/Course Banner German.jpeg`, and nothing about the
illustration was to be generated, replaced or redesigned. So this is verification,
and the answer is not the one the brief implies.

**The shipped file is not the approved framing.** All ten brand assets were
compared against their references by searching for the horizontal shift that
minimises the grey difference (`scripts/brand/compare-reference.py`, which
separates "re-encoded" from "moved inside the frame" from "different picture"):

| Shipped | Difference at rest | Best shift | Verdict |
| --- | ---: | ---: | --- |
| `courses/french.jpg` | 1.09 | 0 px | the reference, re-encoded |
| `courses/italian.jpg` | 1.68 | 0 px | the reference, re-encoded |
| `courses/spanish.jpg` | 1.42 | 0 px | the reference, re-encoded |
| `courses/portuguese.jpg` | 1.36 | 0 px | the reference, re-encoded |
| **`courses/german.jpg`** | **71.10** | **+278 px** | **re-framed** |
| `hero-banner.jpg` | 25.77 | −31 px | re-framed (`tighten-frame.py`) |
| `empty-journal.jpg` | 25.51 | −14 px | re-framed (`tighten-frame.py`) |
| `logo-mark.jpg` | 31.04 | 0 px | re-framed and rescaled |
| `logo-lockup.jpg` | 4.71 | 0 px | the reference, re-encoded |
| `og-card.jpg` | 28.32 | 0 px | cropped to the specified 1200×630 |

The four other banners and the lockup are byte-faithful re-encodes. German is the
outlier: it is the approved art translated 278 px inside the same 2064×512 frame
and re-snapped. That is the re-frame `docs/design/graphics-brief.md` documents —
the original scene ran off the right edge through a distinct building (the brief's
column analysis puts the complete scene's end at x≈1890 and a different building
from x≈1899), so the scene was centred instead. The design brief called it a
trade-off at the time; what nobody had measured is that it is *not* the approved
file, which is worth knowing before anyone compares the app to the reference
artwork side by side.

**Its measured consequence** (`--crops`): the shipped file needs a phone window of
aspect 2.39 anchored at 50.4%, the untouched reference would need 2.75 at 100%.
Both windows hold the whole drawing, so nothing is cut either way — the re-frame
made the composition narrower and centred, so the crop has further to travel. The
other four need the same window whichever file is in place. Restoring the approved
framing means copying the reference over the file and re-running
`python3 scripts/brand/banner-crops.py`; that is an art decision, so it is recorded
and left.

**The rest of German's integration is correct, re-verified in a browser this
block** at 390 px and 1280 px:

| Surface | 390 px | Desktop | Alt | Crop |
| --- | --- | --- | --- | --- |
| Landing card | 344×85 | 544×135 | "A half-timbered German street with a fountain" | full frame |
| Course library card | (lazy) | 281×70 | same | full frame |
| **Course page** | **350×146**, ratio 2.39 | 872×216, ratio 4.03 | `""` (decorative) | applied below 768px only |
| Lesson shell (`?start=1`) | none | none | — | — |

No horizontal overflow on any of them. The lesson shell showing no banner while
practising is deliberate in both shells.

**Icons are clean** (`scripts/brand/icon-audit.py`): the maskable icon's artwork
sits at x 26–74%, y 32–68% — inside the central 80% safe circle — while the
non-maskable icons reach past it, which is correct because only a maskable icon is
cropped to a launcher shape. Every icon is within 6–8 mean grey of the approved
square; the maskable one differs most because that difference *is* the safe zone.

The document that should have answered this in the first place,
`docs/asset-provenance.md`, described two files that no longer exist and named
none of the Warm Studio set. It is rewritten around the measurements above, with a
"removed files" section that keeps the retired Signal Pop prompts so the history is
not a mystery.

### Graphics pass 3 — the offline page's state mark (`d4566a7`)

The brief's "empty, loading, offline, and microphone-denied illustrations that
explain the state without adding clutter": the offline reconnect page — the screen
a learner lands on when nothing else can load — was a bare card with no image in
it. It now carries the journal the rest of the app uses for "nothing here yet",
at the dashboard's own treatment (rounded, width-capped, `alt=""`, declared
1024×1024), `min(150px, 40%)` so a 320px phone gets the card first and the picture
second: measured at 82/110/150 px at 320/390/1280 with no overflow.

No new bytes: `empty-journal.jpg` is already in the service worker's precache,
which is what makes it available on the one page where the network is gone by
definition. That coupling is the fragile part and is now pinned —
`tests/service-worker.test.ts` requires every `<img src>` in `public/offline.html`
to be in `STATIC_ASSETS`, **proved non-vacuous by injection**: dropping
`/brand/empty-journal.jpg` from the list fails with "/brand/empty-journal.jpg is
not precached, so it cannot load offline". `tests/image-dimensions.test.ts` now
scans `public/*.html` too, so the page's declared dimensions are checked by the
same rule as a JSX element's, and it asserts that half of the scan really found
the mark. `tests/e2e/offline.spec.ts` asserts the mark decodes with the network
emulated off **and** that `caches.match` served it.

One fix the change forced: the eyebrow's styling was `main > p:first-child`, which
the new image broke by taking the first-child slot. It is a `.eyebrow` class now —
styling should not depend on the order of a card's children — verified in a
browser (uppercase, 1.75px tracking, `#a8511f`, 12.48px).

### Graphics pass 3 — what was audited and deliberately left alone

- **The library and landing cards.** They still show the full 4:1 frame on a phone
  (German's card is 344×85 at 390px), which is the strip the course page no longer
  has. A *uniform* crop would fit: every banner's artwork fits a window of 3.34 or
  wider, which would make the cards ~21% taller and keep them all the same height
  (per-card crops would leave a column of ragged cards). It is not done here
  because the margin for Italian — whose artwork fills 81% of the frame — would be
  about 3.6%, so a measurement wobble clips real art on a surface where the picture
  is the point. Recorded as an art-direction option with its numbers rather than
  taken.
- **The course path's "next step"** already carries a token-only marker that the
  brief asks for: the up-next row gets a terracotta left rule and stock background,
  a completed row an accent number chip, a locked row a muted rule plus a pill with
  the prerequisite sentence. Nothing to add.
- **Microphone-denied and loading.** Both explain themselves in words — the
  speaking step keeps its self-assessment when recording is refused
  (`SelfCompareActivity`), and Listen says "Opening the course…" while it reads.
  An image on either would be the clutter the brief warns against.
- **The Listen cover treatment.** The card's two-letter language mark is the
  brief's "restrained cover treatment", and the picture that earns its place is the
  lock-screen artwork shipped in the previous block (the course banner at
  2064×512). Per-track art in a list of eight tracks of the same course would be
  wallpaper.
- **Vocabulary context visuals.** The 22 CC0 photographs already carry the picture
  drills in the travel fixture with authored alt text. Mapping course vocabulary to
  them would be new authoring, and the design brief's own §7 is explicit that
  regenerating them on-palette is a generation job: not invented here.


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
| `npx vitest run` (after the player card and the offline matrix, `bfc61d5`) | **144 files passed, 1 skipped; 1120 passed, 6 skipped, 0 failed** |
| `npx vitest run tests/pack-flip-rehearsal.test.tsx` (alone) | **6 passed** — three remaining v1 packs, each driven through the v2 shell after an in-memory migration, and through the legacy shell unflipped |
| `E2E_BASE_URL=http://localhost:3101 npx playwright test --project=chromium --workers=1 tests/e2e/listen.spec.ts` | **6 passed** — including the new phone/keyboard case that measures every transport target at 390px (the card is 571px tall there; it was 756px before the flex-basis fix) |
| `E2E_BASE_URL=http://localhost:3101 npx playwright test --config playwright.offline.config.ts` | **10 passed, 3 skipped** — Chromium: the failure matrix, the cold offline start and the three existing offline cases; WebKit: the failed download and the install-and-Cache-Storage case, with the three it cannot express skipped and the reason in each test |
| `npx playwright test --config playwright.portable.config.ts` | **8 passed** (Chromium and WebKit) — the player card in the single-file edition, both artifacts |
| `npx vitest run tests/service-worker.test.ts` (alone) | **12 passed** — the 206 guard plus the four offline-matrix cases |
| `npx vitest run tests/pack-migration-cefr.test.ts` (alone) | **9 passed** — three v1 packs' tags carried, the untagged v2 case quiet, `B2` refused, and a non-vacuity case |
| `npx vitest run` (after the German flip, `4e636eb`) | **145 files passed, 1 skipped; 1132 passed, 6 skipped, 0 failed**. Two files were red before the commit and green after it: `content-build-reproducibility` (the regenerated reports/packs were not committed yet) and `cross-language-variety` (32 vacuous comparisons against the now-v2 German pack, fixed by reading both lesson shapes) |
| `npx vitest run tests/migrated-pack-parity.test.ts tests/migrated-pack-replay.test.tsx tests/pack-flip-rehearsal.test.tsx tests/pack-migration-cefr.test.ts tests/pack-migration-fields.test.ts` | **pass** — 59 tests across the five migration-evidence suites, covering two flipped packs and two still at v1 |
| `npx vitest run tests/cross-language-variety.test.ts` (alone) | **50 passed** — the 49 German/Spanish/Portuguese pairs plus the new dual-schema non-vacuity case |
| `python3 scripts/content/cross-language-similarity.py` | exit 0 — German pairs 32-51% similar, no same-shape matches; before the dual-shape fix it printed every German pair as an empty comparison |
| `E2E_BASE_URL=http://localhost:3101 npx playwright test --project=chromium --workers=1` (whole suite, after the German flip) | **84 passed, 3 skipped** — the 3 are the account specs needing `E2E_ACCOUNT_TEST` and a disposable Postgres. Includes the new `course-packs.spec.ts` German walk: every migrated lesson on the v2 course path, the relocated notice text, the authored `meet` answer graded correct, and the think-first gate still gating before its answer input |
| `E2E_BASE_URL=http://localhost:3101 npx playwright test --config playwright.offline.config.ts` | **10 passed, 3 skipped** — unchanged by the flip (Chromium full matrix, WebKit its expressible half) |
| `npx playwright test --config playwright.portable.config.ts` | **8 passed** (Chromium and WebKit) — unchanged by the flip |
| `npx tsc --noEmit` / `npm run lint` / `npm run build` (after the flip) | exit 0 / exit 0 (0 errors, 30 warnings — two fewer than the block started with) / exit 0 |
| `npx vitest run` (final, after the dialogue surface, `adc939b`) | **146 files passed, 1 skipped; 1136 passed, 6 skipped, 0 failed** |
| `npx vitest run` (final, after the graphics pass, `70a9482`) | **149 files passed, 1 skipped; 1163 passed, 6 skipped, 0 failed** |
| `npx vitest run tests/banner-crops.test.ts` (alone) | **10 passed** — the window contains the artwork, the art fills 90-97% of it, the phone render beats the strip (>= 1.6x for German), the shell receives the custom properties, the stylesheet crops only below 768px, and the generator re-checks when Python + Pillow are present |
| `npx vitest run tests/image-dimensions.test.ts` (alone) | **3 passed** — every declared ratio matches the file header, the brief's `1536x1024` pair fails it (non-vacuity), and no file in `public/brand` is unreferenced |
| `npx vitest run tests/ListenCover.test.tsx` (alone) | **5 passed** — metadata title/album, artwork path/type/size against the real JPEG header, the portable blob, the no-cover case, and a browser without the Media Session API |
| `E2E_BASE_URL=http://localhost:3101 npx playwright test --project=chromium --workers=1 tests/e2e/course-banner.spec.ts` | **5 passed** — German/French/Spanish at 320/390/430, desktop at the full frame, the library at the frame ratio. Re-run with the crop removed from the stylesheet: **3 failed** on the ratio assertion, desktop and library still green |
| `E2E_BASE_URL=http://localhost:3101 npx playwright test --project=chromium --workers=1` (whole suite) | **90 passed, 3 skipped** (85 before this block; the 3 need a disposable Postgres) |
| `E2E_BASE_URL=http://localhost:3101 npx playwright test --config playwright.offline.config.ts` | **10 passed, 3 skipped** — Chromium full matrix, WebKit its expressible half, including the downloaded edition's banner with the network off |
| `npx playwright test --config playwright.portable.config.ts` | **8 passed** (Chromium and WebKit) — including the embedded banner and the embedded lock-screen artwork in the single file |
| `npx vitest run` (Stage 2: the first-run block rebalanced) | **155 passed | 1 skipped (156); 1199 passed | 6 skipped (1205)** |
| `npx playwright test --project=chromium` | **101 passed (2.0m), 3 skipped** |
| `playwright test --config playwright.offline.config.ts` | **11 passed (19.5s)** |
| `npm run a11y:audit` | **0 axe violations** across 20 route/viewport combinations |
| lint / tsc / build / content:validate | 0 errors, 30 warnings / exit 0 / exit 0 / exit 0 |
| measured at 320x568 and 390x844 | mark 44x44, journal 103x103 (42% of the block), copy 16px, action 52px, no horizontal overflow, action clear of the tab bar |
| `npx vitest run` (stage 1) | **154 passed | 1 skipped (155); 1193 passed | 6 skipped (1199)** |
| `npx playwright test --project=chromium` | **99 passed, 3 skipped** |
| `playwright test --config playwright.offline.config.ts` | **11 passed, 3 skipped** |
| `npm run a11y:audit` | **0 axe violations** across 20 route/viewport combinations |
| lint / tsc / build / content:validate / content:audio-check | 0 errors, 30 warnings / exit 0 / exit 0 / exit 0 / exit 0 |
| `tests/vocab-ground.test.ts` non-vacuity | snapping `map.jpg` makes it fail (the OK list gains the map, the "left alone" set changes); restored byte-for-byte |
| ground check across all 28 pictures | 19 on the canvas at 1 unit off; 9 recorded exceptions, six of them drawings and three the kept photographs |
| `npx vitest run` (the player artwork block) | **153 files passed, 1 skipped; 1191 passed, 6 skipped, 0 failed** |
| `npx playwright test --project=chromium` | **99 passed, 3 skipped** |
| `playwright test --config playwright.offline.config.ts` | **11 passed, 3 skipped** — the cover image included |
| `playwright test --config playwright.portable.config.ts` | **12 passed** (Chromium and WebKit), with both player files embedded in the single file |
| `npm run a11y:audit` | **0 axe violations** across 20 route/viewport combinations |
| lint / tsc / build / content:validate | 0 errors, 30 warnings / exit 0 / exit 0 / exit 0 |
| measured at 390x844 and 1280x900 | card **612px** against the 633 limit; cover 76x43 in the header row on a phone, 420x237 above 480px; clear of every transport control; no sideways overflow |
| `public/study.css`, `public/study.js` | regenerated and committed with this block — the player's code is in the offline bundle, and the reproducibility guard refused the diff until it was staged |
| `npx vitest run` (the bill/shopkeeper block) | **153 files passed, 1 skipped; 1187 passed, 6 skipped, 0 failed** |
| `npx vitest run tests/asset-provenance.test.ts tests/image-dimensions.test.ts tests/curriculum-fixture.test.ts` | 3 files, **36 passed** (10/12/6/1, both new hashes, both new alts, the sheet's reasoning still pinned) |
| `npm run content:build` | exit 0 and **no generated artifact changed** — `study.css` and `study.js` byte-identical |
| `E2E_BASE_URL=http://localhost:3101 npx playwright test --project=chromium --workers=1` | **97 passed, 3 skipped** |
| `npx playwright test --config playwright.offline.config.ts` | **11 passed, 3 skipped** |
| `npx playwright test --config playwright.portable.config.ts` | **10 passed** (Chromium and WebKit) |
| `npm run a11y:audit` | **0 axe violations** across 20 route/viewport combinations |
| `npm run content:validate` / `content:audio-check` | exit 0 / exit 0 |
| `npm run lint` / `npx tsc --noEmit` / `npm run build` | 0 errors, 30 warnings / exit 0 / exit 0 |
| `npm run content:build` | exit 0 and **no generated artifact changed** — `study.css` and `study.js` stay byte-identical, which is the confirmation the vocabulary pictures are in neither bundle |
| `npx vitest run tests/asset-provenance.test.ts tests/image-dimensions.test.ts tests/curriculum-fixture.test.ts` | 3 files, **36 passed** (12 CC0 / 10 project / 6 scenes / 1 map, all 28 hashes, the not-snapped decisions) |
| `E2E_BASE_URL=http://localhost:3101 npx playwright test --project=chromium --workers=1` | **97 passed, 3 skipped** (+1: the emergency drill's hospital picture) |
| Same, `tests/e2e/guided-session.spec.ts` alone | **11 passed** |
| `npx playwright test --config playwright.offline.config.ts` | **11 passed, 3 skipped** |
| `npx playwright test --config playwright.portable.config.ts` | **10 passed** (Chromium and WebKit) |
| `npm run a11y:audit` | **0 axe violations** across 20 route/viewport combinations |
| `npm run content:validate` / `content:audio-check` | exit 0 / exit 0 |
| Attachment inventory: `ls` + `find` over every attachment folder, `~/Downloads` and the repo | ten unexamined files identified by reading each; no receipt or market stall; `~/Downloads` holds brand references only |
| `npm run lint` / `npx tsc --noEmit` / `npm run build` | 0 errors, 30 warnings / exit 0 / exit 0 |
| `npx vitest run tests/scenes.test.ts tests/image-dimensions.test.ts tests/course-map.test.ts tests/asset-provenance.test.ts` | 4 files, **25 passed** |
| `E2E_BASE_URL=http://localhost:3101 npx playwright test --project=chromium --workers=1` | **96 passed, 3 skipped** (+3: two course-map walks, one emergency-scene walk) |
| `E2E_BASE_URL=http://localhost:3101 npx playwright test tests/e2e/course-map.spec.ts` | **2 passed** — its own size on the plan page, and no phone-column overflow |
| `npx playwright test --config playwright.offline.config.ts` | **11 passed, 3 skipped** |
| `npm run portable:build` + `--config playwright.portable.config.ts` | build exit 0; **10 passed** (Chromium and WebKit); artifact 18.2 MB → **18.4 MB** |
| `npm run a11y:audit` | **0 axe violations** across 20 route/viewport combinations |
| `npm run content:validate` / `content:audio-check` | exit 0 / exit 0 |
| Browser check of the plan page and the emergency session (390px) | map 358×240 at ratio 1.49 against the file's own 1.49, `alt=""`, 12px radius, no overflow; the emergency session renders `/images/scenes/minor-emergency.jpg` at 800×600 declared = natural |
| `npm run lint` / `npx tsc --noEmit` / `npm run build` | 0 errors, 30 warnings / exit 0 / exit 0 |
| `python3 .vl-snap-decide`-style check (modal colour vs the canvas) | ten files: eight cream grounds 9–14 off, snapped; `key.jpg` (129 off) and the bill scene (82 off) left alone by hand |
| `npx vitest run` (post-commit, this block) | **152 files passed, 1 skipped; 1184 passed, 6 skipped, 0 failed** |
| `npx vitest run tests/scenes.test.ts` (alone) | **6 passed** — files, both lookups, coverage both ways, portable embedding, the lettering rule |
| Same, with the fixture's scenario renamed and the portable embed loop removed | 2 failures, both by name: "the fixture no longer has the scenario …", "the portable edition does not embed /images/scenes/ordering-coffee.jpg" — restored, 27 passed |
| `npx vitest run tests/LessonScenes.test.tsx` (alone) | **3 passed** — v2 shell, legacy shell, and no picture for a lesson that is not a situation |
| `E2E_BASE_URL=http://localhost:3101 npx playwright test --project=chromium --workers=1` | **93 passed, 3 skipped** |
| `E2E_BASE_URL=http://localhost:3101 npx playwright test tests/e2e/guided-session.spec.ts --project=chromium` | **9 passed** — including the scene showing for `fr-ordering-politely` and absent for `fr-greet-politely` |
| `npx playwright test --config playwright.offline.config.ts` | **11 passed, 3 skipped** — the viewed scene is in `caches.match`, and still there with the network off |
| `npm run portable:build` + `--config playwright.portable.config.ts` | build exit 0; **10 passed** (Chromium and WebKit); artifact 17.3 MB → **18.2 MB** |
| `npm run a11y:audit` | **0 axe violations** across 20 route/viewport combinations |
| `npm run content:validate` / `content:audio-check` | exit 0 / exit 0 |
| Browser check of the travel-session scene (390 and 1280) | 358×269 and 544×408 at the file's own ratio 1.333 vs 1.333 natural, `alt=""`, 12px radius, no horizontal overflow; `fr-greet-politely` renders no scene at all |
| `npm run lint` / `npx tsc --noEmit` / `npm run build` | 0 errors, 30 warnings / exit 0 / exit 0 |
| `python3 scripts/brand/snap-ground.py` (the four pictures) | 7/10/10/16 → 1 before/after; `--check` exit 0 — the ground is the canvas cream |
| `python3 scripts/brand/snap-ground.py` (the German reference) | 7 → 1, 53.2% of pixels remapped; `--check` exit 0 |
| `python3 scripts/brand/compare-reference.py` (after the swap) | `courses/german.jpg` at **1.54 with a 0px shift** (was 71.10 at +278 px); the other nine unchanged |
| `python3 scripts/brand/banner-crops.py` | re-measured german **2.749 @ 100%** (was 2.391 @ 50.42%); french/italian/spanish/portuguese unchanged |
| crop block extracted from `HEAD:public/study.js` vs the regenerated one | the only data change is german `2.391@50.42` → `2.749@100`; 831,028 → 831,026 bytes |
| `npx vitest run` (post-commit, this block) | **150 files passed, 1 skipped; 1174 passed, 6 skipped, 0 failed** |
| `E2E_BASE_URL=http://localhost:3101 npx playwright test --project=chromium --workers=1` | **90 passed, 3 skipped** |
| `npx playwright test --config playwright.offline.config.ts` | **10 passed, 3 skipped** |
| `npm run portable:build` + `--config playwright.portable.config.ts` | build exit 0; **8 passed** (Chromium and WebKit) |
| `npm run a11y:audit` (the brief's alt-text step) | **0 axe violations** across 20 route/viewport combinations |
| `npm run content:validate` / `content:audio-check` | exit 0 / exit 0 |
| Browser check of the German banner (390 and 1280) | course page 350×127 with `--banner-crop: 2.749` @ 100%, 872×216 full frame at 1280, library 281×70, lesson shell none, no horizontal overflow |
| Rendered-band measurement (first non-ground column) | 19px of 350 (5.4%) against the 5.6% the crop data predicts — the drawing is inside the window, not clipped |
| Browser check of the picture drill at 390 | four choices 285×214, `object-fit: cover`, all four approved compositions whole, alt text rendering as the caption |
| `npx vitest run tests/{banner-crops,image-dimensions,asset-provenance,curriculum-fixture,PictureChoice,service-worker}.test.*` | 6 files, **67 passed** (focused, before the commit) |
| `npm run lint` / `npx tsc --noEmit` / `npm run build` | 0 errors, 30 warnings / exit 0 / exit 0 |
| `python3 scripts/brand/compare-reference.py --crops` | exit 0 — ten shipped assets against their approved references: nine re-encoded or re-framed as documented, and `german.jpg` measured 71.10 at rest against 13.54 at a +278px shift |
| `python3 scripts/brand/icon-audit.py` | exit 0 — the maskable icon's artwork inside the 80% safe circle, the other three within 6-8 mean grey of the approved square |
| `npx vitest run tests/asset-provenance.test.ts` (alone) | **6 passed** — every tracked asset named in the document, nothing documented that is missing, the removed files only in the removed section, the German deviation and its crop consequence stated, every table row with dimensions and a size |
| `npx vitest run tests/service-worker.test.ts` (alone) | **13 passed** — including "precaches every image the offline page renders", proved non-vacuous by dropping `/brand/empty-journal.jpg` from `STATIC_ASSETS` (fails by name) and restoring it |
| `npx vitest run` (final, this block, `d4566a7`) | **150 files passed, 1 skipped; 1170 passed, 6 skipped, 0 failed** |
| `E2E_BASE_URL=http://localhost:3101 npx playwright test --config playwright.offline.config.ts` | **10 passed, 3 skipped** — the reconnect page now asserts its state mark decodes with the network off and came from `caches.match` |
| `E2E_BASE_URL=http://localhost:3101 npx playwright test --project=chromium --workers=1` (whole suite) | **90 passed, 3 skipped** |
| `npx playwright test --config playwright.portable.config.ts` | **8 passed** (Chromium and WebKit) |
| Browser check of `/offline.html` at 320/390/1280 | mark 82/110/150px, no horizontal overflow, eyebrow style intact after the class change |
| `npm run lint` / `npx tsc --noEmit` / `npm run build` | exit 0 (0 errors, 30 warnings) / exit 0 / exit 0 |
| `npm run lint` / `npx tsc --noEmit` / `npm run build` (after the graphics pass) | exit 0 (0 errors, 30 warnings — the same count the block started with) / exit 0 / exit 0 |
| `npx vitest run tests/DialoguesView.test.tsx` (alone) | **4 passed** — the authored dialogues, one played to its terminal node and restarted, the no-content guard against German, and every prerequisite id resolving to a real lesson |
| `E2E_BASE_URL=http://localhost:3101 npx playwright test --project=chromium --workers=1` (final) | **85 passed, 3 skipped** — the German v2 walk and the dialogue walk included |
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
| `4043f14` | **The Listen player card** — the visual brief implemented, with the phone-layout and skip defects its tests found |
| `bfc61d5` | **The offline matrix's failure half** plus WebKit coverage, and the download control's learner-facing failure message |
| `df64349` | Run record — the dialogue gap's plan |
| `7a115a1` | **The migration stops dropping `culturalNote`**, plus a field census so an unauthorised drop fails by name |
| `4e636eb` | **Phase 2B — German flipped to schemaVersion 2**; legacy suites retargeted onto Spanish, migration evidence suites renamed and parameterised, dual-schema accessors in the variety guard, docs and generated reports updated, and the eight stray `* 2.*` copies removed |
| `3823b59` | The German course-page e2e walk the flip needed — the browser half the playbook assumed and found empty |
| `adc939b` | **The v2 dialogue gap, closed** — the shell can reach a course's scripted conversations again, with the content guard and the prerequisite label |
| `3ac2561` | Run record — the German flip and the dialogue surface |
| `de7d463` | **Graphics pass 2 — the course page keeps its artwork, and a phone gets the drawing**: the shared banner map, the measured narrow-viewport crop, both shells rendering it, and the responsive/e2e/offline/portable guards |
| `e1c229f` | **Declared image dimensions guarded**, the foreign 1MB asset out of `public/brand`, and the design brief's stale items corrected |
| `70a9482` | **Lock-screen artwork for the listening lessons** — the course banner in the media metadata, in all three editions |
| `59adb4d` | Run record — the graphics pass |
| `d73c34f` | **Every asset verified against its approved reference** — the comparison and icon-audit tools, the asset inventory script, `docs/asset-provenance.md` rewritten around the measurements, and the test that keeps document and tree in step |
| `d4566a7` | **The offline page gets the app's own state mark**, with the precache coupling and the declared-dimension rule extended to plain HTML |
| `d3b8b49` | Run record — the reference audit and the offline state mark |
| `99970d6` | **The approved vocabulary pictures ship, and the German banner becomes its approved reference** — normalised and ground-snapped, alt text corrected to match the drawings, crop re-measured, `study.js` regenerated, provenance split in two and pinned by hashes |
| `8e09fb8` | Run record — the vocabulary pictures and the German banner |
| `f0513bc` | **Five more vocabulary pictures and the app's first lesson scenes** — the situation-keyed `scenes.ts`, three lesson surfaces wired, scenes embedded in the portable edition and cached offline, the artwork's own lettering kept out of `src/`, provenance split three ways and every hash checked against disk |
| `85dc920` | Run record — the ten approved assets and the first lesson scenes |
| `b255217` | **The minor-emergency scene and the course map** — the sixth situation in both lookups, the map on the one progress surface that describes a route, and the deferred pieces (portable/offline absence, the missing emergency lessons in three packs) documented rather than invented |
| `2f08a38` | Run record — the emergency scene and the course map |
| `5f52fa6` | **Stage 2: the first-run block rebalanced** |
| `b61ffa2` | **Stage 1: the seven supplied vocabulary replacements** — door, museum, street, map, card, wallet, hotel; six snapped to the canvas, the map deliberately not, two alt texts corrected where the drawing contradicted them |
| `da2b3dc` | **The player's own artwork** — a wide cover on the card (76x43 in the header row on a phone, the full frame above 480px), a square on the lock screen, both precached (worker v10) and both embedded in the portable file |
| `2632799` | **The standalone bill and shopkeeper illustrations** — both alts corrected against what the drawings show, the provenance tables rebalanced to 10/12, and the sheet's reasoning kept and pinned |
| `b8ca6c3` | **The approved hospital picture**, with the alt text deliberately unchanged, `bill.jpg`/`shopkeeper.jpg` kept as photographs and the evidence recorded for why the six-panel sheet cannot stand in, pinned by a test so the note cannot be deleted |

Nothing was pushed. No merge to `main`, no tag, no deployment.

## Next tasks

1. **Phase 2B continues — flip Portuguese, then Spanish.** German is done and is the worked example:
   the whole sequence, including every file that has to move, is written out under "To flip the next
   pack" below. Nothing new needs to be designed — the next flip is a repeat with the `V1_PACKS` /
   `PENDING_PACKS` lists shifted along, and it should stay one focused commit.
2. **Nineteen of the 22 vocabulary pictures are the project's own now; three are photographs.**
   `station.jpg`, `phone.jpg` and `passport.jpg` are the three the user approved or left out of
   the replacement list; the other nineteen are illustrations. The pass is settled and worked
   six times: supply at any size, `sips --resampleHeightWidth 449 800`, snap the ground **only
   if** the file's most common colour really is a background field (check it — five files are the
   other way round, and `tests/vocab-ground.test.ts` now enforces both halves), correct any alt
   the picture contradicts, extend the tables in `docs/image-provenance.md`, and let
   `tests/asset-provenance.test.ts` check the hashes.
   **Superseded — nothing is waiting on artwork now.** The older text below is kept for the
   record of how the pass worked:
   ~~Twelve of the 22 vocabulary pictures are the project's own now; ten are still photographs.~~
   Both of the two that were blocked arrived as standalone files and are shipped, so nothing
   is waiting on artwork. The remaining ten are the CC0 set the design brief calls "the single
   biggest mismatch with the illustration system", and the pass is settled and worked four
   times: supply at any size, `sips --resampleHeightWidth 449 800`, snap the ground **only if**
   the file's most common colour really is a ground (check it — `key.jpg`'s was the drawn door,
   `hospital.jpg`'s the tan facade and the vocabulary bill's the dark leather folder),
   correct any alt the picture contradicts (the shopkeeper one announced a person who is not in
   the drawing), extend the tables in `docs/image-provenance.md`, and let
   `tests/asset-provenance.test.ts` check the hashes.
   **Waiting on you, and cheap when you get to it:** six supplied illustrations have never been
   assigned — the shop door (`door.jpg`), the card payment terminal (`card.jpg`), the map with
   a compass (`map.jpg`), the wallet with cards and coins (`wallet.jpg`), the hotel entrance
   with a luggage cart (`hotel.jpg`, unmistakably a hotel) and the street of facades
   (`street.jpg`, probably). Each is the same four steps as the last four replacements. Two
   further supplied files describe a desk rather than any word the drills teach, and two are
   entrances ambiguous between museum, station and shop; those need your label rather than a
   guess.
3. **The player's artwork is wired, and one test decided its layout.** The brief's "without making the
   player full-screen" is held at three quarters of the viewport by `tests/e2e/listen.spec.ts`; a
   full-width cover on a phone broke it at 92%, so the phone gets album-thumbnail size in the header
   row and the full frame opens above 480px. If that artwork changes, re-take the measurement.
4. **The graphics pass's human half.** Everything the checklist asks for that code can do is done and
   guarded; what is left is art: regenerating the German banner as a wide frieze so it matches the
   other four, redrawing the remaining 13 vocabulary photographs as on-palette illustrations, and the
   lesson-scene illustration set. Each needs an image model and a reviewer. `docs/design/graphics-brief.md`
   now records the constraint new banner art must respect.
4. **A second opinion on the German flip's content.** The migration is mechanical and the file is
   verified, but nothing here reads German prose for naturalness: the 8 lessons' German and English
   strings are the same ones that were reviewed (or not) as v1, and the native-speaker gate stays
   open. Re-running the *content* gates on the flipped file (`npm run content:validate`,
   `content:audio-check`) is the mechanical half and passes; the reading half is human.
5. **The Listen brief's remaining item** — nothing outstanding in code. AirPlay and lock-screen
   behaviour on a physical device is the same device pass the Phase 3A gate waits on; the lock-screen
   *metadata* now carries the course artwork, and whether it renders as intended on iOS is part of
   that pass.
6. **More situations, if you want them.** Six scenes cover six situations; the app teaches eight
   travel patterns per language plus 25 foundation lessons per language, and the mapping deliberately
   maps only exact matches (`food-foundation` is not a café counter). A further approved scene —
   greetings, buying food at a market, finding a place — would need one table entry and one file, and
   `tests/scenes.test.ts` checks the folder has no orphans. Note the gap the emergency scene exposed:
   German, Spanish and Portuguese ship no emergency *lesson*, so that picture reaches those courses
   only through the travel sessions — closing it is authored content, not code.
7. **Phase 3B — audio expansion** for German/Spanish/Portuguese and one reviewed long track per
   language. Blocked on the human listening checklist; can be prepared but not closed here.
8. **Phase 4 — curriculum depth**, which needs editorial/native-speaker capacity.

Closed since this list was written, so it stays closed: **the v2 dialogue gap** (`adc939b`, closed in
the previous block — the plan below is history), and **the German banner defect** on all four surfaces
(`64ba98a`, plus this block's v2-shell and mobile-crop work).

## Precise continuation instructions

### To finish Phase 3A (standalone offline Listen)

Landing status: **done apart from the physical-device pass.** The audio installs with the download,
Listen is reachable in the hosted, downloaded and portable editions, the player is the card the brief
asked for, and the failure matrix is covered at the unit level and in the browser on two engines. The
gate's remaining item is a human device pass — nothing in this repository can close it.

If you touch this area again, the two things to know:

1. **Playwright cannot see requests the service worker answers**, so `page.route` cannot interrupt an
   install or throttle the audio. Do mid-flight failures at the unit level
   (`tests/offline-install-listen.test.ts`).
2. **Playwright's WebKit cannot navigate with the network emulated off** ("internal error") and cannot
   play media out of Cache Storage while offline. `playwright.offline.config.ts` runs it on the cases
   it can express; the skips carry their reason in the test. If a future Playwright fixes this, delete
   the skips and widen the WebKit project's `testMatch` to include `offline.spec.ts`.

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

### To flip the next pack (Portuguese, then Spanish) — the played-out version

German is the worked example; this is the sequence that actually ran, in order:

1. `git show HEAD:courses/<language>/manifest.json > /tmp/<language>-v1.json` (the v1 source, for the
   before/after diff — after the flip it exists only in git history).
2. `npx tsx scripts/migrate-pack-v1-v2.ts courses/<language>/manifest.json`
3. Confirm the written file equals a fresh in-memory `migratePackV1ToV2()` result, and that the counts
   match the backup captured in step 1 (lessons, units, concepts, vocabulary, media hashes, retained
   exercises, think→predict count, reachable activities, review links, prerequisites, tags, notes).
4. `npm run content:build` — regenerates `public/packs/<language>.json`, the per-course reports,
   `src/features/course-pack/catalog.json` and the portable bundles.
5. Retarget the legacy-engine suites onto the next v1 pack (`spanish` then `portuguese`): the six files
   listed in the 2B section, plus `think-gate-migration.test.tsx` and `portable-environment.test.ts`.
6. Update the pack lists in `tests/migrated-pack-parity.test.ts` (move the language from
   `PENDING_PACKS` into `MIGRATED_PACKS` with its measured counts), `tests/migrated-pack-replay.test.tsx`
   (`PACKS`), `tests/pack-migration-cefr.test.ts` (`V1_LANGUAGES` / `CARRIED_PACKS`),
   `tests/pack-migration-fields.test.ts` (`V1_PACKS` / `FLIPPED_PACKS` with notes+tags counts) and
   `tests/pack-flip-rehearsal.test.tsx` (`PENDING` / `FLIPPED`).
7. `npx vitest run`, `npm run lint`, `npm run build`, `npx tsc --noEmit`, then the e2e suites.
8. Update `README.md`, `docs/cefr-coverage.md` and `docs/astra/phase-status.md` (schema column, the
   findings that name packs as v1, the migration note) and this record.

When the last v1 pack flips, the six legacy suites have no real v1 content left to run against:
extend `tests/fixtures/lesson-variety.ts` rather than deleting the assertions.

Everything before the retargeting is proven: the authored tags and notes survive (`4bac558` plus the
fields commit), the runtime boundary is identical (`tests/migrated-pack-parity.test.ts`, parameterised
over the remaining v1 packs *and* the flipped ones), the course still runs after a flip
(`tests/pack-flip-rehearsal.test.tsx`), and stored history still counts against the flipped pack
(`tests/migrated-pack-replay.test.tsx`). Step 5 of the list above was empty in practice for German —
no e2e spec walks that course — so do not budget for it without checking.

### To change a course banner, or add a course with artwork

1. Drop the file at `public/brand/courses/<slug>.jpg`. 2064×512 is the set's frame; a different size
   works (the CSS never stretches) but the crop window is derived from the file, so it must be
   re-measured either way.
2. Add the slug to `BANNER_BY_LANGUAGE` in `src/features/course-pack/banners.ts`. One map serves both
   shells, the landing showcase and the library; `tests/course-banners.test.ts` fails if a catalogued
   course is missing from it, from the two listings, or from the portable bundle.
3. Re-measure the crop: `python3 scripts/brand/banner-crops.py` (needs Pillow). It writes
   `banner-crops.json`; `tests/banner-crops.test.ts` fails if any artwork would fall outside the
   window it computes, and re-runs the script as a check where Python is available.
4. Keep the drawing inside the frame and nothing meaningful in the outer margins — a composition that
   needs the whole 4:1 frame will not survive a phone. The crop can only remove empty ground.
5. `npm run content:build` (regenerates `study.css`/`study.js`), then the banner specs, the offline
   spec and the portable spec. The service worker precaches `/brand/courses/*`; a new file needs no
   SW version bump, but a learner who installed before the change keeps the old bundle until they
   re-download, because `/study.*` is served network-first and falls back to the installed pack cache.
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
  **actioned**, and so is the code-settled half of `docs/design/graphics-brief.md` that it points at:
  the banner defect it names is fixed on every surface, the mobile presentation is measured rather
  than guessed, and the design brief's own technical leftovers are closed. What remains from its
  broader list is the part that needs new artwork (lesson-scene illustrations, on-palette vocabulary
  illustrations, a course-map illustration), and none of it was faked with borrowed imagery — see
  "what was audited and deliberately left alone" above. The brief itself is still untracked: decide
  whether it belongs in the repository, and whether it should be committed now that its requests are
  either done or explicitly parked.
- **Found, not fixed (out of the packages above):** German has a foundation pack and a course page
  but is absent from `progress.courses` (the travel fixture's four slugs), so it never appears in
  the dashboard's language switcher or the welcome flow, and `/courses` is its only entry point
  besides a direct URL. Adding it means changing the dashboard's course universe — a Phase 1B-scale
  change, not a Phase 1A fix.
- **Solved: the v2 dialogue gap** (see the section above). It was "found, not fixed" in the previous
  block; `adc939b` closed it, and the plan written then is what shipped, with one correction — the
  page-level nav the plan assumed is not where it went, because the v2 shell's course page has no tab
  set; the dialogues render as a section under the course path instead.
- **Found, not fixed — the original v2 dialogue gap notes, kept for the record.** After the French flip no shipped
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
- **Playwright's WebKit, not the app, blocks part of the offline gate.** Any navigation with the
  network emulated off raises "WebKit encountered an internal error" (probed with `goto`, `reload` and
  a cold open, no app code involved), and media cannot be played out of Cache Storage while offline
  there either. The WebKit project runs what it can express and the rest skip with the reason in the
  test. **The gate's WebKit and physical-iPhone pass therefore remains open human work** — this run
  did not close it and does not claim to.
- **Untracked duplicates in the working tree, not written by this run:** `README 2.md`,
  `scripts/content 2.ts`, `src/features/course-pack/{ExerciseView,OfflineDownload,environment} 2.*`,
  `tests/{CourseExercise.test,use-review-mutation 2}*`, `tests/e2e/{course-packs,onboarding}.spec 2.ts`.
  They are macOS-style copies dated before this block and are untracked, so nothing ships them; vitest
  and Playwright cannot pick them up (their names do not match the test patterns), and `tsc`/`next
  build` are green with them present. Left alone rather than deleted: they are not this run's files.
  Worth removing by hand.
- **Found and fixed this run:** `authoredCefrTags` is no longer empty for migrated packs — the v1→v2
  migration carries the tag (`4bac558`). The three packs still at v1 will keep it when they flip.
  The two packs already flipped (French, Italian) have no tags in their committed manifests; repairing
  them means re-running their migration from the v1 source, which is a data change for the user to
  decide, so it is recorded rather than done.
- **Found and fixed in passing:** the course library's placement link was gated on `kind ===
  'foundations'`; German's two "no art" flags; the offline collector's hand-written banner list.
  All three are the same disease as the Phase 1A bugs — a capability encoded as a hand-maintained
  flag rather than derived from data.
