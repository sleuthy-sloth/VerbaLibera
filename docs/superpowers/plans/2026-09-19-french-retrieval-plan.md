# French retrieval: bringing Unit 1 back

**Status: proposal only. No pack, report or audio has changed.**
Waiting on the same two decisions the German scaffold is: scope approval, then a
French speaker's review of every string below. French prose is currently
`pending` in `courses/french/review.json`, so this plan adds to an already
unreviewed surface — worth accepting on purpose rather than by default.

## 1. What the reports now say

Not one of French's 26 lessons brings back a single word from an earlier one.
Every unit reports its retrieval item `absent`: Unit 1 introduces 27 items that
nothing later revisits, Units 2 to 5 introduce 20 each, and Unit 6 introduces 25
with nothing after it to bring them back. The same is true of the other four
courses — **0 of 26 Italian lessons retrieve anything, and German, Portuguese and
Spanish are identical.** This is not a French weakness; it is a property of the
template every course was built from.

French's units and their stranded items, counted by `buildCourseOutcomes`:

| Unit | Lessons | Introduces | Stranded |
| --- | ---: | ---: | ---: |
| `fr-unit-1` Meeting people | 5 | 22 words, 5 concepts | **27 — none return** |
| `fr-unit-2` Home and daily life | 4 | 16 words, 4 concepts | 20 |
| `fr-unit-3` Everyday communication | 4 | 16 words, 4 concepts | 20 |
| `fr-unit-4` Going further | 4 | 16 words, 4 concepts | 20 |
| `fr-unit-5` Time and the world around you | 4 | 16 words, 4 concepts | 20 |
| `fr-unit-6` Santé et vie sociale | 5 | 20 words, 5 concepts | 25 (nothing follows it) |

This plan closes **Unit 1** and stops there, because Unit 1 is where the material
is most reusable and because closing it proves the pattern end to end. The rest
is a follow-on, not an omission.

## 2. How retrieval is counted, and the trap in it

Verified in `scripts/content/outcomes.ts` and pinned by tests in
`tests/course-retrieval.test.ts`:

- Retrieval is credited from a **lesson's own `vocabulary` and `conceptIds`
  lists**, in curriculum order. The first lesson to list a word introduces it;
  every later lesson that lists it retrieves it.
- **An activity's `vocabulary` array does not count.** Writing a retrieval
  exercise without adding its words to the lesson's list leaves the report saying
  nothing happened — and vice versa: adding words to a lesson's list with no step
  behind them credits retrieval the learner never did. `tests/course-retrieval.test.ts`
  asserts both directions, so the trap is documented rather than discovered.
- Therefore the rule this plan follows: **every list entry is paired with a step
  that actually uses the word.** The report reads declarations; the honesty has to
  come from us.
- A lesson's `vocabulary` list holds **at most 10 ids** (schema cap), an activity's
  at most 8, and an activity's `conceptIds` 1–5. Coverage has to be spread across
  lessons, and each lesson's own new words compete for those ten slots.

## 3. Constraints that shaped the plan

1. **Taught material only.** A retrieval step in Unit 2 may use Unit 1's and Unit
   2's vocabulary and nothing else. That rules out `mon`/`ma` (Unit 3), `et`,
   `il`/`ils`/`elles`, and any question form (`est-ce que` arrives in Unit 3).
2. **Grammar gaps.** French teaches `j'ai` and `tu as` but no third-person `a`, so
   "she is twenty" cannot be asked for yet. It teaches `sont` with plural nouns but
   no plural pronouns.
3. Those two constraints are why three of Unit 1's words cannot honestly come back
   in Unit 2 — see §5, where each is named with what would unlock it.

## 4. The proposed steps

Six steps, placed one per Unit 2 lesson (two in `fr-home-foundation`), each with
`purpose: "transfer"` and `required: true`. Requirement does not affect
completion, which is `legacy-success` over the authored exercises in every one of
these lessons. Each step is inserted immediately **before** its lesson's reading
step, which moves exactly one `nextStepId` per lesson and orphans nothing.

Every activity also carries the fields a graded v2 activity is checked for:
`revision`, `conceptIds`, `vocabulary`, `skills`, `prompt`, `feedback`,
`evidenceKey` equal to its own id, and `assistanceAffectsEvidence` including
`"model"`. That last one is not optional and not obvious: the schema accepts the
activity without it, and `normalizePack` then refuses the whole pack with *"model
reveal must affect evidence"*. It is the one field this plan's first draft left
out. No legacy exercise record is needed — the probe in
`tests/french-retrieval-plan.test.ts` applies all six steps to the real pack and
it normalizes as it stands.

Each step is written out in full: English prompt, French answer, what it brings
back, and the arithmetic that keeps the lesson's list inside its ten-slot cap.

### S1 — `fr-home-foundation`, cloze with three blanks

