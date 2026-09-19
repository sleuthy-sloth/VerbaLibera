# German lessons 9–10: optional say steps

**Status: proposal only. Nothing in this document has been authored into a pack.**
It is waiting on two separate decisions before any learner-visible German, media
or review record changes:

1. **Scope approval** — whether these two activities and their sentences are what
   we want in `de-weather-foundation` and `de-free-time-foundation` at all.
2. **Human review** — German wording and variant, explanation, the model line and
   its recording, dialect/voice and transcript match, by a named reviewer.

Until both are recorded, the conversation-matrix contract reports German's
speaking item as `not-applicable`, its prose review as `pending`, and its audio
listening review as `pending`, and none of that moves.

## 1. What already exists to reuse

The player's only speaking step is `self-compare`, and Italian uses it 24 times.
Nothing new is needed — no player, no component, no schema field.

| Piece | Where | What it gives us |
| --- | --- | --- |
| Schema | `src/features/course-pack/schema-v2.ts:146-157` | `kind: "self-compare"`, `id`, `revision`, `conceptIds` (1–5), `vocabulary` (≤8), `skills` (1–3), optional `stimulusId`, `prompt`, `modelText`, optional `modelAudioId` |
| A real activity | `courses/italian/manifest.json`, e.g. `it-people-foundation-say` | The authored shape: `prompt` in English, `modelText` in the target language, `modelAudioId` pointing at a per-lesson model clip |
| Step wiring | e.g. `it-people-foundation-step-say` | `purpose: "practice"`, `required: false`, `branches: {}`, `nextStepId` into the step it precedes |
| Dispatch | `activities/ActivityView.tsx:129-130` | Renders `SelfCompareActivity`, hands it the model audio URL |
| Model audio lookup | `LessonPlayer.tsx:1030` | Passes the URL only when `modelAudioId` is declared **and** the media exists in the pack — a missing clip degrades, it does not break |
| Behaviour | `activities/SelfCompareActivity.tsx` | Records **before** the reveal; the recorder is gated on `canRecord`; a denied microphone shows a note ("Say it out loud anyway") and the learner continues; the only response is a self-rating, `{kind:"self", rating:"again"\|"comfortable"}`; "Nothing is uploaded or kept" |
| Ungraded | `attempts.ts:203`, `activity-evaluation.ts:62` | A self-assessment is excluded from graded evidence, so it cannot inflate mastery |
| Placement habit | Italian's 24 say steps | 12 sit immediately before the lesson's reading step, 8 before the final graded step, 4 before an ordering step. Never last |

Verified in code, not assumed: **optional** (`required: false`), **no
pronunciation score** (a self-rating is the whole response), and **microphone
denial or an unrecordable browser never blocks completion**.

## 2. The proposal, exactly

Two activities, two steps, one rewired link each. Both lessons end with their
reading step, so the say step goes immediately before it — the placement Italian
uses most often.

**`de-weather-foundation`** (unit `de-unit-5`, after the cloze step, before
`de-weather-foundation-step-read`):

```json
{
  "kind": "self-compare",
  "id": "de-weather-foundation-say",
  "revision": 1,
  "conceptIds": ["de-weather-concept"],
  "vocabulary": ["de-weather-word-2"],
  "skills": ["speaking"],
  "prompt": "You are on the phone with a friend in Hamburg. Tell them what the weather is doing: It is raining.",
  "modelText": "Es regnet.",
  "modelAudioId": "de-weather-foundation-model"
}
```

Step:

```json
{
  "id": "de-weather-foundation-step-say",
  "purpose": "practice",
  "activityId": "de-weather-foundation-say",
  "required": false,
  "nextStepId": "de-weather-foundation-step-de-weather-foundation-read",
  "branches": {}
}
```

**`de-free-time-foundation`** (same unit, after the cloze step, before
`de-free-time-foundation-step-read`):

```json
{
  "kind": "self-compare",
  "id": "de-free-time-foundation-say",
  "revision": 1,
  "conceptIds": ["de-free-time-concept"],
  "vocabulary": ["de-free-time-word-2", "de-free-time-word-3"],
  "skills": ["speaking"],
  "prompt": "A friend asks what you do in your free time. Say that you like playing football: I like playing football.",
  "modelText": "Ich spiele gern Fußball.",
  "modelAudioId": "de-free-time-foundation-model"
}
```

Step:

```json
{
  "id": "de-free-time-foundation-step-say",
  "purpose": "practice",
  "activityId": "de-free-time-foundation-say",
  "required": false,
  "nextStepId": "de-free-time-foundation-step-de-free-time-foundation-read",
  "branches": {}
}
```

**The one edit to existing records:** each lesson's preceding step changes its
`nextStepId` to point at the new say step (`…-step-cloze` → `…-step-say`). No
other existing step, activity, stimulus, concept, unit, vocabulary entry or
`entryStepId` moves. The lesson's `completionPolicy` is untouched.

