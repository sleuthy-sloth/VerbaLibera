# Hermes handoff: v0.2.1 follow-up

## Starting point

Work from branch `opencode/lesson-variety` at commit `8ab0b92` or newer.

`v0.2.0` is published, but it predates two Vercel fixes. Do not move that existing tag. Prepare a patch release as `v0.2.1` once the items below pass.

The latest Vercel preview is ready at:

`https://verbalibera-k67qwepbc-sleuthy-sloths-projects.vercel.app`

The first Vercel failure came from `src/features/listen/tracks.ts` importing an Italian transcript inside `services/voice`; `.vercelignore` excludes that authoring directory. The transcript now lives in `src/features/listen/generated/italian.json`. A second build failure came from `tests/ListenAudio.test.tsx` importing the ignored source file; it now imports the shipped generated transcript. Keep production imports and files included by TypeScript outside `services/voice` unless `.vercelignore` is deliberately changed.

## Goal order

1. Restore offline-install parity for courses using the v2 course path.
2. Update end-to-end coverage to test the v2 lesson player and path honestly.
3. Add a deployment guard for ignored runtime dependencies.
4. Expand Spanish, Brazilian Portuguese, and German in a consistent progression.
5. Obtain editorial review for long audio, then publish `v0.2.1`.

Do the first three before adding a large amount of content. They protect the existing release path.

## 1. Restore offline install for v2 course paths

### Problem

`RuntimeCourseWorkspace.tsx` gives Italian and other normalized v2 packs a clear Course path, but it does not expose the legacy `Download for offline study` flow. Existing browser tests still assume the old controls. Users need the same offline behavior regardless of which course runtime renders their pack.

### Implementation

1. Read `CourseWorkspace.tsx`, `portable-environment.ts`, `hosted-environment.ts`, `storage.ts`, `environment.ts`, and `public/sw.js` before changing the interface.
2. Identify the smallest shared offline-install API that works for both `CoursePack` and `RuntimePack`. Avoid duplicating cache and installation logic in `RuntimeCourseWorkspace`.
3. Widen or adapt `CourseEnvironment.install` only if the installed representation and its media list can be validated for both schemas. Keep type safety: do not use `as unknown as` to bypass it.
4. Add the following to the v2 path, near the course progress rather than inside an individual lesson:
   - `Download for offline study`
   - in-progress state
   - success state, `Downloaded on this device`
   - a useful failure message
   - an installed state that remains visible after reload
5. Verify that the installation includes the pack JSON and all media used by that pack. The standalone Listen MP3 tracks are intentionally saved with their own download link and should not be presented as installed app audio unless the service worker is extended to cache them.
6. Preserve the service worker rule that only a full `200` response is cached. Do not cache HTTP `206` range responses.

### Acceptance checks

- A v2 Italian course can be installed from `/courses/italian`.
- With DevTools or Playwright offline mode enabled, `/study.html?language=italian` loads after install.
- A learner can open the next unlocked lesson offline and audio used by that lesson behaves as designed.
- Install status persists after reload.
- Add unit tests for the v2 install control and update browser coverage. Run `npm test`, `npm run typecheck`, and the relevant Playwright specs.

## 2. Align browser tests with v2 behavior

### Current behavior to preserve

- An `information` activity persists its completion, then takes the learner directly to the first practice activity after one `Continue` action.
- The v2 player uses `Check`, `Next step`, `Finish lesson`, `Lesson complete`, and `Back to lessons`.
- The path shows one clear `Up next` lesson, completed lessons as reviewable, and locks later lessons until prerequisites are complete.
- Returning from a lesson must return to the Course path, not leave the prior lesson preview open. This is fixed in `RuntimeCourseWorkspace.tsx`.

### Work

1. Review `tests/e2e/helpers/complete-l0.ts`, `tests/e2e/course-packs.spec.ts`, `tests/e2e/foundation-sync.spec.ts`, `tests/e2e/offline.spec.ts`, and `tests/e2e/portable.spec.ts`.
2. Split reusable helpers by runtime where that makes assertions readable: legacy French behavior should not be disguised as v2 Italian behavior.
3. Replace assumptions about legacy controls with assertions about user outcomes:
   - completing First words unlocks Names and introductions;
   - the Course path identifies it as next;
   - a completed lesson remains selectable for review;
   - offline installation and cold start work for the v2 path.
4. Keep the tests deterministic. Wait for the explicit next control or activity instead of using a one-shot `isVisible()` probe after navigation.
5. Do not delete offline, persistence, audio-autoplay, or accessibility coverage merely because the markup changed.

### Acceptance checks

- `npx playwright test --project=chromium --workers=1` passes.
- Unit tests covering the automatic information-step advance remain present.
- The course path has explicit accessibility checks for progress and locked buttons.

## 3. Prevent ignored files from breaking Vercel again

### Work

