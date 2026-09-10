# Would a new learner come back? — French First words, reviewed cold

Date: 2026-09-10
Scope: the lesson experience itself (v1 engine, French course, 25 lessons / 202
exercises). The chrome around it was fixed in
`2026-09-09-accessibility-navigation-implementation.md`; this is about what
happens once you are *inside* a lesson.
Method: walked Lesson 0 end to end in a 390×844 mobile viewport as a signed-out
first-time learner, recording every panel's text and every visible control, then
censused the shape of all 202 exercises in the French manifest and the render
path in `CourseWorkspace` / `ExerciseView` / `answer.ts`.

---

## The short answer

**No.** Not because it's bad — the teaching logic underneath is better than most
apps'. Because nothing in the first two minutes makes you feel anything, and by
lesson three you have seen the same eight screens four times.

The blunt version: a first-time learner answers their first-ever French question
correctly and the app responds with the word `correct` in lowercase, followed by
the sentence *"That matches an authored answer."* Then the button that advances
them says **"Save and continue."** That is a database, not a teacher.

## What is genuinely good, and should not be touched

Being fair to it, because a rewrite that throws this away would be worse:

- **Think-before-you-answer is real.** Step 2 gates the text box behind *"I've
  thought about it — let me answer"* and the prompt says *"Say it in your head,
  out loud, or to whoever is nearby. There is nothing to memorize; build it from
  what this lesson already gave you."* Most apps never ask a learner to think.
- **Discovery ordering is correct.** Notice → build → vary → use, with the
  `-meet` recognition step first, is the right spine.
- **No hearts, no timer, no lives.** The landing page's promise is honest and
  the lesson honours it.
