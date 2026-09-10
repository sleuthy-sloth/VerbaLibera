# Accessibility & Navigation Review — Findings and Improvement Plan

> **Implemented.** See `2026-09-09-accessibility-navigation-implementation.md` for
> what shipped, the verification numbers, and the two items still open.

**Reviewed commit:** `26b5c2e` (branch `opencode/lesson-variety`, 9 commits ahead of `main`)
**Date:** 2026-09-09
**Scope:** the whole learner-facing app — landing, dashboard, course workspace, lesson player,
listen, placement, study plan, profile, login, error/404 states.

## How this was measured

Not by reading code alone. The app was run on a local dev server and driven with a real browser:

- **axe-core 4.13** injected on 10 routes × 2 viewports (1280×900, 390×844), tagged to
  WCAG 2.0/2.1/2.2 A+AA.
- **Tab-order walks** — 14 tab presses per route per viewport, recording every focus stop's
  tag, name, visibility, and viewport position.
- **Full ARIA/structure dumps** — headings, landmarks, accessible names, labelled controls,
  unlabelled interactive elements.
- **A scripted walk through Lesson 0** of the French foundations pack (17 snapshots).
- **Colour maths** on every failing pair, plus candidate replacements.

Two limits worth stating plainly: this was a **fresh guest** session (no account, no saved
progress, no plan), so learner-with-history states were reasoned about from code rather than
observed; and no **real screen reader** (VoiceOver) pass was run — axe plus tab-order plus
structure covers a lot but not announcement quality or verbosity.

---

## Verdict

The app is **structurally much better than it feels**. axe found exactly *one* violation type
across 20 route/viewport combinations: colour contrast. Native radios, fieldsets, landmarks,
labelled controls, `aria-live` regions, focus-visible outlines, skip links, and
reduced-motion handling are all genuinely present. Someone did care.

The problems are of three other kinds:

1. **Navigation breaks in specific, reproducible places** — including a desktop nav that
   disappears entirely and a tab that appears twice.
2. **The palette and the type scale fail contrast and legibility** in ways the existing
   accessibility tests were explicitly configured not to notice.
3. **The product talks about its own plumbing instead of about language.** 116 instances of
   device/account/guest/preview bookkeeping language. This, more than anything visual, is the
   "cold and made by AI" feeling. The landing page promises a calm app; the course page opens
   with a storage-policy paragraph.

There is also a **plan already written and half-built** for exactly the right fix
(`2026-09-09-approachable-first-learning-experience.md`). The welcome flow exists,
is unit-tested, and **is imported by nobody**. That is the single highest-leverage thing in
this document.

---

## Part 1 — Findings

### A. Navigation

**A1. Desktop has almost no navigation.** `bottom-tabs.module.css` sets
`.tabs { display: none }` at `≥768px`. Only `/` (landing header) and `/dashboard` (its own
brand header) replace it. Measured keyboard stops at 1280×900, and what global nav each page
offers:

| Route | Keyboard stops | Global nav available |
| --- | --- | --- |
| `/` | 38 | landing header |
| `/dashboard` | 10 | wordmark → `/`, language switcher |
| `/courses/french` | 42 | **none** (only "← Daily path") |
| `/courses/italian` | 13 | **none** (only "← Daily path") |
| `/listen` | 5 | **none** |
| `/you` | 6 | **none** |
| `/login` | 9 | **none** (only "← VerbaLibera") |
| `/learn/english-to-french` | 20 | **none** |
| `/learn/…/placement` | 6 | **none** |
| `/learn/…/plan` | 13 | **none** |

`/listen` on a laptop is five tab stops: skip link, language `<select>`, one lesson button,
then the cycle repeats. There is no route out except the browser back button.

**A2. Two of four tabs point at the same URL.** On a first visit
`localStorage.verbalibera_course` is unset, so `QuickNav`'s deferred read leaves
`practiceHref` at its default `/dashboard`. Measured on mobile `/dashboard`:

```
9.  a  Today     → /dashboard
10. a  Practice  → /dashboard     ← identical destination
```

"Practice" also never says what it practises, and on `/courses/french` it becomes
`/courses/french?start=1` — the page you are already on.