1. Treat `services/voice` as authoring-only. Runtime transcript data belongs under `src/features/listen/generated/` or another directory that ships to Vercel.
2. Add a small check, preferably in a Node script or existing content build, that scans production TypeScript imports for paths matching ignored entries in `.vercelignore`.
3. Make the check fail with a direct message naming the source import and ignored path.
4. Add a regression test for the Italian transcript case.
5. Consider a CI command that copies the repository to a temporary directory, applies `.vercelignore`, then runs `npm run build`. Use it only if it is fast and reliable enough for CI.

### Acceptance checks

- `npm run build` passes locally.
- The ignored-import check fails for a deliberately introduced fixture and passes for current source.
- A Vercel preview for the branch reaches Ready.

## 4. Expand the new languages as coherent paths

Spanish, Brazilian Portuguese, and German each currently have four foundation lessons and a second unit. Continue each language in the same sequence; do not add disconnected vocabulary lists.

### Proposed units and lessons

| Unit | Outcome | Spanish | Brazilian Portuguese | German |
| --- | --- | --- | --- | --- |
| 3. Around town | Ask for and follow simple directions | transport, `¿Dónde está...?`, `a la derecha` | transport, `Onde fica...?`, `à direita` | transport, `Wo ist...?`, `rechts` |
| 4. Shopping | Request items and state quantities | food, prices, `quiero...` | food, prices, `quero...` | food, prices, `ich möchte...` |
| 5. Daily routines | Describe basic daily activities | time, common present-tense verbs | time, common present-tense verbs | time, common present-tense verbs and verb position |
| 6. Short exchanges | Handle a two-turn everyday conversation | café, directions, purchase | café, directions, purchase | café, directions, purchase |
| 7. Consolidation | Retrieve prior patterns without prompts | review and transfer lesson | review and transfer lesson | review and transfer lesson |

For each language and new lesson:

1. Begin with a short information, dialogue, story, listening, or scene activity when it makes learning clearer. Do not make all lessons repeated prompt-and-answer drills.
2. Use recognition, production, cloze, ordering, dictation, reading, and listening intentionally. Include at least one transfer task that uses a new name, place, or item.
3. Define prerequisite and completion rules that make the Course path truthful.
4. Add vocabulary and concept entries before referencing them from exercises.
5. Include accurate translations and feedback. Do not claim native editorial review until it occurs.
6. Run `npm run content:build` and inspect generated `public/packs/*.json` rather than editing generated packs by hand.

### Content acceptance checks

- Every new lesson is reachable in the visible path.
- No lesson unlocks without its declared prerequisite.
- Each language has at least one scenario-based lesson in every new unit.
- `npm run content:build`, `npm run content:validate`, and duplicate-content checks pass.
- A reviewer can identify the authoring source, generated pack, and audio provenance for every new asset.

## 5. Long-audio editorial review

Files to use:

- `docs/long-audio-authoring.md`
- `docs/audio-provenance/introductions-listen-stt-review.json`
- per-language script JSON under `services/voice/scripts/`
- per-language provenance JSON under `docs/audio-provenance/`

### Work

1. Have qualified native reviewers check Spanish, Brazilian Portuguese, German, and Italian audio for pronunciation, natural phrasing, pacing, target-language transcript accuracy, and English meaning.
2. Record reviewer name or role, date, disposition, and any edits in provenance. Do not store personal contact information.
3. Regenerate audio only from reviewed scripts. Update the source hash and audio hash in provenance after every regeneration.
4. Remove `reviewPending` only after the language’s review is documented.
5. Keep the Save MP3 link. It is the current supported way to take standalone Listen tracks offline.

## Release procedure for v0.2.1

1. Confirm `git status` is clean and that the branch includes the Vercel fixes (`7a7fdc8`, `8ab0b92`) plus the work above.
2. Update `package.json` and lockfile to `0.2.1` without creating a tag automatically.
3. Update the README only where behavior or availability changed. Keep the preview/native-review wording accurate.
4. Create `docs/releases/v0.2.1.md` with learner-facing release notes and verification summary.
5. Run:

   ```sh
   npm test
   npm run lint
   npm run typecheck
   npm run content:build
   npm run build
   npx playwright test --project=chromium --workers=1
   git diff --check
   ```

6. Commit, push `opencode/lesson-variety`, and verify its Vercel preview is Ready before tagging.
7. Create an annotated `v0.2.1` tag, push it, and create the GitHub release with `docs/releases/v0.2.1.md` as its notes.
8. Watch the GitHub macOS release workflow until it either attaches artifacts or reports a concrete failure. Do not claim desktop assets are available before that workflow succeeds.

## Do not do

- Do not force-move `v0.2.0`.
- Do not put secrets or environment files in Git.
- Do not import production code or globally typechecked tests from directories excluded by `.vercelignore`.
- Do not mark preview language audio as editor-reviewed without documented review.
