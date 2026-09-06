# Foundation-Aware Placement Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Placement results recommend a specific foundation-pack lesson (from the 24-lesson Italian/French courses) instead of only travel-course concepts.

**Architecture:** Extend the deterministic scorer with a per-course band→lesson entry table; surface the recommendation in the quiz result UI next to the existing travel link. No schema migration, no LLM, no new runtime dependency — data table + result field + UI.

**Tech Stack:** TypeScript, Next.js App Router, zod, vitest, Playwright.

**Current context / assumptions:**
- `src/features/placement/score.ts` `scorePlacement()` returns `PlacementResult` with `startConceptId` pointing at travel-course concepts (`initialCourses` in `src/features/curriculum/fixture.ts`).
- `src/features/placement/items.ts` holds 15 fixed items per language (5 A1 / 5 A2 / 5 B1), bands scored 0–5 / 6–10 / 11–13 / 14–15.
- Result UI in `src/components/placement/PlacementQuiz.tsx:150-151` links to `/learn/<slug>?concept=` and `/learn/<slug>/plan`. Foundation workspace lives at `/courses/<language>` (`italian`, `french` slugs, see `src/app/courses/[language]/page.tsx`).
- Stored results validated by `src/features/placement/parse.ts` (zod); API at `src/app/api/placement/route.ts` (GET/POST/DELETE, account-scoped).
- Foundation lesson ids look like `it-identity-foundation`, `fr-market-foundation` (see `courses/*/manifest.json`); each language has 24 lessons across 6 units.
- Invariants: deterministic grading only; guests work fully offline in-browser; account results sync via existing API; serial Playwright on dev (`--workers=1`); account e2e only against disposable DB.

---

### Task 1: Add entry-lesson table module

**Objective:** Single source mapping placement bands to foundation lesson ids per language.

**Files:**
- Create: `src/features/placement/foundation-entry.ts`
- Test: `tests/placement-foundation-entry.test.ts`

**Step 1: Write failing test**

```ts
import { describe, expect, it } from 'vitest';
import { foundationEntryLesson } from '@/features/placement/foundation-entry';

describe('foundation entry', () => {
  it('maps every A1 item id to a real Italian lesson', () => {
    expect(foundationEntryLesson('english-to-italian', 'A1', 'it-place-1')).toBe('it-identity-foundation');
  });
  it('returns null for courses without foundation packs', () => {
    expect(foundationEntryLesson('english-to-spanish', 'A1', 'es-place-1')).toBeNull();
  });
});
```

**Step 2: Run test to verify failure**

Run: `npx vitest run tests/placement-foundation-entry.test.ts`
Expected: FAIL — "Cannot find module"

**Step 3: Write minimal implementation**

Create `src/features/placement/foundation-entry.ts`:

```ts
import type { PlacementBand } from './items';

const ENTRY: Record<string, { items: Record<string, string>; A2: string; B1: string }> = {
  'english-to-italian': {
    items: {
      'it-place-1': 'it-identity-foundation',
      'it-place-2': 'it-requests-foundation',
      'it-place-3': 'it-transport-foundation',
      'it-place-4': 'it-market-foundation',
      'it-place-5': 'it-requests-foundation',
    },
    A2: 'it-routine-foundation',
    B1: 'it-days-foundation',
  },
  'english-to-french': {
    items: {
      'fr-place-1': 'fr-identity-foundation',
      'fr-place-2': 'fr-requests-foundation',
      'fr-place-3': 'fr-transport-foundation',
      'fr-place-4': 'fr-market-foundation',
      'fr-place-5': 'fr-requests-foundation',
    },
    A2: 'fr-routine-foundation',
    B1: 'fr-days-foundation',
  },
};

export function foundationEntryLesson(courseSlug: string, band: 'A1' | 'A2' | 'B1', itemId?: string): string | null {
  const entry = ENTRY[courseSlug];
  if (!entry) return null;
  if (band === 'A1') return (itemId && entry.items[itemId]) ?? Object.values(entry.items)[0]!;
  return entry[band];
}
```

NOTE to implementer: verify every lesson id above exists in `courses/italian/manifest.json` and `courses/french/manifest.json` before finalizing (e.g. `python3 -c` check); substitute the closest real id if any name drifted. Suggested anchors if drifted: A2 → first lesson of Unit 3, B1 → first lesson of Unit 5.

**Step 4: Run test to verify pass**

Run: `npx vitest run tests/placement-foundation-entry.test.ts`
Expected: PASS (2 passed)

**Step 5: Commit**

```bash
git add src/features/placement/foundation-entry.ts tests/placement-foundation-entry.test.ts
git commit -m "feat: foundation lesson entry table for placement bands"
```

---

### Task 2: Extend scorer result with foundation lesson