**A3. `?course=` is accepted but silently ignored when it doesn't match an internal slug.**
`/dashboard?course=italian` renders French. (`LanguageSwitcher` writes `english-to-italian`, which
*does* work — but the URL parameter accepts unknown values with no feedback, and
`history.pushState` is used with no `popstate` listener, so Back desyncs the URL from the
rendered course.)

**A4. The course workspace tabs aren't addressable.** `study-tabs`
(Course / Review / Vocabulary / Grammar / Dialogues) are plain `<button>`s with
`aria-current="page"`, and the selected view lives only in `useState`. Consequences:
switching to Vocabulary and reloading drops you back on Course; you cannot link to a
view; and `aria-current="page"` is the wrong token on a button that doesn't navigate.

**A5. There is no 404 page.** No `src/app/not-found.tsx`, so Next's default renders:
title `404: This page could not be found.`, body text of five words, no brand, no route home.

**A6. Every sub-page shares one title.** `/you`, `/listen`, `/login`, `/courses/french`,
`/dashboard`, `/learn/*` all report `VerbaLibera · Daily practice path`. Only `/` is unique.
This breaks history, bookmarks, and screen-reader context — "changed page" is unannounceable
when every page claims the same name.

**A7. Two parallel course systems are navigated as if they were one.** Internal hrefs:

```
12  /dashboard
 5  /login
 4  /
 2  /courses/french
 1  /courses/italian
 1  /learn/english-to-french
 1  /you
 1  /listen
```

`initialCourses` slugs are `english-to-<lang>` (legacy `/learn/*` guided sessions); the
foundation packs use bare `<lang>` (`/courses/french`). The dashboard interpolates
`selectedCourse.slug`, which is an `english-to-*` slug — so its links **are** correct
(`/learn/english-to-french/placement`, `/learn/english-to-french/plan` both resolve). An
earlier draft of this review claimed those were hardcoded to French and that the plan link
pointed at a dead route; both claims were wrong. The real defect is narrower:

**A7 (corrected). `/learn/<unknown>` soft-404s instead of 404ing.** `/learn/french`,
`/learn/french/placement` and `/learn/french/plan` are not linked from anywhere, but they
return **HTTP 200** with a five-word stub — *"This course is not available in preview."* —
because the page guards with an inline early return rather than calling `notFound()`. Anything
that ever held a bare-language link (a bookmark, an old commit, a shared URL) lands on a stub
that looks broken but reports success. The axe audit even scored those pages as clean, because
a nearly-empty page has nothing to violate. Fix: `notFound()` in
`/learn/[courseSlug]`, `/learn/[courseSlug]/placement` and `/learn/[courseSlug]/plan`, so the
new branded 404 catches them.

**A8. `?start=1` scrolls into a 3,300px page with the context left behind.** On
`/courses/french?start=1` the browser lands at `scrollY: 1126` — mid-page, below the entire
account panel, the download panel, and the PWA instructions, with no sticky header and no
indication that you've arrived where you intended.

**A9. `WelcomeFlow` is dead code.** `src/components/onboarding/WelcomeFlow.tsx` (123 lines,
unit-tested, `fieldset`/`legend`, `aria-hidden` flags, disabled-until-chosen Continue) is
imported by nothing. `DailyPathDashboard` still renders `FirstRunOnboarding`, which drops new
learners straight onto the course page described in A8. The plan's Task 5 (dashboard
integration) and Task 6 (e2e onboarding spec) were never done; `tests/e2e/onboarding.spec.ts`
does not exist.

**A10. Stray tracked duplicate.** `src/components/nav/QuickNav 2.tsx` is committed as a
two-line re-export shim. It is a macOS copy artifact that was gutted and kept instead of
deleted.

### B. Accessibility — measured results

**B1. Colour contrast: 102 failing nodes across 10 routes.** The only axe violation found,
impact *serious*:

| Element | Foreground | Background | Ratio | Required | Size |
| --- | --- | --- | --- | --- | --- |
| Locked lesson rows in the course path (24 nodes **per course page**) | `#83908b` | `#fffdfa` | **3.27** | 4.5 | 13px / 11px mobile |
| Language switcher label | `#76807c` | `#f4f3ee` | **3.67** | 4.5 | **9.28px** (8.64px mobile) |
| `/you` eyebrow | `#6b7672` | `#f4f3ee` | **4.24** | 4.5 | **9.92px** |

Causes are specific and small:

- `.study-path .study-lessons li.is-locked { opacity: .72 }` composites `--muted` (`#536560`,
  which passes at 5.57:1 on its own) down to 3.27:1. The *entire* locked row is dimmed —
  including the prerequisite explanation that tells a learner what to do to unlock it.
- `--muted-foreground` falls back to `#6b7672`, which fails 4.5:1 on anything but pure white
  (4.71:1 on `#ffffff`, 4.24:1 on the canvas). It is used at 0.58rem and 0.54rem.

Verified replacements that keep the palette's character:

| Token | Current | Proposed | New ratios |
| --- | --- | --- | --- |
| `--muted-foreground` | `#6b7672` | `#586360` | 6.14 on white · 5.61 on canvas |
| locked lesson text | `opacity: .72` | drop opacity, add a "Locked" pill | 5.57 |

**B2. Type below any readable floor.** Nine declarations under 12px, including
`font-size: 0.54rem` (8.64px) for the language switcher label on mobile and 11px for course-path
meta. Nothing in the app enforces a minimum.

**B3. Target-language text is not marked with `lang`.** The landing page uses `lang="fr"`
correctly on phrases. The actual learners — `lesson-player.css` surfaces, `ActivityView`,
`SelectionActivity`, `study.css` lessons — mark nothing. A screen reader reads *«Bonjour»*,
*«Je voudrais»* and *«s'il vous plaît»* with English phonemes. This is cheap to fix and it is
the single most impactful screen-reader fix in the app.

**B4. No route-change announcement.** App Router client navigations are silent to assistive
tech. There is no `aria-live` route announcer anywhere; `usePathname` appears only in
`QuickNav` to compute active-tab state.

**B5. Two `aria-label`s on role-less `div`s** (axe `aria-prohibited-attr`, verified):

```
<div class="…phones" aria-label="Illustration of downloaded foundation lessons">
<div class="…terminal" aria-label="Inside the open-source project">
```

**B6. `Reveal model` stays enabled and does nothing after the model is revealed.** Walked
Lesson 0: after the first press, the button remains in the tab order and clicking it again is a
no-op throughout the step. No `aria-expanded`, no disabled state, no toggle back.

**B7. Arrow glyphs are read aloud.** `← Daily path`, `← VerbaLibera`, `← All audio lessons`
render the bare character. Screen readers announce "leftwards arrow". It should be
`<span aria-hidden="true">←</span>`.

**B8. The existing a11y tests are configured to miss B1.** `tests/a11y-session.test.tsx`:

```ts
const axeRules = {
  'color-contrast': { enabled: false },   // ← the one real violation class
  'landmark-complementary-is-top-level': { enabled: false },
};
```

`tests/a11y-lesson-player.test.tsx` runs axe properly, but only on lesson-player fixtures, which
use `--lp-muted: #536560` (6.09:1) — so it passes. The failing surfaces are the ones no test
touches. Separately, ESLint activates only **6** `jsx-a11y` rules, all as `warn`. There is no
lint gate.

### C. Coldness and AI texture

**C1. The product narrates its own bookkeeping.** 116 matches for
device/account/guest/preview/scope language. On the main learner surface, before a single
French word:

> A little explanation. A worked example. Then make the language your own.
> **0 practice results on this device · 0/25 lessons practised successfully. Device practice is
> separate from account progress.**
> **Guest practice · saved only on this device.**
> Guest and account practice stay separate. To transfer guest history, export its backup,
> select account practice, then import it. Account history remains available on this browser
> for offline use; use a trusted device.
> **Use signed-in account**  **Sign in**

Then the download panel with a four-paragraph PWA install manual, then 24 rows of
**"Locked — complete X to unlock"**, then — at scrollY 1126 — the lesson.

**C2. Storage-layer wording where a verb belongs.** "Use signed-in account". "Not downloaded
yet". "Preview progress". "Session preview coming soon". "Preview lesson · language and
pronunciation review pending."

**C3. SRS jargon.** `review item`, `remains in review`, `assisted practice`, `review history`,
`independent practice`, `review queue`, `proficiency`. A learner sees
**"Assisted practice. This will remain in review."** and **"Study the model. This remains a
review item."** — two sentences about the app's evidence model, zero sentences about French.

**C4. Producer's notes in the consumer's UI.** Every course page footer:
*"Twenty-four original A1 foundation lessons… Machine-authored and consistency-checked;
native-speaker editorial review remains open."* Honest, and correct to state somewhere. Not on
the page where someone is trying to say bonjour.

