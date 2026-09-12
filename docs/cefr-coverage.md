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

## Foundation packs (generated 2026-09-10)

Every foundation course is a **partial A1 syllabus**. Lesson count is capacity,
not CEFR evidence, and no complete A1 level is claimed for any language. The
`level` block in each generated report says so in as many words.

| Course | Schema | Lessons | Practice activities | Notice steps | Target-language production | Speaking steps | Lessons with model audio | Authored CEFR tags |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| French | v2 | 25 | 222 | 25 | 119 | 0 | 25/25 | none on the pack |
| Italian | v2 | 25 | 233 | 26 | 123 | 23 | 25/25 | none on the pack |
| German | v2 | 8 | 48 | 8 | 28 | 0 | 1/8 | A1 × 8 lessons |
| Portuguese | v2 | 8 | 48 | 8 | 28 | 0 | 1/8 | A1 × 8 lessons |
| Spanish | v2 | 8 | 49 | 8 | 28 | 0 | 1/8 | A1 × 8 lessons |

Totals: 74 lessons, 600 practice activities, 23 speaking steps.

Four findings this table makes visible:

1. **The v2 schema carries the authored `cefr` tag now, and the migration keeps it.** The tag
   exists on the v1 lesson and, since the fix, as an optional field on the v2 lesson too;
   `migratePackV1ToV2()` re-attaches it from the authored source. Nothing in the product reads it (no
   source file consumes `lesson.cefr` from a pack; the dashboard's level vocabulary comes from the
   curriculum fixture), so this is a reporting and documentation claim rather than a learner-facing
   one — German kept all 8 of its tags through the 2B flip, which is what the column now shows.
   French and Italian were flipped before the field existed and report "none"; re-running their
   migration from the v1 source would restore 25 tags each, and that is the user's call, recorded
   in `tests/pack-migration-cefr.test.ts` rather than done quietly.
2. **Speaking is Italian-only** — 23 of the 600 practice activities. German, Portuguese and Spanish
   have no self-assessed exercise kind at all, and all three joined the v2 player with the
   migrations, so for them this is an authoring gap rather than a missing capability. French and
   Spanish *could* carry speaking steps too, but none are authored.
3. **Audio coverage is French/Italian-only.** German, Portuguese and Spanish carry model audio in
   one lesson out of eight.
4. **The migrated packs report every lesson as `family: "discovery"`.** The v1 schema had no
   family field, and the adapter assigns one default, so the v2 player's lesson-rhythm vocabulary
   says nothing about French or German yet. Italian's authored families (22 discovery, 1 story, 1
   conversation, 1 listening) are the target shape.

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

- **Native-speaker review: pending.** No foundation lesson has been checked by a
  native speaker. Corrections are tracked through the content-correction issue
  template.
- **Audio listening review: pending.** `npm run content:audio-check` proves
  hashes and integrity, not that a clip sounds right. `docs/audio-provenance/`
  records what was generated; the human listening checklist has not been run.

## Rules

1. A drill may carry a higher tag than its concept (stretch drills, e.g. B1 CLOZE on an A1 pattern) — the tag describes the drill's demand, not the pattern's.
2. New levels land behind the same gates as everything else: fixture lint, STT screen, human listen checklist, provenance.
3. Dashboard copy reports counts ("12 B1 drills"), never badges ("B1 certified") — mastery claims stay with passed assessments.
4. Update the counts in this file only from a fresh `npm run content:build`, and
   never by adding a foundation count to a travel-fixture count.
