# Differentiating same-topic lessons across languages

German, Spanish and Portuguese teach the same topics, which is fine. What is not
fine is that several of those lessons are the *same lesson with the language
swapped*: byte-identical objectives, prompts and explanations in English, and in
some cases the same exercise shape. A learner who opens two courses meets the
same text twice, which reads as filler.

`scripts/content/cross-language-similarity.py` measures it and is the acceptance
test. Run it with no argument for every topic, or with a topic name.

```
env -u PYTHONPATH python3 scripts/content/cross-language-similarity.py cafe-requests
```

A pair is FLAGGED when it shares a shape, or when over 60% of its English text is
identical. The french/italian pairs sit at 61-67% with *different* shapes and are
acceptable: that residue is shared English scaffolding like "Read the exchange."
The de/es/pt pairs at 74-96% with an identical shape are the problem.

## What to produce

One payload JSON per topic set, written to
`scripts/content/lessons/<topic-set>-differentiation.json`, in exactly the shape
of `first-words-differentiation.json`. Read that file first: it is a finished
example, and the commit that added it explains the reasoning.

```json
{
  "courses/german/manifest.json": {
    "concept": { "id": "de-cafe-requests-concept", "explanation": "..." },
    "lesson":  { "id": "de-cafe-requests-foundation", "objective": "...", "exercises": [ ... ] }
  },
  "courses/spanish/manifest.json": { ... },
  "courses/portuguese/manifest.json": { ... }
}
```

Fields you omit are left alone. Anything you name replaces the existing value
wholesale, so `exercises` must be the complete new array.

**Do not run the applier and do not edit any file under `courses/`.** Payloads
only; they are applied centrally, because several payloads target the same three
manifests and parallel writers would clobber each other.

## What you may change

- `objective`, `explanation`, and the concept's `explanation`
- every exercise's `prompt`, `explanation`, `passage`, `translation`
- the **order** of the exercises within a lesson

## What you must not change

- any lesson id, exercise id, or concept id
- `unitId`, `cefr`, `prerequisites`, `conceptIds`, `vocabulary` (the id lists)
- the audio: a `dictation`'s `audioId` and its `answers` must still match the
  clip's transcript exactly (read it from the pack's `media[].transcript`)
- `tests/course-pack.test.ts` pins some exercises by id and field. Read it before
  writing, and leave anything it asserts on exactly as it is.

## The point

Do not paraphrase the English that is there. Give each language a lesson with its
own **teaching angle**: what is genuinely awkward, surprising or worth knowing for
that language. German's noun capitals, Spanish's inverted question mark and
Portuguese's speaker-agreeing *obrigado* are the model, from the first-words pass.
Generic rewrites that say the same thing in different words will still measure as
identical and have missed the point.

Also reorder each lesson's exercises so no two of the three languages share a kind
sequence. Keep the same set of kinds, so no new kind-specific fields are needed.
Keep each lesson's opening exercise a recognition `choice`.

## Rules that validation will enforce

- Answers must be unique within an exercise, and **options must be unique after
  normalization**, which lowercases and strips punctuation. A choice exercise
  about punctuation therefore cannot use options that differ only in punctuation:
  `¿Sí?` and `Sí?` are the same option and `validatePack` rejects the pack.
- An `order` exercise's `tokens` must contain exactly the words of its accepted
  answer, and the accepted orders cap at 8.
- A `think` exercise needs `thinkSeconds` between 3 and 60.
- A `reading` exercise's `passage` and `translation` must agree with each other
  and with its question and answers.
- Every lesson keeps at least 4 exercises, and answer coverage stays at 100%.
- Portuguese diacritics and Spanish accents and inverted punctuation are content,
  not decoration. Keep them correct.