- **The explanations are real linguistics**, not filler ("unlike English, every
  French noun wears a gender tag"). The `Why this works` disclosure is worth
  keeping.
- **Error categories are specific** — `accent/diacritic issue`, `word-order
  problem` — and they carry a targeted explanation. That's better diagnostics
  than Duolingo.

The problem is not the pedagogy. It is that the pedagogy is *dressed like a
database*.

---

## Evidence

### 1. The reward for a correct answer is an internal label

`src/features/course-pack/answer.ts:53` returns the explanation
`"That matches an authored answer."` for every correct answer. `ExerciseView`
renders the grader's `category` field as the learner-facing heading:

```
<strong>{result.category}</strong>   →  correct
<p>{result.explanation}</p>          →  That matches an authored answer.
```

So the full credit string is `correct / That matches an authored answer.` The
other categories render the same way: `acceptable alternative`, `accent/diacritic
issue`, `word-order problem`, `model revealed`. These are taxonomy keys. They are
correct for a grader and wrong for a human.

The advance button is `Save and continue` (and `Saving…` while it writes). The
v2/Italian engine is no better: `Correct.` / `Not quite. Try again.` / `Noted.` /
`Hold on.` — no variation, no warmth, and `Noted.` for a self-assessment.

### 2. Most answers are in English

Of 202 prompts: 28 explicitly demand English output, 45 demand French, and 129
are choice / reading / meta questions where no language is produced.

Lesson 0 is a 7-step lesson that teaches *bonjour, merci, oui, non* — and the
learner produces French in three of seven steps. The other four:

| Step | Asks for | Why it's there |
| --- | --- | --- |
| 1 `SPOT THE MEANING` | the English meaning of *Bonjour* | recognition — fine as a hook |
| 3 `SPOT THE MEANING` | *"Nation, information, restaurant — spelled almost the same. Why do you already recognize them?"* | **a question about etymology theory** |
| 4 `MAKE THE CONNECTION` | `Give the English meaning: Merci.` | translate into English |
| 6 `READ A SMALL STORY` | *"How many times do you read the word for thank you?"* | **a counting task** |

Step 3 asks a brand-new learner to reason about Latin cognates before they have
said a word. Step 6 asks them to count occurrences in a passage. Both are
"prove you read the material" questions, not practice.

### 3. Nothing is ever heard, and nothing is ever said

- **26 of 202 exercises carry audio (13%)** — and those 26 are the *final*
  dictation step of each lesson. So audio appears exactly once per lesson, last.
  A beginner's first six interactions are silent text, including the step whose
  own copy claims *"You already know this word"* about a word they have never
  heard.
- **No exercise in any course asks the learner to speak.** There is no speaking
  activity kind. `"speaking"` exists only as a `Skill` evidence tag
  (`lesson-runtime.ts:24`, `schema-v2.ts:48`) with no renderer. The only voice
  input in the app is an optional `VoiceRecorder` inside the separate
  `GuidedSession` feature (`GuidedSession.tsx:281`), which renders only when
  playable audio exists and is not part of the lesson flow.

Saying *Bonjour* out loud and having it recognised is the single most motivating
30 seconds in beginner language learning. This app has a whisper STT sidecar
already built and never uses it for this.

### 4. Confirmed: 23 of 25 lessons are the same eight screens

Exercise kind sequence per lesson:

```
L0  choice -> think    -> choice -> translate -> cloze -> reading -> dictation
L1  choice -> think -> choice -> think -> order -> think -> translate -> cloze -> reading -> dictation
L2  choice -> translate -> order -> cloze -> translate -> reading -> translate -> dictation
L3  choice -> translate -> order -> cloze -> translate -> reading -> translate -> dictation
L4  choice -> translate -> order -> cloze -> translate -> reading -> translate -> dictation
... identical through L24
```

L1 is the Thinking Method exemplar (three `think` steps). L0 is its own shape.
**L2 through L24 — 23 consecutive lessons — are byte-for-byte the same sequence
of kinds.** Only the nouns change.

Kind census, 202 exercises: `translate:71  choice:27  dictation:26  cloze:25
reading:25  order:24  think:4`.

- **71 of 202 (35%) are "Give the English meaning: X."** The single most passive
  exercise type is the plurality of the course.
- **4 `think` steps in 25 lessons**, all in L0 and L1. The most distinctive
  thing the method does is abandoned after the second lesson.

A learner notices a template by the third repetition. By L4 they know exactly
what comes next, and the only open question is which word is in the slot.

### 5. Words are introduced and then never practised

Searching every exercise for Lesson 0's own vocabulary:

| word | exercises referencing it |
| --- | --- |
| `bonjour` | 8 |
| `merci` | 9 |
| `oui` | 8 (none before L9) |
| `non` | **1 — the reading passage in L0, never practised** |
| `café` | first touched in L11 |

Lesson 0 teaches six words and asks about two of them. `non` is shown once and
never used. That is a lesson that teaches less than it claims.

### 6. The "recall" step hands over the answer

Steps phrased `Recall from People and être: You are Marc.` print the English and
ask for the French. That is transcription, not recall. Real spaced retrieval
gives a situation and no English scaffold.

### 7. The course's own plumbing renders inside the practice

Every practice step still renders, in the flow:

- `Keep a practice backup` / `Export practice backup` / `Import practice backup`
  + a file input (`CourseWorkspace.tsx:655`)
- *"Twenty-four original A1 foundation lessons... Machine-authored and
  consistency-checked; native-speaker editorial review remains open."*

Confirmed on all seven steps of the L0 walk (`chrome leak: backup=true
provenance=true`). The lesson shell suppresses the course chrome while
practising but the storage footer and provenance line sit outside that guard.

### 8. The lesson ends with an apology and a dead end

```
Practice complete
Your results were saved on this device. Missed or revealed answers stay in review.
A completed practice session is not a proficiency certificate.
[Back to course]
```

No recap of what you can now say. No invitation to the next lesson. And a
disclaimer that undercuts the one moment that should feel like a win. Compare:
"You just said your first four things in French." → [Next: People and être →].

### 9. Nothing accumulates

Inside a lesson the only progress signal is `Practice 1 of 7`. No correct-streak,
no per-word tally, no sense that the session is building. The end state is
`Practice complete` and a button back to the list. (Credit where due: XP and
streaks were deliberately removed from `/you` because the landing page promises
they don't exist. That call was right — but nothing replaced them, so the learner
has no visible progress of any kind.)

---

## Would a new user come back?

Honest read: **probably not on its own merits.** A learner who is already
motivated to study French would keep going, because the explanations are good.
A curious person who installed five apps to see which one is fun would drop this
one first — not because it's broken, but because it asks a lot (seven steps,
four of them typing English answers) and gives back almost no signal that
anything is working.

The competition wins on: a sound and a colour burst on every answer, a very fast
first win, speaking in the first minute, visible accumulation, and an ending that
tells you what you just accomplished. VerbaLibera delivers none of those five.