## 3. Every learner-visible string, for the reviewer

English is the project's instruction language; the German is what the learner
reads, hears and is asked to say.

| # | Where | Language | Proposed text |
| --- | --- | --- | --- |
| 1 | Weather prompt | English | You are on the phone with a friend in Hamburg. Tell them what the weather is doing: It is raining. |
| 2 | Weather model line | German | Es regnet. |
| 3 | Weather recording (proposed) | German audio | "Es regnet." — Piper `de_DE-thorsten-medium` |
| 4 | Free-time prompt | English | A friend asks what you do in your free time. Say that you like playing football: I like playing football. |
| 5 | Free-time model line | German | Ich spiele gern Fußball. |
| 6 | Free-time recording (proposed) | German audio | "Ich spiele gern Fußball." — Piper `de_DE-thorsten-medium` |

Both German lines are lifted unchanged from the lessons' own teaching, so the
reviewer is checking placement and context, not new prose:

- "Es regnet." is lesson 9's predict answer (`de-weather-foundation-think`), its
  cloze answer and the first line of its examples stimulus ("Es regnet heute.").
- "Ich spiele gern Fußball." is lesson 10's correct option in
  `de-free-time-foundation-notice` and the sentence its vary step moves to `wir`.

**Open question for the reviewer (both lines):** whether `gern` and `es regnet`
should be presented as fixed chunks to be said whole, or whether the prompt
should invite a variant (e.g. `Es regnet heute.`) that the model does not
contain. The first is what the lessons teach; the second gives more room but
makes the self-compare harder for a beginner.

## 4. Reused vocabulary and concepts

No new vocabulary, no new concept, no new unit — the activities reuse the words
the lessons already register, so the reports' counts for German (10 lessons, 62
activities, 42 words, 10 concepts) do not move, and neither does the matrix's
vocabulary or prerequisite graph.

| Activity | Concept | Vocabulary | German it exercises |
| --- | --- | --- | --- |
| `de-weather-foundation-say` | `de-weather-concept` | `de-weather-word-2` | "es regnet" — it is raining |
| `de-free-time-foundation-say` | `de-free-time-concept` | `de-free-time-word-2`, `de-free-time-word-3` | "gern" — gladly, like doing; "spielen" — to play |

## 5. Media inventory and size

Two new model clips. Same directory and naming convention as the clip German
already ships.

| Proposed id | Path | Transcript | Size estimate |
| --- | --- | --- | --- |
| `de-weather-foundation-model` | `public/audio/german-foundations/de-weather-foundation-model.wav` | Es regnet. | ~70–90 KiB |
| `de-free-time-foundation-model` | `public/audio/german-foundations/de-free-time-foundation-model.wav` | Ich spiele gern Fußball. | ~80–110 KiB |

Estimate basis: Italian's per-lesson model WAVs in `public/audio/italian-foundations/`
run 78,044 bytes (`it-first-words-foundation-model.wav`) to 114,044 bytes
(`it-emergency-foundation-model.wav`) for one short sentence each. Two clips
therefore land around **150–200 KiB**, against `public/audio/german-foundations/`
at 6.0 MiB today and the portable single file at about 18 MB — **well under 0.2%**,
below the noise of the build's own variance.

Provenance fields, copied from the shape German already uses for
`de-first-words-foundation-model`:

```json
{
  "id": "de-weather-foundation-model",
  "kind": "audio",
  "url": "/audio/german-foundations/de-weather-foundation-model.wav",
  "transcript": "Es regnet.",
  "attribution": "Original lesson text; Piper 1.8.0 / de_DE-thorsten-medium; generated locally <date>. Native-speaker prosody review pending.",
  "sha256": "<64 hex, computed at authoring time>"
}
```

Review metadata stays in the two separate records it belongs in — prose review in
`courses/german/review.json`'s `nativeSpeaker` block, listening review in its
`audioListening` block, which is `pending` today. The pack's own `attribution`
line keeps saying lessons 1-8 reviewed / 9-10 pending until a reviewer says
otherwise; `tests/german-foundation-depth.test.ts` checks that sentence.

**Separate finding, needs a decision of its own:**
`public/audio/german-foundations/de-introductions-foundation-listen.mp3` is
6,082,989 bytes — 5.8 MiB, and **no manifest record declares it** and no activity
references it. It is 97% of the directory's weight and it ships anyway. Either it
should be declared and used, or deleted; it is not part of this proposal.

## 6. Stable IDs and progress

