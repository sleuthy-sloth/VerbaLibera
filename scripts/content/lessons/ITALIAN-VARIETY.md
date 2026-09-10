# Adding variation to the Italian course

Italian is `schemaVersion: 2`, which is a different machine from French:

- Activities live in a **top-level** `activities` array (236 of them); a lesson
  holds `steps`, each `{ id, purpose, activityId }`.
- A lesson ALSO holds `legacyExercises` (v1-shaped) and a
  `completionPolicy` of `{ kind: "legacy-success", exerciseIds: [...] }` naming
  ids that must exist in `legacyExercises`.
- Step kinds in use: `information` 26, `selection` 33, `text` 126, `ordering` 25,
  `cloze` 25, `dialogue-choice` 1.

Measured with `scripts/content/profile-italian-v2.py`: **21 of 25 lessons share
one identical step-kind sequence** (`information > selection > text > ordering >
cloze > text > text > text`), and 22 lessons are labelled `family: discovery`
with only three ever using another family.

## The rule that governs everything: steps and legacyExercises must move together

`normalize-pack.ts` projects between the two representations and `attempts.ts`
credits evidence across that boundary. Reordering one without the other ships a
lesson that renders but cannot be completed. So:

- **Reordering is the lever.** Move the `steps` array into a new order AND move
  `legacyExercises` into the matching order, so step `i` and legacy exercise `i`
  stay the same exercise.
- The `information` intro step stays first. It is the lesson's `entryStepId`.
- Do not remove or add steps in this pass. Do not touch `activities` at all. This
  pass changes ORDER and PURPOSE, not content.
- `completionPolicy.exerciseIds` names legacy exercise ids. Keep that list valid
  after reordering (the ids do not change, only their order, so this normally
  needs no edit; verify).
- The validator fails on an **unreachable step** and on an unknown
  `nextStepId` / branch target, so if any step carries those links they must
  still resolve and the graph must stay connected.

## What to vary

Six orderings over the existing steps, applied so no two consecutive lessons
share a sequence. Name the middle steps by the slot their activity mirrors
(`meet`, `meaning`, `order`, `cloze`, `produce`, `read`, `review`, `listen`,
plus the `information` intro):

| archetype | order |
|---|---|
| A | information, meet, meaning, order, cloze, produce, read, review, listen |
| B | information, meet, produce, order, cloze, meaning, read, listen |
| C | information, meet, read, meaning, order, cloze, produce, listen |
| D | information, meet, order, cloze, produce, read, meaning, listen |
| E | information, meet, meaning, read, cloze, order, produce, listen |
| F | information, meet, meaning, cloze, order, produce, read, listen |

Assign A to F across lessons 2 to 24 in the same rotation as the French pass
(see `FRENCH-VARIETY.md`), so the two courses are varied independently but by the
same scheme:

```
L2 F   L3 B   L4 C   L5 E   L6 D   L7 A   L8 F   L9 C   L10 B
L11 E  L12 D  L13 A  L14 C  L15 F  L16 B  L17 E  L18 D  L19 A
L20 B  L21 C  L22 D  L23 E  L24 F
```

**Do not touch L0 and L1.** They are the exemplars, and `tests/e2e/course-packs.spec.ts`
drives an Italian lesson through the real player with hardcoded steps.

Also set each lesson's `purpose` values so they are honest: `notice` for the
intro, `practice` for the graded steps. Only label a step `transfer` if the
lesson genuinely carries one today (`it-food-foundation` and
`it-requests-foundation` do). Do not invent transfer steps.

Where a lesson's step list has a different length from the archetype (some have 8
steps, some 9, some 13), keep the archetype's relative order for the slots that
exist and report the adjustment.

## Output

A payload JSON in the format of `scripts/content/lessons/README.md`, applied by
`scripts/content/differentiate-first-words.py`. For v2 the field to replace is
`steps` (and `legacyExercises`), not `exercises` — the applier writes whatever
fields you name, so name `steps` and `legacyExercises` explicitly.

Write to `scripts/content/lessons/italian-variety-<range>.json`. Do not run the
applier; a central integrator applies every payload.

## Acceptance

```
env -u PYTHONPATH python3 scripts/content/profile-italian-v2.py   # shape spread
env -u PYTHONPATH npm run content:validate                        # must stay 0 errors
env -u PYTHONPATH npx vitest run tests/lesson-schema-v2.test.ts tests/course-pack.test.ts
```

Target: more than 4 distinct step-kind sequences where there was 1, and no run of
consecutive lessons sharing a sequence.