The gap is not capability. The app already has TTS, STT, SM-2, an activity
runtime with a `Response` union that includes `self` ratings, and a `Skill` enum
with `speaking` in it. The gap is that the content and the copy treat the learner
as a data source instead of a person.

---

## Fix plan

Ordered by leverage per unit of risk. Items 1–4 are component-level and can ship
without touching content. Items 5–7 change content and need editorial care.

### Tier 1 — the experience, not the content (ship first, low risk)

1. **Rewrite the feedback layer.** Never render a grader category. Speak to the
   learner: rotate a small set of warm, specific acknowledgements (`Nice —
   that's it.`, `Exactly.`, `That's the one.`), reserve `Not quite — try once
   more.` for misses, and keep the *diagnostic* copy specific (`The accents are
   the only thing off.`) because that part is genuinely good. Rename
   `Save and continue` → `Continue` and `Saving…` → nothing visible.
   - Files: `src/features/course-pack/answer.ts`, `ExerciseView.tsx`,
     `LessonPlayer.tsx` (`outcomeWord`).
   - Guard with a copy test so `authored answer` can never reappear.

2. **Close the chrome leak.** Wrap `study-storage` and the provenance footer in
   the same `practising` guard as the rest of the course chrome. Nothing about
   backups or machine authorship belongs on a practice screen.

3. **Make the ending a payoff.** Replace `Practice complete` +
   proficiency-certificate disclaimer with a recap that names what the learner
   can now say (pull the practised vocabulary from the manifest), plus a primary
   `Next: <next lesson title>` and a secondary `Back to course`.

4. **Show accumulation inside the lesson.** A running tally of correct answers
   and a small "words you've used today" list. Deterministic, no XP, no streaks —
   consistent with the landing-page promise — but the learner can see the session
   building.

### Tier 2 — make the first lesson land (content, moderate risk)

5. **Rewrite Lesson 0 to say something out loud.** Reorder to
   hear → say → recognise → build, put per-word model audio on step 1, and give
   the learner a spoken rep. This is the highest-leverage content change in the
   whole app: a first lesson where you *speak* French in the first minute.
   - Requires a `speaking` activity kind and renderer (the `Response` union has
     `self` ratings already; `VoiceRecorder` exists to lift).
   - Requires per-word audio, which the voice sidecar can already synthesise.

6. **Cut the two meta steps from L0** (the etymology question and the counting
   question) and spend those slots on French the learner produces. Fold the
   cognate insight into the explanation text where it belongs — it's a good
   insight, delivered as a quiz.

7. **Break the L2–L24 clone.** Introduce 4–5 lesson *variants* and rotate them:
   a story lesson, a conversation lesson, a listening lesson, a mission/scene
   lesson, and a spaced-recall lesson. The v2 schema already has a `family` field
   and the Italian pack already declares `discovery/story/conversation/listening`
   — the vocabulary for variety exists and isn't used. Concretely, a rotation
   like `discovery → discovery → story → discovery → conversation → listening →
   mission → recall` would end the "same eight screens" problem without authoring
   25 bespoke lessons.

   Also raise `think` from 4 occurrences to at least one per lesson, since it is
   the method's whole differentiator.

### Tier 3 — systemic

8. **Audio on every French target, not just the dictation.** 26/202 is a
   content defect, not a design choice.

9. **Speaking as a first-class activity.** Wire `VoiceRecorder` + whisper into
   the activity runtime so any lesson can ask "say it." Deterministic scoring
   (the STT path already does exact-match QA) keeps the
   no-runtime-LLM invariant intact.

---

## Recommendation

Do Tier 1 now — it is component-level, testable, and removes the single coldest
thing in the product (a grader's category rendered as a teacher's voice) plus
the chrome leak and the apologetic ending. Then rewrite Lesson 0 (Tier 2 item 5)
as a proof that the experience can be warm, and only then propagate the lesson
variants across L2–L24, because that is 23 lessons of editorial work and should
follow a template that has been shown to work.

Sequencing note: items 5 and 7 both touch lesson shape, and
`tests/e2e/course-packs.spec.ts` walks L1 step by step. Land the L0 rewrite and
the variant rotation in separate commits, updating the affected e2e walks in each.
