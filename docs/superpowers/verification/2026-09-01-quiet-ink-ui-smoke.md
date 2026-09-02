# Quiet Ink UI smoke verification

Date: 2026-09-02
Branch: `opencode/quiet-ink-continuation` (based on `origin/main` at `361a36e`)
Method: the app was served with the repo's own e2e webServer command (`next dev --webpack`, port 3100) from a clean clone of this branch; browser evidence was captured with Playwright Chromium. The clone was used because this machine's iCloud sync made the primary checkout too slow to run test workers reliably.

## Screenshots

Captured after the fixes listed below:

- `docs/screenshots/quiet-ink-dashboard-desktop.png` — `/` at 1440×1000
- `docs/screenshots/quiet-ink-dashboard-mobile.png` — `/` at 390×844
- `docs/screenshots/quiet-ink-session-desktop.png` — `/learn/english-to-french` at 1440×1000
- `docs/screenshots/quiet-ink-session-mobile.png` — `/learn/english-to-french` at 390×844

## Checklist results

| Requirement | Result | Evidence |
| --- | --- | --- |
| Today CTA position (≤760px above the fold) | Pass after fix | Playwright bounding box: CTA at y≈540 (bottom 592) in a 844px viewport. Before the fix it sat at y≈1112. |
| Today CTA position (desktop 1440×1000) | Recorded, not constrained | CTA at y≈1051, just below the fold. The approved spec's above-the-fold constraint applies at widths ≤760px only. |
| Generic, data-driven course selector | Pass | Segments render from `progress.courses` with `aria-label` = full course title and `aria-pressed` selection; unit tests cover an arbitrary third course (`tests/DailyPathDashboard.test.tsx`); e2e switches courses by accessible name. |
| No page-level horizontal overflow | Pass | e2e `assertNoHorizontalOverflow` passes at 390×844 (dashboard and session) and 1280×900 (session); probe confirms `scrollWidth ≤ innerWidth`. |
| Session stepline, no step rail | Pass | One "Session progress" progressbar plus the `Step 1 of 4 · Review` stepline; no `navigation` role exists. Covered by unit and e2e tests. |
| Answer reveal is deliberate and resets | Pass | Answer text is absent before reveal (desktop probe `answerVisibleBeforeReveal: false`), appears after "Reveal model answer", and is hidden again after advancing. Covered by unit and e2e tests. |
| Unavailable-audio fallback is truthful | Pass | Italian course shows the "Audio isn't included in this preview yet." note and no player; French ordering shows the lesson audio player region with a "Start lesson" control (probe: `audioRegionCount: 1`, `startLessonVisible: true`). |
| Mobile session actions | Pass after fix | Action dock pins with `position: sticky` (reveal control at y≈716 in an 844px viewport); buttons are full width at ≤760px. |

## Fixes made during this smoke pass

- `session.module.css`: removed `overflow: hidden` from `.activeStep`, which had neutralized the sticky mobile action dock.
- `dashboard.module.css`: at ≤760px the intro becomes a compact masthead (no artwork, tighter headline) and the Today card orders its CTA right after the heading so the primary action stays above the fold.
- `src/app/page.tsx`: typed with the generated `PageProps<'/'>` helper; Next 16's dev typegen rejects the previous optional-props default parameter.

## Automated verification (full run, this branch)

- `npm test` — 19 files, 108/108 pass
- `npm run test:e2e` — 6/6 pass
- `npm run lint` — exit 0 (0 errors)
- `npm run typecheck` — exit 0
- `npm run build` — exit 0 (7 routes)
- `git diff --check` — clean

## Known notes

- `public/illustrations/daily-practice.png` still contains coral and lime shapes. The spec defers regenerated teal-paper artwork until image assets are supplied.
- `src/app/api/voice/transcribe/route.ts` has three pre-existing eslint warnings (`MAX_TOTAL_BODY_BYTES`, `oversizedResponse`, `readBoundedBody` unused). They predate this branch; the route's behavior is covered by passing voice tests. Lint exits 0.
- The screenshot pass initially mis-reported the audio player and CTA as missing because 5-second static captures raced page hydration; the numeric probe and e2e assertions above are the authoritative evidence.
