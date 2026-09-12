# German in the dashboard's course universe

Status: **implemented** 2026-09-11. Written from the roadmap's "stage 4" list, where this
was recorded as "found, not fixed": German has a pack, a course page and a catalogue entry,
but it never appears in the dashboard's language switcher or the welcome flow, and
`/courses` plus a direct URL are its only entry points.

The three steps below are what shipped, in that order, with one addition the plan did not
anticipate: the generated catalogue now carries each course's opening unit and the level its
own lessons claim, because the Today card and the switcher need both and neither could be
invented from a lesson count. What the plan predicted about the *read* migration held
exactly — no learner is asked to choose a language again — and that is the case the tests
pin. See the run record for the evidence.

## What is actually wrong

Two course identity systems are in use, and the dashboard is on the older one.

| | dashboard / onboarding | packs, banners, catalogue |
| --- | --- | --- |
| source | `initialCourses` in `src/features/curriculum/fixture.ts` (the travel fixture) | `src/features/course-pack/catalog.json`, generated from `courses/*/manifest.json` |
| slugs | `english-to-french`, `english-to-italian`, `english-to-spanish`, `english-to-portuguese` | `french`, `german`, `italian`, `portuguese`, `spanish` |
| courses | 4 | **5** |

`demo-progress.ts` builds `progress.courses` from `initialCourses`
(`deriveCourses()` and `deriveBlankCourses()`), and everything downstream reads that list:
the dashboard's `LanguageSwitcher` (its default `courses` prop is `initialCourses`), the
welcome flow's language step, the "which course is active" resolution, and
`readOnboardingOutcome`, which **validates a stored `courseSlug` against the fixture's
course list** and treats an unknown one as stale.

German is in the second column only, so there is nothing for the first column to show. The
banners are already keyed the second way (`bannerFor("german")` works, and
`tests/course-banners.test.ts` holds a catalogued course to a banner), which is evidence
that the pack slug is the identity worth keeping.

## Why this is not a list append

Adding `german` to `initialCourses` would need German travel-style patterns, which do not
exist and must not be invented. Making the dashboard read the catalogue instead is the
right change, but it moves the *stored* course identity:

- `localStorage["verbalibera_course"]` holds an `english-to-*` slug today.
- The onboarding record (`verbalibera_onboarding:v1`) holds `courseSlug`, and an unknown
  value is deliberately treated as **invalid** (`readOnboardingOutcome`) so a learner is
  asked again rather than silently dropped into the wrong course. A slug change without a
  migration therefore makes every existing learner re-answer the language step — the exact
  behaviour that test exists to prevent, applied to everyone.
- Course links (`foundationStartHref`), the switcher's `onChange`, and the e2e specs that
  seed `english-to-french` all move with it.

## The change, in three steps that can each ship alone

**Step 1 — one identity map, no behaviour change.** Add
`src/features/course-pack/course-identity.ts` exporting the catalogue's course list
(slug + title) and a `packSlugFor(storedSlug)` mapping (`english-to-french → french`, and
the identity for a value that is already a pack slug). Nothing reads it yet except a new
test that asserts the two id systems agree for all five courses. This is the step that
turns "two systems" from a comment into a checked fact.

**Step 2 — the dashboard reads the catalogue.** `demo-progress.ts` builds `progress.courses`
from the catalogue (5 entries) and resolves the active course through `packSlugFor`, so a
stored `english-to-french` still lands on `french`. The switcher's default becomes the
catalogue list; German appears with its real title ("German foundations") and its real
lesson count. Tests: `DailyPathDashboard.test.tsx`, `LanguageSwitcher` cases, and
`readOnboardingOutcome` gaining a case for "a stored slug from the old system resolves
instead of being called stale".

**Step 3 — write the pack slug, keep reading the old one.** New writes store `french`;
reads still accept `english-to-french` for one release, and a record of how many learners
were on the old value is not available, so the alias stays until it is cheap to remove.
The e2e specs seed whichever value the step they exercise is about, so both paths keep
coverage.

## What could regress, and the test that would catch it

- **A learner is asked to choose a language again.** `readOnboardingOutcome`'s "unreadable
  saved choice is explained rather than silently re-asked" case in
  `tests/e2e/onboarding.spec.ts`, plus a new unit case for the old-slug alias.
- **The dashboard shows four courses and a fifth page exists.** A new assertion that
  `progress.courses` and `catalog.json` name the same set — the failure this whole plan
  exists to fix, and the cheapest one to keep fixed.
- **The welcome flow offers a course with no authored assessment.** Already handled:
  `onboarding.spec.ts` proves a language without an assessment gets a preview, never a quiz.
  German has no assessment, so this case starts covering a real course instead of a
  hypothetical one.
- **A course page and the dashboard disagree about a course's name.** `catalog.json` is
  generated from the manifests, so the dashboard should read it rather than carry titles.

## What is not in scope

- Authoring German travel-style patterns, or any German content. The pack is what it is.
- The other four courses' identity in `initialCourses`: the fixture keeps its travel
  patterns for the drill content they define. Only the *course universe* moves.
- The German audio and review gates, which are human work (`docs/human-review-gates.md`).
