# Phase 4A implementation plan — the outcome matrix, and the gaps it names

Date: 2026-09-13. Source: `docs/superpowers/plans/2026-09-10-development-roadmap.md` §8
("Define the syllabus and editorial queue"). Branch: `phase-4a-outcome-matrix`.
Scope: bullets 1 and 2 of §4A — the matrix, and the audit it makes possible. The
native-speaker routing (bullet 3) and every review row stay human and are untouched.

## Findings from the current source (before changing anything)

1. **The one coverage document is hand-written and already wrong.** `docs/cefr-coverage.md`
   is stamped "generated 2026-09-10" and reports French at 25 lessons / 222 practice
   activities and Italian at 25 / 233. The packs hold 26 / 232 and 26 / 243: the café
   lessons landed after that table was written and nothing regenerates it. A hand-kept
   table that the packs outgrew is the failure mode §4A exists to prevent.
2. **The generated reports are course-level and cannot answer the question.** 
   `buildContentReport()` (`scripts/content/report.ts`) counts lessons, activities,
   production, speaking, listening, retrieval links, prerequisite depth and review state.
   There is no per-lesson row anywhere, so "which lesson teaches which objective, from what
   prerequisites, and what does it bring back" is not answerable from a generated artifact —
   only by reading 26 lessons by hand, per language.
3. **Everything the matrix needs is already authored in the pack.** Per lesson: `objective`
   (prose), `unitId`, `family`, `estimatedMinutes`, `prerequisites`, `conceptIds`,
   `vocabulary`, `steps[].purpose`, `legacyExercises[].reviewOf`; per activity: `kind` and
   `skills`. The matrix is a projection of the packs, not new authoring, which is what makes
   it cheap and what makes drift detectable.
4. **Introduced-versus-retrieved vocabulary is derivable and currently derived nowhere.** The
   first lesson in curriculum order that references a word introduces it; later references
   retrieve it. That distinction is the one §4A asks for ("introduced/retrieved vocabulary")
   and it is exactly the property a hand-written table gets wrong first.
5. **Review state already has a home.** `courses/<language>/review.json` is read by
   `readProseReview()`; the gate prose lives in `docs/human-review-gates.md`. The matrix must
   surface the recorded state per course and must not restate or soften the gates.
6. **The correction trail §4A asks for does not exist.** No issue template, no record keyed
   by content version, reviewer, affected activity ids and revalidation status.

## The slice

One derived document and the command that writes it.

| Piece | Contract |
| --- | --- |
| `scripts/content/outcomes.ts` | `buildOutcomeMatrix(packs, reviews): OutcomeMatrix` — pure and deterministic: no clock, no filesystem, no network. Per language: course facts, one row per lesson, and the gaps. |
| `renderOutcomeMatrix(matrix): string` | The markdown the document holds. Same input, same bytes. |
| `scripts/content.ts` | A new `outcomes` command: prints the matrix to stdout, and with `--write` writes `docs/curriculum-matrix.md`. |
| `package.json` | `content:outcomes`. |
| `tests/curriculum-matrix.test.ts` | Pins determinism, that the checked-in document matches the builder, and that the gap list is not vacuous. |

**Row contract.** unit, lesson id and title, family, the authored objective verbatim,
estimated minutes, prerequisites, words introduced, words retrieved, concepts, the four
practice modes present (recognition / production / listening / speaking), retrieval links to
earlier lessons, and the lesson's review state.

**Gap contract.** Per language, mechanically derived and named, never inferred: skills no
lesson carries; lessons with no production practice; lessons with no listening practice;
units whose objectives are never retrieved by a later lesson. The matrix names the gap; it
does not rank it. Deciding which gaps matter is the editorial half of §4A and is left open
on purpose.

## Regression fixtures

- The real packs. No synthetic stub: the point of the document is that its numbers are the
  shipped courses' numbers, and a fixture would let both drift together.
- Determinism is pinned by building the matrix twice from the same input and comparing bytes.
- Non-vacuity is pinned by asserting a known gap is present (German's listening coverage) and
  a known row count per language — otherwise an empty gap list would read as "no gaps".
- `docs/curriculum-matrix.md` is compared against `renderOutcomeMatrix` exactly, so the file
  cannot be edited by hand into disagreeing with the packs.

## Acceptance commands

- `npm run content:outcomes -- --write`
- `npx vitest run tests/curriculum-matrix.test.ts`
- `npm test`
- `npx tsc --noEmit`
- `npm run content:validate`

## Rollback

Additive: one new module, one command, one generated document, one test, one issue template.
Nothing imports the new module at runtime; deleting the command and the document restores
today's state with no migration.

## Explicitly pending, and deliberately not in this slice

- **The editorial half of the audit**: which missing objectives to author, and in what order.
  The matrix makes the question answerable; it cannot answer it.
- **Native-speaker routing** for the first three lessons per language (§4A bullet 3) and every
  row in `docs/human-review-gates.md`.
- **Placing the matrix in the app.** It is an authoring document, not learner-facing.
- **Regenerating `docs/cefr-coverage.md` into the same pipeline.** Its course-level table is
  superseded by the matrix's; the stale numbers are corrected in this slice, and folding it
  into the generator is a follow-up worth its own change.
