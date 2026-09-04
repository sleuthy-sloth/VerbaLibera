# CEFR coverage

VerbaLibera claims a CEFR level only when the coverage below proves it. Levels are
tagged per concept and per drill (`cefrLevel` on `ConceptBlock`/`DrillItem`, mirrored
in `src/features/curriculum/fixture.ts`), counted by `cefrCoverage()` in
`src/features/curriculum/cefr.ts`, and locked by `tests/cefr-spine.test.ts`.
Update the counts in this file every time leveled content lands.

## Current coverage (2026-09-03)

| Level | Concepts | Drills | Notes |
|-------|----------|--------|-------|
| A1 | 32 | 128 | 4 courses × 8 travel patterns, full audio |
| B1 | 0 | 2 | CLOZE stretch drills on 2 French patterns (passé composé, futur simple) |
| B2 | 0 | 0 | Roadmap Phase 5 |
| C1/C2 | 0 | 0 | Fog — specified after B2 lands |

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

## Rules

1. A drill may carry a higher tag than its concept (stretch drills, e.g. B1 CLOZE on an A1 pattern) — the tag describes the drill's demand, not the pattern's.
2. New levels land behind the same gates as everything else: fixture lint, STT screen, human listen checklist, provenance.
3. Dashboard copy reports counts ("12 B1 drills"), never badges ("B1 certified") — mastery claims stay with passed assessments.