**C5. `/listen` is 24 rows of "Audio being authored."** Only 5 tracks are registered
(`LISTEN_TRACKS` — one per language). The page lists every lesson in the pack and marks all but
one unavailable. Measured output: one button, then
`Audio being authored` ×24.

**C6. The brand contradicts the product.** The landing page says:

> "No streak anxiety." · "lives." · "countdown." · "fake urgency."
> "Your language app shouldn't be disappointed in you."

`/you` then reports, as its primary content: **Total XP**, **Practice flow**, **Streak**
("No streak yet — finish a session to start one."), **Review queue**. The marketing rejects
gamification the profile is built on. Pick one; the landing page's position is the better one
and it's already the brand.

**C7. Triadic-fragment cadence everywhere.** "A little explanation. A worked example. Then make
the language your own." · "Study with it. Run it yourself. Inspect how it works." ·
"Notice it. Build it. Vary it. Use it." · "Start at the top. Revisit any completed lesson
whenever you need it." Nine clear instances plus constant four-beat headings. It reads as
composed-by-pattern, and it makes genuinely good lines ("Your language app shouldn't be
disappointed in you.") land softer because they're rhythmically identical to the filler
around them.

**C8. `WelcomeFlow`'s copy is the best in the repo and nobody sees it.**
*"What would you like to speak first?"* · *"Pick the pace that fits you. There is no wrong
answer, and you can change it later."* · *"You just said hello in Italian."* That is the voice
the app needs. It exists, it's tested, it's unreachable.

---

## Part 2 — Target design

### 2.1 Three shells, three levels of chrome

The core problem is that every surface carries every panel. Split the app into three shells:

**1. Public shell** — `/`, `/login`. Landing header, marketing.
**2. App shell** — `/dashboard`, `/courses/*` (index), `/listen`, `/you`, `/courses/*/plan`,
`/courses/*/placement`. One consistent header: wordmark → Today, a **Courses** entry, language
switcher, account. Bottom tabs on mobile. **This is the shell desktop is currently missing.**
**3. Lesson shell** — an open lesson (`/courses/{lang}/lesson/{lessonId}`). Nothing but:
   progress bar, one step, the advance control, and a single "Leave lesson" exit.
   No download panel. No account panel. No PWA instructions. No course path.

Level 3 is the fix for both navigation and coldness, and it is mostly deletion.

### 2.2 Navigation model

- **Bottom tabs (mobile): Today · Courses · Listen · You.** Drop "Practice" — it is ambiguous,
  it currently duplicates Today, and its real job ("resume where you were") belongs on the
  Today page as one primary button.
- **Desktop: the same four destinations in a persistent header.** Currently nothing.
- **Courses gets a real index** at `/courses` (it exists as a landing-page anchor only). Today
  is a daily path; Courses is the library. They are different jobs and both need a door.
- **Every view is a URL.** `/courses/french/vocabulary`, `/courses/french/review`,
  `/courses/french/lesson/first-words`. Back, forward, reload, and share all work. Real
  `<Link>`s in a `<nav>`, not buttons with `aria-current="page"`.
- **Register the tablist properly** for the in-page view switcher if you keep it client-side:
  `role="tablist"` + `role="tab"` + `aria-selected` + `role="tabpanel"` + arrow-key handling.
  Do not use `aria-current="page"` on a button.
- **One course slug space.** Retire bare `french`/`italian` as a *route* slug; keep it as the
  catalog key. Route every course surface through one resolver so
  `/courses/french` → foundations and the legacy `/learn/*` sessions either redirect or become
  `/courses/english-to-french`. Fix the hardcoded French placement link. Fix or delete
  `Review your study plan`.
- **Add `not-found.tsx`** with brand, a real explanation, and links to Today and Courses.
- **Unique `<title>` per route** — `French foundations · VerbaLibera`,
  `Audio lessons · VerbaLibera`, `Your profile · VerbaLibera`.

### 2.3 Progressive disclosure of the app's own mechanics

Move each thing once, to the place where it is the answer to a question the learner just asked:

| Content | Now | Move to |
| --- | --- | --- |
| Device vs account practice | Top of every course page, 2 paragraphs | One line in `/you`, one line next to the "Save your progress" action |
| PWA install manual | Inline on every course page | `/courses/{lang}/offline` ("Take it offline"), linked once |
| Export/import backup | Always visible; a raw file input in the tab order | Same offline page, or behind "Manage my practice" |
| "Locked — complete X to unlock" | 24 rows | Keep the dependency, cut the sentence to the lesson title + a lock affordance; the reason appears on the locked row you're on or as a `title`/tooltip |
| Authoring provenance | Every course page footer | About / open-source page |
| "Audio being authored" ×24 | Full list on `/listen` | List only lessons with audio; show "more coming" as one line |

### 2.4 A voice to hold onto

`WelcomeFlow` is the reference. Concretely:

- **Ban on the learner surface:** `account practice`, `guest practice`, `device practice`,
  `preview progress`, `review item`, `remains in review`, `assisted practice`,
  `review history`, `independent practice`, `snapshot`, `scope`, `use signed-in account`.
- **Replacements:** "review item" → *"we'll ask this again on Thursday"*; "assisted practice"
  → *"you used the answer — that's fine, we'll bring it back"*; "Preview progress" → *"Nothing
  saved yet"*; "Save your progress" → *"Keep this on my account"*.
- **Break the triad habit.** Where three or four fragments run in parallel, cut to one. Not
  "Notice it. Build it. Vary it. Use it." but "Notice it, then build it." The method page can
  list all four as a list; the headline doesn't need to recite them.
- **Fix the XP/streak contradiction.** Either make `/you` about what you can *say* (phrases you
  can produce, lessons you can hold a conversation from) or remove the gamification. Do not
  keep both the promise and the meter.

### 2.5 Visual and type system

- `--muted-foreground: #586360` (from `#6b7672`).
- Delete `opacity: .72` on `.is-locked`; express locked state with a hairline border, a lock
  glyph, and `--muted` text that still passes.
- **Type scale with a floor:** body 16–17px, meta 14px, smallest label 12px (0.75rem). Lift
  the language-switcher label from 0.54–0.58rem to 0.75rem, and the course-path meta from
  11–13px to 14px. This costs vertical space and buys legibility, which for a
  beginner-intermediate audience reading an unfamiliar language is the whole product.
- Keep the Liquid Glass material tokens — they are not the problem. The problem is what's
  written on the glass and how small it is.
- Add a `prefers-contrast: more` branch that drops glass fills to opaque surfaces.

---

## Part 3 — Phased plan

Ordered by ratio of pain removed to work done. P0 is one session; P1 is a few; P2 is a
quarter.

### P0 — Stop the bleeding (days, low risk)

| # | Task | Files | Acceptance |
| --- | --- | --- | --- |
| 0.1 | Restore desktop navigation | `bottom-tabs.module.css`, new `components/nav/AppHeader.tsx`, `app/layout.tsx` | Desktop tab walk on `/listen` and `/you` reaches Today, Courses, Listen, You |
| 0.2 | Fix the duplicate tab | `components/nav/QuickNav.tsx` | No two tabs resolve to the same href on a first visit; label "Practice" → "Courses" with `href="/courses"` |
| 0.3 | Create `/courses` index from `CourseShowcase` | new `app/courses/page.tsx` | Reachable from bottom tabs and desktop header; each card lands on its course |
| 0.4 | Fix dead `/learn/*` links | `DailyPathDashboard.tsx` | Placement link uses the selected course; "Review your study plan" points where a plan renders; `hasSelectedSession` fallback never shows "coming soon" to a learner with progress |
| 0.5 | Contrast pass | `language-switcher.module.css`, `you.module.css`, `study.css`, `globals.css` | axe `color-contrast` = 0 nodes on all 10 routes × 2 viewports |
| 0.6 | Type floor | all CSS modules | No `font-size` below 12px/0.75rem; add a test that greps for it |
| 0.7 | `not-found.tsx` + per-route titles | `app/not-found.tsx`, route `metadata` exports | 404 shows brand + two routes; every route has a distinct `<title>` |
| 0.8 | `lang` attributes on target-language text | activities, `LessonPlayer`, `study.css` surfaces, `listen` transcript | Every French/Italian/Spanish/Portuguese/German string sits in a `lang`-marked element |
| 0.9 | Route-change announcer | new `components/nav/RouteAnnouncer.tsx`, `app/layout.tsx` | Client navigation announces the new page name via a polite live region |
| 0.10 | Re-enable `color-contrast` in jest-axe; delete `QuickNav 2.tsx` | `tests/a11y-session.test.tsx` | Test suite fails if contrast regresses |

### P1 — Wire the approachability work, and get the chrome off the lesson (weeks)

| # | Task | Notes |
| --- | --- | --- |
| 1.1 | **Finish the onboarding plan's Task 5** — render `WelcomeFlow` for blank-progress learners | The component and `onboarding-state.ts` are done and tested. This is the fastest route to a warmer first five minutes. |
| 1.2 | **Finish Task 6** — `tests/e2e/onboarding.spec.ts`, mobile + desktop | |
| 1.3 | Split the lesson shell out of `CourseWorkspace` | One step, one control, one exit. Download/account/provenance panels stay in the course shell. Kills A8 and C1 at once. |
| 1.4 | Give the workspace views real routes | `/courses/{lang}/{view}`; convert tabs to `<Link>`s or register a real tablist. Kills A4; Back and reload start working. |
| 1.5 | Move the mechanic copy per §2.3 | Device/account, PWA, backup, provenance, lock reasons |
| 1.6 | Rewrite the meta-labels in the lesson player | `review item` / `assisted practice` / `remains in review` → plain sentences |
| 1.7 | `/listen` lists only what has audio | |
| 1.8 | Resolve the XP/streak contradiction on `/you` | |
| 1.9 | `Reveal model` → real toggle with `aria-expanded` | B6 |
| 1.10 | `aria-hidden` on arrow glyphs; fix the two role-less `aria-label` divs | B5, B7 |
| 1.11 | Wire the route audit into CI | Script already exists: `scripts/a11y/route-audit.mjs`, runnable as `npm run a11y:audit` (needs the dev server on :3100). ~4 min for 20 route/viewport combos; exits 1 on violations. Today it reports 10 routes with violations. |
| 1.12 | Widen the ESLint `jsx-a11y` set (`label-has-associated-control`, `click-events-have-key-events`, `anchor-is-valid`, `no-noninteractive-element-interactions`) to `error` | |

### P2 — Structural (a quarter, needs design time)

| # | Task |
| --- | --- |
| 2.1 | Lesson shell as the default learning surface; course page becomes a library, not a player |
| 2.2 | Full IA pass on the vocabulary: one name per concept across the app (currently "Daily path" / "Today" / "8-minute path" / "session" / "unit" / "foundation" / "first words" / "A1 patterns") |
| 2.3 | `/you` redesigned around what the learner can say; gamification removed or replaced |
| 2.4 | Unify the legacy `/learn/*` guided sessions into the course route space (or formally retire them) |
| 2.5 | `prefers-contrast: more` theme; high-contrast glass fallback |
| 2.6 | VoiceOver/TalkBack pass across the lesson player, placement, and plan — the gap this review could not close |
| 2.7 | Authoring lint for copy: fail the build on banned bookkeeping phrases so the coldness can't creep back |

---

## Part 4 — Guardrails

Without these, this regresses in a month, because the current tests were configured to look
away:

1. **Re-enable `color-contrast` in jest-axe.** It was disabled; that is why 102 nodes shipped.
2. **Route-level axe in CI**, both viewports, including `/courses/*` and `/you` — the two
   surfaces no existing a11y test renders.
3. **A type-scale test** — parse CSS modules, fail on any `font-size` below the floor.
4. **An IA test** — every `<Link>` href resolves to a route that exists. This alone would have
   caught `/learn/french/plan` and the hardcoded French placement link.
5. **A copy lint** with the banned-phrase list from §2.4.
6. **A desktop navigation assertion** — every route at 1280px exposes the four primary
   destinations in the tab order.

---

## Open questions for you

1. **Gamification:** kill XP/streak, or reframe it? The landing page's position is "no streak
   anxiety" — I'd follow it, but that's a product call.
2. **Legacy `/learn/*` sessions:** fold into the course routes, or retire? They currently cause
   three dead links and a permanent "coming soon".
3. **Language switcher vs. a real Courses page:** if Courses becomes a first-class destination,
   the switcher may become redundant. Keep both, or drop the switcher?
4. **Scope of this pass:** P0 only, P0+P1, or the whole thing? P0 is safe to land today and
   removes the worst navigation failures.
