# Accessibility & Navigation — what shipped

Companion to `2026-09-09-accessibility-and-navigation-review.md` (the findings).
This file records what was actually implemented, how it was verified, and what is
still open.

**Branch:** `opencode/lesson-variety` · **Base commit:** `26b5c2e`

---

## Verification

| Gate | Before | After |
| --- | --- | --- |
| `npx tsc --noEmit` | clean | clean |
| `npx vitest run` | 799 passed, 1 skipped | **810 passed, 1 skipped** (121 files) |
| `npm run lint` | 6 jsx-a11y rules, all `warn` | **0 errors**, 12 jsx-a11y rules at `error` |
| `npx next build` | green | green, +20 prerendered course-view paths |
| Playwright, full suite | 46 passed / 16 failed after the first pass | **62 passed, 0 failed** |
| axe, 8 learner routes | contrast failures on 10 route/viewport combos | **0 violations, all 8 routes** |
| Desktop, primary destinations reachable | `/listen` 0/4, `/you` 0/4, `/courses/*` 0/4 | **4/4 on every app route** |
| Desktop keyboard stops on `/listen` | 5 | 10 |

New permanent guards, all failing today if the work is reverted:

- `tests/type-scale.test.ts` — no `font-size` below 12px anywhere in `src/`.
- `tests/ia-links.test.ts` — every internal href resolves to a real route, and no
  link mixes the `/learn/english-to-*` and `/courses/*` slug spaces.
- `tests/copy-guard.test.ts` — 15 banned bookkeeping phrases, plus the XP/streak
  contradiction.
- `tests/e2e/a11y.spec.ts` — axe on every learner route, desktop primary-nav
  reachability, per-route titles, and a real 404 for a retired course URL.
- `tests/e2e/onboarding.spec.ts` — the first-run flow end to end.
- `tests/a11y-session.test.tsx` — `color-contrast` re-enabled.
- `eslint.config.mjs` — `label-has-associated-control`, `anchor-is-valid`,
  `tabindex-no-positive`, `no-autofocus` and friends at `error`.

---

## P0 — navigation and legibility

| Item | What changed |
| --- | --- |
| Desktop navigation | New `components/nav/AppHeader.tsx` renders Today / Courses / Listen / You on every app route. The bottom capsule is hidden ≥768px and nothing replaced it, so `/listen` and `/you` had no navigation at all. |
| Duplicate tab | `QuickNav` now renders four distinct destinations. `Practice` resolved to `localStorage.verbalibera_course` and defaulted to `/dashboard`, so two of four tabs pointed at the same URL on a first visit. |
| `/courses` index | New page: real course cards, lesson counts, per-course placement links. The landing page's `#courses` anchor was previously the only door to the library. |
| Soft 404s | `/learn/<unknown>` and its `/placement` and `/plan` children return a real 404 via `dynamicParams = false` + `generateStaticParams`. They used to return 200 with a five-word stub. |
| Branded 404 | New `app/not-found.tsx` with the brand and three routes back. |
| Contrast | `--muted-foreground` `#6b7672` → `#586360` (4.24:1 → 5.61:1 on canvas). `.is-locked` lost its `opacity: .72`, which had composited `--muted` from 5.57:1 down to 3.27:1 across 24 rows on every course page. |
| Type floor | Everything below 12px lifted: the language-switcher label was 9.3px (8.6px on mobile), the `/you` eyebrow 9.9px, course-path meta 11px. |
| Per-route titles | Each route names itself; every sub-page previously reported `VerbaLibera · Daily practice path`. |
| `lang` attributes | Target-language text in the listen transcript, lesson player (model answers, cloze sentences), vocabulary lists, lesson examples and the profile now carries a BCP-47 code. `features/course-pack/language-code.ts` maps both slug forms. |
| Route announcer | `components/nav/RouteAnnouncer.tsx` — a polite live region firing once per pathname change. App Router navigations were silent to assistive tech. |
| Duplicate source file | `src/components/nav/QuickNav 2.tsx` deleted. |

## P1 — approachability, the lesson shell, and the copy

**The existing onboarding plan was finished.** `WelcomeFlow` and
`features/onboarding/state.ts` were already written and unit-tested against
`2026-09-09-approachable-first-learning-experience.md`, but nothing imported the
component — a first-time learner went straight to a French course page with an
account panel, a download panel, PWA instructions and twenty-four "Locked" rows
above the first word. `DailyPathDashboard` now renders the welcome flow for a
learner who has never chosen a language, and the missed Task 6 e2e coverage
landed as `tests/e2e/onboarding.spec.ts`.