- **English:** Two Unit 1 words are missing. Fill them in: I have a house. She is at home.
- **French:** `J'ai une maison. Elle est à la maison.`
- **Brings back:** `fr-family-word-1` (j'ai = I have), `fr-people-word-3` (elle = she), `fr-people-word-4` (est = is)
- **Concepts:** `fr-family-concept`, `fr-people-concept`
- **Lesson list after:** 4 own + 3 = 7 of 10 words; 1 own + 2 = 3 concepts

### S2 — `fr-home-foundation`, cloze with three blanks

- **English:** Now the family. Fill in the three words: I have a sister. You have a brother.
- **French:** `J'ai une sœur. Tu as un frère.`
- **Brings back:** `fr-family-word-4` (une sœur = a sister), `fr-family-word-2` (tu as = you have), `fr-family-word-3` (un frère = a brother)
- **Concepts:** family, people (already listed in S1)
- **Lesson list after:** 7 + 3 = **10 of 10 words**; concepts unchanged

### S3 — `fr-descriptions-foundation`, cloze with three blanks

- **English:** About yourself, from memory. Fill in the three missing words: I am French. I am twenty years old.
- **French:** `Je suis française. J'ai vingt ans.`
- **Brings back:** `fr-identity-word-1` (je = I), `fr-identity-word-2` (suis = am), `fr-identity-word-3` (française = French), `fr-numbers-word-1` (vingt = twenty), `fr-numbers-word-3` (ans = years)
- **Concepts:** `fr-identity-concept`, `fr-numbers-concept`
- **Lesson list after:** 4 own + 5 = 9 of 10 words; 1 own + 2 = 3 concepts
- **Note for the reviewer:** French says age with `avoir`, so `J'ai vingt ans.` is correct even though English says "I am twenty". That is the teaching point, not a slip.

### S4 — `fr-plural-foundation`, cloze with three blanks

- **English:** Now a friend, who is older. Fill in the three words: You are French. You are thirty years old.
- **French:** `Tu es française. Tu as trente ans.`
- **Brings back:** `fr-people-word-1` (tu = you), `fr-people-word-2` (es = are), `fr-numbers-word-2` (trente = thirty)
- **Concepts:** numbers (already listed), people
- **Lesson list after:** 4 own + 6 = **10 of 10 words** (tu, es, tu as, française, trente, ans)
- **Note for the reviewer:** both `française` here and `française` in S3 address a feminine learner, matching Unit 1's own `je suis française`. Whether the course should also show the masculine form is an editorial question this plan does not answer.

### S5 — `fr-routine-foundation`, cloze with two blanks

- **English:** Greet your neighbour the way Unit 1 taught you, then say who you are. Fill in the two greeting words: Hello, I am French.
- **French:** `Bonjour, je suis française.`
- **Brings back:** `fr-first-words-word-1` (bonjour = hello), `fr-identity-word-4` (bonjour = hello / good morning)
- **Concepts:** `fr-first-words-concept`
- **Lesson list after:** 4 own + 2 = 6 of 10 words

### S6 — `fr-routine-foundation`, text with two sentences

- **English:** At the counter. Say yes and thank them; then turn the second offer down: Yes, thank you. No, thank you.
- **French:** `Oui, merci. Non, merci.`
- **Brings back:** `fr-first-words-word-3` (oui = yes), `fr-first-words-word-2` (merci = thank you), `fr-first-words-word-4` (non = no)
- **Concepts:** first-words (already listed)
- **Lesson list after:** 6 + 3 = 9 of 10 words

## 5. Coverage ledger: all 27 of Unit 1's items

| Item | Gloss | Where it comes back |
| --- | --- | --- |
| `fr-first-words-word-1` | bonjour = hello | S5 |
| `fr-first-words-word-2` | merci = thank you | S6 |
| `fr-first-words-word-3` | oui = yes | S6 |
| `fr-first-words-word-4` | non = no | S6 |
| `fr-first-words-word-5` | nation = nation | **deferred — §6** |
| `fr-first-words-word-6` | café = coffee | **deferred — §6** |
| `fr-identity-word-1` | je = I | S3 |
| `fr-identity-word-2` | suis = am | S3 |
| `fr-identity-word-3` | française = French (feminine) | S3, S4, S5 |
| `fr-identity-word-4` | bonjour = hello / good morning | S5 |
| `fr-people-word-1` | tu = you (informal) | S4 |
| `fr-people-word-2` | es = are (with tu) | S4 |
| `fr-people-word-3` | elle = she | S1 |
| `fr-people-word-4` | est = is | S1 |
| `fr-family-word-1` | j'ai = I have | S1, S2 (as the frame), S3 |
| `fr-family-word-2` | tu as = you have | S2 |
| `fr-family-word-3` | un frère = a brother | S2 |
| `fr-family-word-4` | une sœur = a sister | S2 |
| `fr-numbers-word-1` | vingt = twenty | S3 |
| `fr-numbers-word-2` | trente = thirty | S4 |
| `fr-numbers-word-3` | ans = years | S3, S4 |
| `fr-numbers-word-4` | quel âge = how old | **deferred — §6** |
| `fr-first-words-concept` | First words and greetings | S5, S6 |
| `fr-identity-concept` | Names and introductions | S3 |
| `fr-people-concept` | People and être | S1, S4 |
| `fr-family-concept` | Family and avoir | S1, S2 |
| `fr-numbers-concept` | Numbers and age | S3, S4 |

24 of 27 items land in the six steps above. Unit 1 reports `present` only when
all 27 do, so Unit 1 does not flip until §6 also lands. That is the arithmetic the
basis line now publishes ("24 of 27 item(s) introduced here come back in a later
lesson; 3 do not"), which is why I added the count to the basis in this package:
partial progress is visible, and the state stays honest.

## 6. The three deferred items, and what unlocks each

- **`fr-first-words-word-5` nation** — needs a sentence that uses it, and Unit 1's
  own frame ("je suis française") is where it lives. Retrieving it in Unit 3 means
  asking about someone's nationality, which needs either a question form or a
  third-person verb. **Unlocked by:** one step in Unit 3, after `est-ce que`.
- **`fr-first-words-word-6` café** — Unit 3 introduces `un café` as its own word, so
  the Unit 1 entry and Unit 3's entry coexist. **Unlocked by:** a Unit 3 ordering
  step that lists the Unit 1 id too; the café-order unit is the better home.
- **`fr-numbers-word-4` quel âge** — a question frame stored as a word entry. It
  cannot be exercised in Unit 2 at all. **Editorial question:** keep it as a word
  entry retrieved in Unit 3 once questions exist, or fold it into the question
  pattern and retire the entry. Either way it is a decision, not a fix.

## 7. Effects, media, and cost

| | |
| --- | --- |
| **New content** | 6 activities, 6 steps, and the lesson-list entries in §4. No new lessons, units, concepts or vocabulary entries — every id already exists |
| **Media** | **None.** All six steps are text, cloze or ordering over material the course already ships. No new audio, no size change, no provenance entry to write |
| **Reports that move** | French practice activities 232 → 238, `purposeMix` gains `transfer`, and `fr-unit-1`'s retrieval basis goes from 0 of 27 to 24 of 27. README, `docs/cefr-coverage.md`, `docs/astra/reports/*.json` and `docs/curriculum-matrix.md` all regenerate from the packs, so the reconciliation is mechanical — and the reproducibility test requires the regenerated files in the same commit |
| **Existing IDs** | Untouched. Six new activity ids and six new step ids; the steps are inserted before each lesson's reading step, which rewires one `nextStepId` per lesson (the pattern the German proposal uses) |
| **Progress** | Completion is `legacy-success` and unaffected. New activities have no attempts, so no replay path changes and no mastery can be inflated. A learner mid-lesson meets up to two extra steps |
| **Review surface** | Every string in §4 is unreviewed French, added to a course whose prose is already `pending` |

## 8. Reviewer checklist (French)

Prose review, into `nativeSpeaker`, covering the six steps and nothing else:

- [ ] All twelve French sentences are correct, and what a French speaker would
      actually say in these situations
- [ ] `J'ai vingt ans.` and `J'ai une sœur.` are the right way to teach age and
      possession at this point, given that no third-person `a` is taught yet
- [ ] `Bonjour, je suis française.` as a Unit 1 reprise is natural rather than
      mechanical — the greeting is the point, the rest is recall
- [ ] `Oui, merci. Non, merci.` reads as a shop exchange and not as a list
- [ ] The feminine `française` throughout is the right choice for this course, or
      the plan should show both forms
- [ ] Six `transfer` steps in Unit 2 is the right amount of looking back for a
      beginner, or it should be fewer
- [ ] Record: status, what was reviewed, what is pending, date, who, scope

No audio listening review is needed: this plan adds no recordings.

## 9. What I have not done

No edit to `courses/french/**`, `public/packs/french.json`,
`docs/astra/reports/french.json`, or any other pack or report. The changes in this
package are the reporting basis line (§5), `tests/course-retrieval.test.ts`,
`tests/french-retrieval-plan.test.ts`, and this document.

`tests/french-retrieval-plan.test.ts` makes the plan executable without shipping
it: it applies all six steps to the real pack in memory and checks that it
validates and normalizes, that the coverage is 24 of 27 with exactly the three
named items stranded, that the two tight lessons sit exactly on the ten-word cap,
that the model-reveal declaration is required (the case that fails without it),
and that every lesson's chain still reaches every step from its entry. Unit 1
reports `absent` until the last three land; that is the intended state, not a bug.

Units 2–6 remain orphaned, and the same finding stands for Italian, German,
Portuguese and Spanish — Italian is the most valuable next target, because it is
the only course that can also be said aloud.
