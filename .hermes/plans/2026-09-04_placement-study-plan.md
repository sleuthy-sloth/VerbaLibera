# Placement + Study Plan Spec (VerbaLibera)

> **For Hermes:** implement in slices — Slice 1 (placement quiz) first, then Slice 2 (plan generator), then Slice 3 (composer + dashboard integration). TDD each slice. This spec is the source of truth; the B2–C2 roadmap's Phase 3+ consumes it.

**Goal:** Learners who don't start at zero take a short placement quiz, get a starting CEFR + concept, set a pace, and receive a week-by-week lesson plan to a target level. The daily session reads the plan instead of the fixed demo slice.

---

## Slice 1 — Placement quiz

**Shape:** 15 fixed items (not adaptive — simpler, fully testable, honest), 5 per band:
- Items 1–5 (A1): greet, order, locate, pay, ask-help — recognition + one production
- Items 6–10 (A2): passé composé / passato prossimo equivalent, futur proche, pronouns, connectors, routine narration
- Items 11–15 (B1): conditional politeness, imperfect-vs-perfect choice, pronoun placement, opinion + connector, multi-clause repair

**Item format:** reuse existing drill kinds where possible (`PICTURE_CHOICE`, `SUBSTITUTION`, `CLOZE`, choice-based `DIALOGUE_REPAIR`-style). Every item is auto-checkable by the current judge (exact/normalized match or choice key). No free production in placement — it must grade itself without a tutor.

**Scoring bands (correct / 15):**
- 0–5 → A1, start at concept 1 of the course
- 6–10 → A2, start at the A2 entry concept (first concept tagged ≥ A2; until A2 content exists, start at concept 1 with B1 stretch unlocked — honest fallback, stated in UI)
- 11–13 → B1, start at first B1-tagged drill set
- 14–15 → B1+ (flag "above current content", invite to B2 waitlist note — no fake B2 claim)

**Learner confirmation:** result screen shows band + proposed start, with "Start here" / "Start from zero" / "Retake". Stored guest-local (`localStorage`, key `verbalibera_placement`) + persisted to `PlacementResult` table when signed in.

**Files:**
- Create: `src/features/placement/items.ts` (15 item definitions per language — French first, other languages follow the same template), `src/features/placement/score.ts` (pure `scorePlacement(answers) → { band, startCefr, startConceptId }`), `src/components/placement/PlacementQuiz.tsx` + `PlacementResult.tsx`, `tests/placement-score.test.ts`, `tests/PlacementQuiz.test.tsx`
- Modify: `prisma/schema.prisma` (+ `PlacementResult` model + migration: id, userId, courseSlug, score, band, startCefr, createdAt), `src/app/learn/[courseSlug]/placement/page.tsx` (new route)
- Verify: `npm run test -- tests/placement-score.test.ts` (band boundaries 5/6, 10/11, 13/14 edge cases), e2e placement walk

## Slice 2 — Plan generator (pure function + storage)

**Input:** `{ courseSlug, startCefr, startConceptId, daysPerWeek (1–7), minutesPerDay (5/8/15), targetLevel (A2/B1/B2), startDate }`

**Output `StudyPlan`:** ordered weeks; each week has `weekIndex`, `startsOn`, `items[]` where an item is `{ conceptId, mode: 'teach' | 'drill' | 'review' }`. Rules:
- Concepts ordered by course position, filtered to `position >= startConcept position`
- Ratios shift by level: A1 weeks = 40/40/20 teach/drill/review; A2 = 30/40/30; B1+ = 20/40/40
- `daysPerWeek × minutesPerDay` sets items-per-week budget (8-min session ≈ 8 items; scale linearly, cap 14)
- Reviews recycle earlier concepts (spaced: prior-week concepts reappear as `review` items)
- Target level gates on content: plan only schedules concepts that exist; trailing weeks beyond coverage are marked `unscheduled` (honest "content frontier", never filler)

**Types:** `src/features/study-plan/types.ts` (`StudyPlan`, `PlanWeek`, `PlanItem`, `PaceInput`), `src/features/study-plan/generate.ts` (pure `generatePlan(input, concepts) → StudyPlan`), `tests/study-plan-generate.test.ts` (frozen dates; asserts ratios, budget caps, frontier marking, idempotence)

**Storage:** `StudyPlan` table (id, userId, courseSlug, targetLevel, daysPerWeek, minutesPerDay, startDate, planJson, createdAt) + migration; guest-local mirror in `localStorage` (`verbalibera_plan:<courseSlug>`).

**UI:** `src/components/plan/PlanBuilder.tsx` (pace picker + target picker + week preview) at `/learn/[courseSlug]/plan`; `PlanOverview.tsx` (week X of Y, per-week checklist, frontier notice).

## Slice 3 — Composer + dashboard integration

**Composer change:** `composeDailySession` gains optional `planItems` input — when present, steps derive from today's plan items (teach → NEW_PATTERN, drill → DRILL rounds, review → REVIEW) instead of the fixed demo slice. Demo fallback unchanged when no plan exists (all current tests keep passing).

**Dashboard:** `DailyPathDashboard` shows plan status when present — "Week 3 of 12 · B1 track", today's items, streak; otherwise current demo content. Copy via `src/lib/progress/copy.ts` (no hardcoded strings).

**Progress binding:** completing a plan item records against it (signed-in: `UserProgress` + plan position pointer; preview: localStorage checklist). Skipped days push the schedule (plan is position-based, not date-punitive — consistency without guilt).

**Files:**
- Modify: `src/features/session/compose-session.ts`, `src/components/dashboard/*`, `src/lib/progress/copy.ts`, `src/lib/progress/snapshot.ts`
- Test: `tests/compose-plan.test.ts`, dashboard plan-state tests, e2e plan → session walk
- Verify: full `npm run test`, `npm run test:e2e`, `npm run build`

## Borrowed from LibreLingo (explicit)

LibreLingo itself has **no** placement test or week plans (verified by cloning `LibreLingoCommunity/LibreLingo` and searching for placement/assessment/week-plan — the repo is a Duolingo-style skill tree: modules → skills → words/phrases → auto-generated challenges). Borrowed instead:
- Skill-tree *spirit*: plan weeks unlock sequentially; no skipping ahead without completing (position pointer).
- Challenge-loop *spirit*: each teach item is followed by its drill + review in the same week (notice → build → vary → use, now scheduled).
- YAML-authoring *spirit*: placement items and plan rules are data + pure functions, so contributors extend levels without touching UI code.

## Deliberately NOT borrowed

- No locked skill tree UI (plan is a checklist, not a game map — matches Quiet Ink restraint).
- No hearts/streak-punishment mechanics (position-based schedule; missed days shift, never shame).
- No auto-generated challenges from word lists (every item is authored + provenance-tracked per VerbaLibera content rules).

## Open questions (answer before Slice 2 build)

1. A2 entry concepts don't exist yet (all content is A1 + 2 B1 drills) — Slice 1 ships with the honest fallback (start at concept 1, B1 stretch unlocked). Acceptable?
2. Should guests get full plans locally, or is the plan a sign-in nudge? Recommendation: full local plans (free-app promise), sync on sign-in.
3. Minutes/day options: 5/8/15 or freeform? Recommendation: fixed 3 options (keeps budget math testable).