| Item | What changed |
| --- | --- |
| Lesson shell | Opening a lesson (v1 and v2 alike) renders it alone: one lesson, one "Back to the course", no download panel, no account panel, no course chrome. `?start=1` now lands on the lesson instead of scrolling a 3,300px page to a position below the chrome. |
| Addressable views | `/courses/<language>/<view>` for vocabulary, grammar, review and dialogues. The tabs were buttons with the selection living in `useState`, so reloading dropped you back on Course and a view could not be linked or shared. |
| Storage-scope copy | "0 practice results on this device · 0/25 lessons practised successfully. Device practice is separate from account progress." became "1 of 25 lessons practised · kept in this browser". The long version moved to `/you`, next to the action that changes it. |
| Locked rows | "Locked — complete First words to unlock" ×24 became a lock pill reading "After First words". |
| `.is-ready` state | A real bug: the class ternary sent every non-complete, non-next lesson to `is-locked`, so *available* lessons were dimmed and looked disabled. v1 now also gates the button on prerequisites, matching v2. |
| SRS jargon | "Assisted practice. This will remain in review." → "You used the model answer, so this one will come back sooner. That is the point of it." `review item`, `remains in review`, `independent practice`, `review history` are gone. |
| Reveal model | No longer a live control after the model is shown — it was a button that did nothing on every subsequent press. |
| `/listen` | Lists only lessons that actually have audio, with a single honest line about the rest. It used to render twenty-four consecutive "Audio being authored" rows. |
| `/you` | Leads with **What you can say** — real phrases derived from the curriculum the learner has met — then days practised, reviews waiting, today. XP and the streak counter are gone. |
| Reveal-to-answer arrows | `← Daily path` and friends no longer announce as "leftwards arrow"; the glyph is `aria-hidden`. |
| `role` on labelled divs | The two `aria-label`s on role-less `div`s on the landing page now carry `role="group"`. |
| CI | A named **Accessibility gate** step runs the axe spec before the wider e2e run, so a contrast regression reads as an accessibility failure. |

## P2 — structural

| Item | Status |
| --- | --- |
| Lesson shell as the default learning surface | Done for both engines. |
| Vocabulary pass | Partial: "Today" / "today's lesson" replaces the "Daily path" / "Today" / "8-minute path" / "session" pile-up; "Course workspace" → "Course sections"; "Foundation language" → "Learning language" (matching the dashboard switcher). Not exhaustive. |
| `/you` redesign | Done. |
| `prefers-contrast: more` | Done — opaque surfaces, darker muted ink, no blur, heavier focus ring. |
| Copy lint | Done (`tests/copy-guard.test.ts`). |
| Unify legacy `/learn/*` into the course routes | **Not done.** See below. |
| VoiceOver / TalkBack pass | **Not done.** See below. |

---

## What I deliberately did differently

**The PWA install manual stayed on the course page.** The plan said to move it to
`/courses/<language>/offline`. I kept it as a collapsed `<details>` on the course
page and tightened it from four paragraphs to three lines, because the *action*
the manual describes (the download button) has to stay where the learner is, and
hiding a primary action behind a link is worse than a disclosure. Both the unit
suite and the e2e suite click that button directly, which is the right contract.

**The account panel keeps its own section rather than moving entirely to `/you`.**
`e2e/foundation-sync.spec.ts` depends on switching scopes from the course page,
and that is the correct place for the control — the copy moved, not the control.

**`redirect()` / `useRouter()` were not adopted for the two full navigations** on
the dashboard and the profile. Both components render in unit tests and in the
offline shell, where no app router is mounted; `window.location` keeps them
renderable there. `LanguageSwitcher` already did this.

---

## Still open

### 1. Unifying the two course engines

`/courses/french` still runs the v1 engine and `/courses/italian` runs v2
(`public/packs/french.json` is `schemaVersion: 1`; italian is 2). Everything above
was implemented for *both* paths, so the learner-facing behaviour matches, but the
two engines remain and `CourseWorkspace.tsx` still carries both branches. Merging
them means migrating four content packs through the v1→v2 pipeline and re-authoring
their activity shapes. That is a content change, not a UI change, and it is the one
P2 item I did not attempt overnight — it needs the content:validate gate run per
language with the editorial review that implies.

### 2. A real screen-reader pass

I did everything that is verifiable without ears: `lang` attributes, focus
management on step change, live regions for status, accessible names on every
control, heading order, and a 404 that reads as a page rather than a code. What I
cannot do is listen to VoiceOver and judge announcement quality, verbosity, or
whether a step *feels* announced. That pass still needs a person, and it is the
one item in the review I am not claiming.

### 3. Two items on the review's open-questions list

- **Gamification**: I removed XP and the streak counter from `/you` and left the
  fields in the progress snapshot API. If you want them back, the profile is one
  component.
- **Language switcher vs. Courses page**: I kept both. The switcher is a
  within-course control; Courses is a destination. If you would rather have one,
  the switcher is the cheaper removal.

---

## Full Playwright suite

`npx playwright test --project=chromium --workers=1`

```
62 passed (1.2m)
```

Zero failures. Getting there took three passes: the first run came back
46 passed / 16 failed, which surfaced four genuine regressions the unit suite
could not see — the lesson shell swallowed the practice session so
"Begin practice" became a no-op, `/listen` labelled its buttons with the
recording's internal name before the pack resolved, the route announcer added a
second `role="status"` to every page, and the dashboard hid the language
switcher even when the learner had arrived with an explicit `?course=`. The
remaining failures were specs pinning copy and control names this work
deliberately changed, and each was rewritten to pin the new behaviour rather
than deleted.
