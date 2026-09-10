# Adding variation to the French and Italian courses

Measured with `scripts/content/profile-big-courses.py` (French) and
`scripts/content/profile-italian-v2.py` (Italian):

- **French**, 25 lessons, **4 distinct shapes**, 22 of them identical:
  `choice > translate > order > cloze > translate > reading > translate > dictation`.
  22 lessons also share one kind MULTISET (`3 translate + choice + cloze + order +
  reading + dictation`), so reordering alone cannot fix it. `translate` is 71 of
  the course's exercises, `think` appears 4 times, `transform` never.
- **Italian**, 25 lessons, **21 sharing one step-kind sequence**
  (`information > selection > text > ordering > cloze > text > text > text`), and
  22 lessons labelled `discovery` with only three ever using another family.

A learner doing lesson after lesson meets the same rhythm every time. The goal is
that consecutive lessons do not feel the same, without inventing content the
course does not teach.

## French: six archetypes over lessons 2 to 24

**Do not touch lessons 0 and 1** (`fr-first-words-foundation`,
`fr-identity-foundation`). `tests/e2e/course-packs.spec.ts` drives L1 step by step
with hardcoded answers ("suis", "Je suis Marc.", the `-e` notice radio), so any
change there breaks the suite with no benefit. They are also already the two
richest lessons in the course.

Every other lesson keeps its existing exercises and gains exactly **one new
`transform`** exercise, then has its exercises reordered into an archetype. The
meet `choice` stays first and the `dictation` stays last.

| slots | order after the opening `choice` |
|---|---|
| A | meaning, order, cloze, produce, read, review, dictation |
| B | produce, **transform**, order, cloze, meaning, read, dictation |
| C | read, meaning, **transform**, order, cloze, produce, dictation |
| D | **transform**, produce, order, cloze, read, meaning, dictation |
| E | meaning, **transform**, read, cloze, order, produce, dictation |
| F | meaning, cloze, order, **transform**, produce, read, dictation |

These slot names are the lesson's existing exercises, identified by their id
suffix: `-meet`, `-meaning`, `-order`, `-cloze`, `-produce`, `-read`, `-review`,
`-listen-model`. Read each manifest to confirm the suffixes actually present; some
lessons differ.

Archetype **A** needs no new exercise (it is the current order). B to F each need
one new `transform`.

Assignment, chosen so no two consecutive lessons share an archetype:

```
L2 F   L3 B   L4 C   L5 E   L6 D   L7 A   L8 F   L9 C   L10 B
L11 E  L12 D  L13 A  L14 C  L15 F  L16 B  L17 E  L18 D  L19 A
L20 B  L21 C  L22 D  L23 E  L24 F
```

If a lesson is missing a slot its archetype names, keep the archetype's ORDER for
the slots that do exist and keep the missing one out. Report every adjustment.

## The new `transform` exercise

`transform` renders as "Change the pattern": the learner rewrites a sentence
rather than translating it. It must be a genuine manipulation of something the
lesson already teaches, and the answer must be CORRECT French. Safe patterns:

- change the subject: `Je prends un café.` -> `Tu prends un café.`
  (the verb form must actually be right, which is why this cannot be generated
  mechanically: `je travaille` -> `tu travailles` gains an `s`)
- make it a question with `Est-ce que`
- make it plural, or change a possessive
- make it negative ONLY for lessons at or after the point negation is taught
  (the lesson before `fr-negation-foundation` in course order)

Shape:
```json
{
  "id": "fr-<topic>-foundation-transform",
  "conceptId": "<the lesson's own concept id>",
  "kind": "transform",
  "mode": "production",
  "prompt": "Change it so you are asking about your friend instead of yourself: Je prends un café.",
  "answers": ["Tu prends un café."],
  "explanation": "...",
  "vocabulary": ["<the lesson's own word ids>"],
  "reviewOf": ["<the lesson's existing reviewOf value>"]
}
```
Do not repeat the lesson's `produce` answer as the transform's answer: the
learner must produce something NEW, or it is a duplicate exercise.

## Non-negotiable

- Do NOT change: any lesson or exercise id, `unitId`, `cefr`, `prerequisites`,
  `conceptIds`, lesson-level `vocabulary`, `title`, `examples`, `culturalNote`.
- Do NOT change any existing exercise's `answers`, `options` or `tokens`. This
  pass reorders and adds; it does not rewrite content. (The one exception is the
  new transform exercise itself.)
- `dictation` keeps its `audioId`, and its answers must still match the clip's
  transcript.
- Answers unique within an exercise; `choice` options unique after normalization
  (lowercase, punctuation stripped) with exactly one matching the answer.
- An `order` exercise's `tokens` must equal its answer's words.
- At least 4 exercises per lesson; answer coverage stays 100%.
- French diacritics are content, not decoration.

## Payload and application

Same payload format as `scripts/content/lessons/README.md`, applied with
`scripts/content/differentiate-first-words.py`. Unlike the cross-language pass you
are rewriting a lesson's `exercises` array, so include the full array (existing
exercises carried over verbatim, plus the new transform, in archetype order) and
the exercise ids must come through unchanged.

## Acceptance

```
env -u PYTHONPATH python3 scripts/content/profile-big-courses.py   # shape spread
env -u PYTHONPATH npm run content:validate                          # 100% coverage, 0 errors
env -u PYTHONPATH npx vitest run tests/course-pack.test.ts tests/cross-language-variety.test.ts
```

Target: more distinct shapes than lessons/4, no run of consecutive lessons sharing
a shape, and `transform` appearing in the kind totals where it was 0.