| Concern | Effect |
| --- | --- |
| New IDs | `de-weather-foundation-say`, `de-weather-foundation-step-say`, `de-free-time-foundation-say`, `de-free-time-foundation-step-say`, plus the two media ids. Everything else is byte-identical |
| Existing IDs | Untouched. The only edit to existing records is one `nextStepId` per lesson |
| Attempts and mastery | The new activity has no attempts, so nothing is replayed against it. Self-assessments are excluded from graded evidence, so neither a rating nor a skip can move mastery |
| Due schedules and sync | Untouched: no exercise id changes, and the step is not a graded completion item |
| Imports and exports | Nothing to migrate. A learner mid-lesson in either lesson simply has one more optional step at the end of their walk |
| Completion | `completionPolicy` still names the authored exercises only, so a learner who never opens the say step completes exactly as before. `tests/german-foundation-depth.test.ts` holds this: the say step cannot be part of a legacy-success policy |

## 7. Where later retrieval belongs

Two different gaps, deliberately not fixed by this change:

**Within the unit (cheap, and this is the one to do):** lesson 10 should bring
back lesson 9's frame once, e.g. a retrieval step that asks for "It is raining"
after the free-time material. That turns unit 5's contract item from
`not-applicable` into `present` and gives the unit its first cross-lesson
retrieval.

**Design decision this forces:** the contract's third item currently counts
retrieval from lessons *after* a unit, so the last unit is always
`not-applicable`. If we want lesson-10-retrieves-lesson-9 to count, the item's
basis has to change to "counted in curriculum order: a later lesson in the same
unit counts" — a one-line change to the derivation plus its basis text, and then
unit 5 answers `present` or `absent` like any other. Recommended, but it is a
change to a reported figure, so it should be agreed before it ships, not slipped
in with content.

**Unit 1's vocabulary (17 items, the real gap):** nothing later in German
retrieves the first-words material. The fix belongs in unit 2's lessons as a
retrieval step, not in lessons 9-10, and it touches those lessons' steps — out of
scope here by the brief's own rule ("do not change other lessons' wording or
objectives yet"). Recommend it as the package after this one.

## 8. Tests

Added now, before any content, and all of them pass against the current pack
(they assert scaffolding, never German wording):

- the v2 schema accepts the proposed activity in the real German pack, with and
  without `modelAudioId` — so the activity and its recording can land separately;
- an optional step cannot disturb completion, because German completion is
  `legacy-success` over the authored exercises — proven on the shipped lesson and
  on the injected fixture;
- the media contract a model clip must satisfy: declared, `/audio/…` URL, 64-hex
  hash, and covered by the service worker's `/audio/` precache (asserted on
  Italian, inherited by German the moment its clip lands);
- the report-state transition: German answers `not-applicable` for speaking
  today, Italian answers `present` where it authors say steps, and neither counts
  as reviewed.

Still to add **after** approval, with the content: the pack-level assertions
Italian has (`tests/italian-speaking-steps.test.tsx`) covering that each new step
points at a self-compare, that the optional step is skippable, and that a
recorded response replays — plus updating
`tests/german-foundation-depth.test.ts`'s "authors no audio, so it claims none"
case, which currently asserts `pack.media` has exactly one entry and will have to
say two, with the reason.

## 9. Reviewer checklist

Two reviews, recorded separately, neither satisfiable by the other.

**Prose (German wording), fills `nativeSpeaker`:**

- [ ] Both prompts read naturally as English instructions and describe the same
      act the learner is being asked to perform
- [ ] "Es regnet." is the right thing to ask a beginner to say here, and correct
- [ ] "Ich spiele gern Fußball." is correct, and `gern` in that position is what
      a speaker would actually say
- [ ] `gern` as a fixed chunk is acceptable at this level, or the prompt should
      invite a variant (see §3's open question)
- [ ] The vocabulary links (`de-weather-word-2`, `de-free-time-word-2`,
      `de-free-time-word-3`) name the words these lines exercise
- [ ] Lessons 1–8 are already reviewed; this review covers 9–10 only, and says so

**Audio listening, fills `audioListening`:**

- [ ] Voice and dialect are appropriate for a German A1 learner
- [ ] Pronunciation, stress and intonation of both lines are correct
- [ ] The recording reads the `transcript` field exactly, with nothing added
- [ ] Quality: no clipping, no room noise, consistent loudness with
      `de-first-words-foundation-model.wav`
- [ ] Piper is acceptable as the source, or a native recording is required — the
      existing attribution says "prosody review pending", which this review closes

**Record shape, both:** status, what was reviewed, what is pending, date, who
reported it, and the scope. `docs/human-review-gates.md` is where the outstanding
work is listed; a review that cannot name all five of those is not a review.

## 10. What has not been done

No edit to `courses/german/manifest.json`, `courses/german/review.json`,
`public/packs/german.json`, `docs/astra/reports/german.json`,
`docs/audio-provenance/german-foundations.json`, `public/audio/**`, or any other
pack. No audio generated. No learner-visible text changed anywhere. No A1 claim
added or strengthened: German remains a partial A1 syllabus at ten lessons.