**Objective:** `scorePlacement()` returns `foundationLessonId` alongside the travel recommendation.

**Files:**
- Modify: `src/features/placement/score.ts:5-15` (PlacementResult type), `:45-71` (scorePlacement)
- Test: `tests/placement-score.test.ts`

**Step 1: Write failing test** (append to existing file):

```ts
it('recommends a foundation lesson for an A1 Italian learner', () => {
  const answers = Object.fromEntries(italianPlacementItems.map(i => [i.id, 'wrong']));
  const result = scorePlacement(italianPlacementItems, answers, 'english-to-italian');
  expect(result.foundationLessonId).toBe('it-identity-foundation');
});
```

**Step 2:** Run `npx vitest run tests/placement-score.test.ts` — Expected: FAIL (`foundationLessonId` undefined).

**Step 3: Implement** — add `foundationLessonId: string | null` to `PlacementResult`; in `scorePlacement`, after computing `band` and `firstGap`:
- band A1 → `foundationEntryLesson(courseSlug, 'A1', firstGap?.id)`
- band A2 → `foundationEntryLesson(courseSlug, 'A2')`
- band B1/B1+ → `foundationEntryLesson(courseSlug, 'B1')` (B1+ keeps `aboveContent: true`)

**Step 4:** Re-run — Expected: PASS.

**Step 5: Commit** (`fix:` or `feat:` prefix).

---

### Task 3: Accept the new field in stored results

**Objective:** zod parser tolerates `foundationLessonId` so synced results round-trip.

**Files:**
- Modify: `src/features/placement/parse.ts`
- Test: `tests/placement-api.test.ts`

**Step 1:** Add test posting a result with `foundationLessonId: 'it-identity-foundation'`, expect 200 and echo.
**Step 2:** Run — FAIL (strict schema strips or rejects; check current behavior first).
**Step 3:** Add `foundationLessonId: z.string().min(1).max(80).nullish()` to the schema.
**Step 4:** Re-run — PASS. **Step 5:** Commit.

---

### Task 4: Show foundation recommendation in quiz result UI

**Objective:** Result panel links to the recommended foundation lesson.

**Files:**
- Modify: `src/components/placement/PlacementQuiz.tsx` (result block near lines 150-151)
- Test: `tests/PlacementQuiz.test.tsx`

**Step 1:** Extend the result test: mock result with `foundationLessonId: 'it-identity-foundation'`, expect a link with href `/courses/italian` and text naming the lesson.
**Step 2:** Run — FAIL (no such link).
**Step 3:** Implement — in the result block, when `result.foundationLessonId`, render:
  `<Link href={/courses/${language}}>Start at {lessonTitle} →</Link>`
  where `language` derives from courseSlug (`english-to-italian` → `italian`) and `lessonTitle` comes from a small `FOUNDATION_TITLES` map or the existing pack manifest import. Keep the travel links untouched. If course has no foundation pack, render nothing new.
**Step 4:** Re-run — PASS. **Step 5:** Commit.

OPEN QUESTION (resolve during Task 4): can `/courses/[language]` deep-link to a lesson via query param (e.g. `?lesson=`)? Inspect `src/app/courses/[language]/page.tsx` — if trivial (read searchParams, pass initialLessonId), do it; if it requires workspace state surgery, link to the course index and name the lesson in copy. Do NOT refactor CourseWorkspace state management for this.

---

### Task 5: Full verification

**Objective:** Prove nothing regressed and the feature works end to end.

**Files:** none (verification only).

- Run: `npx vitest run` — Expected: all files pass (currently 68 files / 474 tests; count grows by new tests).
- Run: `npx tsc -p tsconfig.json` — Expected: clean.
- Run: `npx eslint` on touched files — Expected: clean.
- Run: `npm run build` — Expected: pass.
- Run serial e2e on dev: `E2E_BASE_URL=http://localhost:3102 npx playwright test tests/e2e/placement.spec.ts --workers=1` — Expected: pass. If the spec needs a foundation assertion, extend it (meet-step precedent: assert the new link href).
- Commit any test-only fallout separately.

---

## Risks, tradeoffs, open questions

- **Lesson-id drift:** entry table hardcodes lesson ids; a future unit rename orphans recommendations. Mitigation: Task 1 test asserts every mapped id exists in the manifests (add that assertion — cheap and catches drift at authoring time).
- **Scope discipline:** placement must NOT become adaptive/branching (that path leads to runtime smarts). Fixed 15 items + fixed table preserves determinism.
- **Spanish/Portuguese:** return null (no foundation packs) — quiz UI unchanged for those languages. No new-language work per plan guidance.
- **Deep-link question** (Task 4) decides index-link vs lesson-link; default to index-link if any friction.
