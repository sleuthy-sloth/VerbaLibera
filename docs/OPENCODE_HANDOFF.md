# OpenCode Handoff — VoxLibre Quiet Ink redesign

## Repository and branch

Work from this worktree and branch:

```text
/Users/spkoehl/Documents/ChatGPT/VoxLibre/.worktrees/voxlibre-phase-1
codex/voxlibre-phase-1
```

The top-level `/Users/spkoehl/Documents/ChatGPT/VoxLibre` checkout is docs-only. The application source is in the worktree above. Do not touch the pre-existing untracked file `README 2.md`.

## What is already committed

- `1a1b6b6 docs: define quiet ink interface redesign`
- `2d64bd3 docs: plan quiet ink interface redesign`
- `37ccecb feat: establish quiet ink visual foundation`
- `dba162b fix: complete quiet ink palette tokens`
- `f2a1222 feat: redesign dashboard as quiet ink daily path`
- `9354024 feat: redesign dashboard as quiet ink daily path`
- `64b0d19 feat: redesign dashboard as quiet ink daily path`
- `f1b732f feat: redesign dashboard as quiet ink daily path`
- `87d68d6 test: harden dashboard breakpoint guard`
- `147ee1a test: reject reversed dashboard breakpoint range`
- `ed5fa10 feat: redesign guided session flow`

The repeated dashboard commits are intentional: task-scoped review found edge cases around the required mobile breakpoint, and each commit hardens its regression test.

## Approved design and plan

Read these first:

- `docs/superpowers/specs/2026-09-01-quiet-ink-interface-redesign.md`
- `docs/superpowers/plans/2026-09-01-quiet-ink-interface-redesign.md`

Quiet Ink is the approved direction:

- canvas `#f4f3ee`; surface `#ffffff`; ink `#1a1f1e`; deep ink `#0f1312`
- teal-only accent `#1e6563`, strong `#174b4a`, soft `#e4edeb`
- Newsreader display, Instrument Sans body, IBM Plex Mono utility
- course selection remains data-driven from `progress.courses`; never hardcode French/Italian controls
- no hearts, penalties, leaderboards, or noisy celebration treatment

## Completed and reviewed

### Task 1: visual foundation

Completed and independently reviewed.

- `src/app/layout.tsx` loads Quiet Ink fonts with `next/font/google`.
- `src/app/globals.css` contains the approved tokens, flat canvas background, visible focus, reduced-motion behavior, and teal selection.
- `src/app/manifest.ts` has canvas theme/background, id, description, and Today/Resume session shortcuts.
- `public/offline.html` uses Quiet Ink styling.
- `public/sw.js` was intentionally not changed.

Focused verification passed: global-style, manifest, and service-worker tests; typecheck.

### Task 2: dashboard

Completed and independently reviewed.

- Header has data-driven course segments, retaining full accessible course names and `aria-pressed` selection.
- The main “Today’s 8-minute path” card owns the daily goal, Review/Drill/Pattern rows, CTA, and time estimate.
- Progress snapshot is desktop-sticky and contains the review queue exactly once.
- CTA still requires both matching curriculum data and session data.
- Responsive breakpoint is intentionally exact: desktop starts at `min-width: 761px`; mobile behavior applies through `max-width: 760px`.
- `tests/DailyPathDashboard.test.tsx` includes a test-local media-query guard for legacy and modern 760px range syntax, preventing accidental overlap at the boundary.

Focused dashboard tests, typecheck, and diff whitespace checks passed.

## Implemented but review pending

### Task 3: guided session

Commit `ed5fa10` is implemented and has focused tests/typecheck/diff checks passing, but its independent task review was interrupted when pausing work. Review it before changing or merging further.

Expected behavior:

- Horizontal session rail removed; one stepline plus native progress bar remains.
- Answer is hidden until `Reveal model answer`; reveal state resets when Continue advances to the next step.
- Current fixture audio is still unavailable; UI must say so truthfully and must not show a Play prompt control yet.
- Completion includes exact sentence `Nothing was saved.`
- Mobile session actions are full-width and card layout is one column at `max-width: 760px`.

Focused verification already passed:

```text
npm test -- --run tests/GuidedSession.test.tsx tests/AudioPlayer.test.tsx
# 20 tests passed
npm run typecheck
git diff --check
```

`npm run lint` currently fails on an existing dashboard apostrophe rule in `src/components/dashboard/DailyPathDashboard.tsx:93`. Fix that small lint issue before declaring the redesign fully verified, then rerun lint.

## Remaining Quiet Ink work

1. Perform an independent review of Task 3 against its task brief:
   `.superpowers/sdd/2026-09-01-quiet-ink-interface-redesign/task-3-brief.md`
2. Complete Task 4 from the approved plan:
   - run the full frontend suite, lint, typecheck, and `git diff --check`
   - start the app and visually check `/` and `/learn/english-to-french` at 1440×1000 and 390×844
   - write findings in `docs/superpowers/verification/2026-09-01-quiet-ink-ui-smoke.md`
   - include Today CTA position, generic course selector, no page-level overflow, session stepline, answer reveal, and unavailable-audio fallback
3. Perform a whole-branch review before merge/publish.

## Separate original-audio work (not part of this redesign)

The separate approved design and plan are:

- `docs/superpowers/specs/2026-09-01-original-audio-and-voice-boundary-design.md`
- `docs/superpowers/plans/2026-09-01-original-audio-and-voice-boundary.md`

That work was paused before implementation because the worktree had iCloud availability problems. It will generate four static Kokoro WAVs, wire original audio to the session, and harden the Python multipart boundary. Do not present fixture `unavailable://` audio as playable until that plan is completed.

## Working-state notes

- Task workflow artifacts are under `.superpowers/sdd/2026-09-01-quiet-ink-interface-redesign/`; they are git-ignored and useful for detailed reports/review packages.
- Do not commit virtual environments, model caches, `.next`, or generated data.
- The branch has previously been pushed to GitHub; push the current branch after committing this handoff.
