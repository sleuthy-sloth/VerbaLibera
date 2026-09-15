# CEFR coverage

VerbaLibera claims a CEFR level only when the coverage below proves it. Two
separate bodies of content exist and their numbers are never added together:

- **Foundation packs** (`courses/<language>/manifest.json`, served from `/courses/*`)
  — the structured courses. Counted by `scripts/content.ts` and published per
  course to `docs/astra/reports/<language>.json`; read the JSON, not this file,
  for current numbers.
- **Travel fixture** (`src/features/curriculum/fixture.ts`, served from `/learn/*`)
  — the older pattern demonstrations. Counted by `cefrCoverage()` in
  `src/features/curriculum/cefr.ts` and pinned by `tests/cefr-spine.test.ts`.

## Foundation packs (generated 2026-09-13)

Every foundation course is a **partial A1 syllabus**. Lesson count is capacity,
not CEFR evidence, and no complete A1 level is claimed for any language. The
`level` block in each generated report says so in as many words. For which lesson
teaches which objective, what it retrieves and what is missing, see the generated
`docs/curriculum-matrix.md` (`npm run content:outcomes -- --write`).

| Course | Schema | Lessons | Practice activities | Notice steps | Target-language production | Speaking steps | Lessons with model audio | Authored CEFR tags |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| French | v2 | 26 | 232 | 26 | 125 | 0 | 26/26 | none on the pack |
| Italian | v2 | 26 | 243 | 27 | 129 | 24 | 26/26 | none on the pack |
| German | v2 | 10 | 62 | 10 | 36 | 0 | 1/10 | A1 × 10 lessons |
| Portuguese | v2 | 8 | 48 | 8 | 28 | 0 | 1/8 | A1 × 8 lessons |
| Spanish | v2 | 8 | 49 | 8 | 28 | 0 | 1/8 | A1 × 8 lessons |

Totals: 78 lessons, 634 practice activities, 24 speaking steps.

Four findings this table makes visible:

1. **The v2 schema carries the authored `cefr` tag now, and the migration keeps it.** The tag
   exists on the v1 lesson and, since the fix, as an optional field on the v2 lesson too;
   `migratePackV1ToV2()` re-attaches it from the authored source. Nothing in the product reads it (no
   source file consumes `lesson.cefr` from a pack; the dashboard's level vocabulary comes from the
   curriculum fixture), so this is a reporting and documentation claim rather than a learner-facing
   one — German kept all 8 of its tags through the 2B flip, which is what the column now shows.
   French and Italian were flipped before the field existed and report "none"; re-running their
   migration from the v1 source would restore the tags that source carries, and that is the user's
   call, recorded in `tests/pack-migration-cefr.test.ts` rather than done quietly.
2. **Speaking is Italian-only** — 24 of the 634 practice activities. German, Portuguese and Spanish
   have no self-assessed exercise kind at all, and all three joined the v2 player with the
   migrations, so for them this is an authoring gap rather than a missing capability. French and
   Spanish *could* carry speaking steps too, but none are authored. Italian's came from the
   authored café lesson onwards: every lesson past the first two carries one.
3. **Audio coverage is French/Italian-only.** German, Portuguese and Spanish carry model audio in
   one lesson — one of ten for German, one of eight for the other two. The café lessons added the
   two Italian clips and the French model recording, which is why the other counts moved with them.
4. **Families are authored only where the pack was.** The migrated packs report one family for every
   lesson (`discovery`), because the v1 schema had no such field and the adapter assigns one default;
   French now carries one `conversation` lesson because the café lesson was authored in v2 rather
   than migrated. Italian's mix (22 discovery, 1 story, 2 conversation, 1 listening) is the shape
   the others are moving toward.

## Travel fixture (unchanged since 2026-09-03)

| Level | Concepts | Drills | Notes |
|-------|----------|--------|-------|
| A1 | 32 | 128 | 4 courses × 8 travel patterns, 64 audio segments, every one backed by a real clip |
| B1 | 0 | 2 | CLOZE stretch drills on 2 French patterns (passé composé, futur simple) |
| B2 | 0 | 0 | Roadmap Phase 5 |
| C1/C2 | 0 | 0 | Fog — specified after B2 lands |

This fixture is demonstration material for the travel situations the
foundation courses later teach properly. Its 32 concepts are **not** part of any
foundation course's coverage, and its A1 tag describes the pattern, not a
completed syllabus.

## Level definitions in use

- **A1** — Formulaic travel survival: greet, order, locate, pay, ask help. Present tense, memorized chunks, single-clause sentences.
- **A2** — Everyday routine past/future narration (passé composé, futur proche), simple connectors (et, mais, parce que), larger service domains.
- **B1** — Independent use: full past system, conditional politeness, pronouns (y/en), opinions with connectors, unpredictable everyday situations (work, health, housing).
- **B2** — Fluent interaction: subjunctive essentials, passive, reported speech, register shifts, argumentation, domain depth (news, meetings, culture).
- **C1/C2** — Idiom, nuance, stylistic control, extended discourse. Auto-assessment of open C2 production is out of scope by design (human judgment required).

## B1 checklist (per language, Phase 3 target)

- [ ] Past system: passé composé / passato prossimo / pretérito / pretérito perfeito contrasted with imperfect
- [ ] Future + conditional politeness (je voudrais / vorrei / me gustaría)
- [ ] Pronouns: direct/indirect, y/en, ci/ne, reflexive routines
- [ ] Connectors: cause, concession, sequence (parce que, aunque, sebbene…)
- [ ] Domains: work, health, housing, bureaucracy, travel problems
- [ ] ~40 patterns with drills + audio + provenance each

## Review status

- **Native-speaker review: reviewed for Spanish, part-reviewed for German, pending
  elsewhere.** The authored Spanish prose was reported reviewed on 2026-09-11, as was
  German's first eight lessons. The record lives beside each manifest
  (`courses/german/review.json`, `courses/spanish/review.json`) so the generated reports
  quote it: `review.nativeSpeaker` reads `"reviewed"` for Spanish, `"partial"` for German —
  lessons 9 and 10 (the weather, free time) were authored after that review and are named
  as pending — and `"pending"` for French, Italian and Portuguese. Corrections are tracked
  through the content-correction issue template.
- **Audio listening review: pending for every course**, including the two whose prose
  is now reviewed — the written course was read, not the recordings.
  `npm run content:audio-check` proves
  hashes and integrity, not that a clip sounds right. `docs/audio-provenance/`
  records what was generated; the human listening checklist has not been run.

## Rules

1. A drill may carry a higher tag than its concept (stretch drills, e.g. B1 CLOZE on an A1 pattern) — the tag describes the drill's demand, not the pattern's.
2. New levels land behind the same gates as everything else: fixture lint, STT screen, human listen checklist, provenance.
3. Dashboard copy reports counts ("12 B1 drills"), never badges ("B1 certified") — mastery claims stay with passed assessments.
4. Update the counts in this file only from a fresh `npm run content:build`, and
   never by adding a foundation count to a travel-fixture count.
