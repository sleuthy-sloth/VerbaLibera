# Human review gates

Everything in this file is work a person has to do. **Most of it has not been performed.**
One row has been closed since this file was first written: the native-speaker review of the
German and Spanish prose, reported on 2026-09-11 and recorded per course in
`courses/<language>/review.json` — see gate 1, which says exactly what that does and does
not cover. Everything else here is open. The automated suites prove the mechanical claims —
the schema accepts each pack, the identities survive a migration, the audio decodes, the
pages pass axe — and none of them can answer "is this German?", "does this sound right?", or
"does a five-minute learner understand what to do next?". A blank field here is an
unfinished gate, not a passing one.

Record each result where it says, with a date and who did it. Do not infer a result from a
green test run, and do not close a gate on someone else's behalf.

## 1. Native-speaker review of the authored prose

**Status: closed for German and Spanish. Open for French, Italian and Portuguese.**

| Course | Prose review | Recorded |
| --- | --- | --- |
| German | reviewed | 2026-09-11, reported by the project owner — `courses/german/review.json` |
| Spanish | reviewed | 2026-09-11, reported by the project owner — `courses/spanish/review.json` |
| French | pending | — |
| Italian | pending | — |
| Portuguese | pending | — |

**What that means, for the two closed rows.** A reviewer read the authored text in
`courses/<language>/manifest.json` — lesson titles, objectives, prompts, answers,
explanations and cultural notes — and the A1 tags attached to them, which are part of the
review because a tag is a claim about level rather than a label. The outcome is recorded
per course in a `review.json` beside the manifest, and the generated report reads it, so
`docs/astra/reports/german.json` and `docs/astra/reports/spanish.json` now say
`review.nativeSpeaker: "reviewed"` while the other three still say `"pending"`. That is the
whole point of recording it there: a report cannot claim a review that did not happen, and
cannot keep claiming "pending" for one that did.

**What it does not mean.** It is a review of the written course, not of the recordings —
the listening review is gate 2, and it is open for every course including these two. It
also does not cover the Spanish starter in `tests/fixtures/lesson-variety.ts`, which
reaches no learner and blocks no release; it is nonetheless the Spanish most readers of
this repository meet first, so read it with the Spanish pack when the next review happens.

**Applies to:** every course's target-language text — lessons, drills, transcripts,
cultural notes and the CEFR claims attached to them.

**Why the rest is open:** the prose was authored and machine-checked for structure, never
read by a speaker of the language. The reports say so in as many words
(`docs/astra/reports/<language>.json` → `review.nativeSpeaker: "pending"`), and a green
schema check cannot tell you whether the Spanish parses or whether it *is* Spanish.

**What "done" means:** a native speaker (or a fluent reviewer) has read each pack's
lesson titles, objectives, prompts, answers and cultural notes, and either accepted them or
listed the corrections. Corrections land as content edits with their own verification.

**Record it in:** a `review.json` in the course directory, which the report generator
reads (`scripts/content/review.ts`), and the course's row in `docs/cefr-coverage.md`. Then
regenerate with `npm run content:build` so the reports agree with the record.

**Not a gate, but worth knowing:** the v1 engine's suites host on
`tests/fixtures/lesson-variety.ts`, a real three-lesson A1 Spanish starter, because no
shipped pack is schemaVersion 1 any more.

## 2. Human listening review of the audio

**Applies to:** every recording the player can start, in every edition.

**Why it is open:** the mechanical checks prove the files decode, match their transcripts'
length and are not truncated. They cannot tell whether the pronunciation is right, whether
a speaker sounds like a person, or whether the pacing suits a walker. The in-app player
says plainly that the recordings are machine-authored, which is honest and is not a
substitute for this review.

**What "done" means:** someone has listened to each track end to end against its transcript
and marked it acceptable or listed problems, including any place where the recording's
speaker differs from the transcript (the Portuguese model audio is the known one: the
transcript is `Olá, obrigada.` and the exercise accepts either speaker form).

**Record it in:** a dated listening checklist under `docs/superpowers/verification/`, one
line per track.

## 3. The observed five-user pilot

**Applies to:** the first-run path — language choice, the first win, the arrival in the
course — and the dashboard a new learner lands on.

**Why it is open:** the flow is proven to work by test, and the composition has been
measured at 320px and 390px. Neither can tell whether a person understands what to do
without being told. Five observed sessions is the smallest number that answers it.

**What "done" means:** the sessions have happened with a person watching, and what each
participant did — where they hesitated, what they tapped first, where they stopped — is
written down. The gates this feeds: the first-run block's hierarchy
(`docs/superpowers/verification/hermes-development-roadmap-progress.md`, stage 2) is the
part most likely to change.

**Record it in:** a dated pilot note under `docs/superpowers/verification/`, with each
participant's path and the changes it implies.

## 4. Physical-device QA

**Applies to:** the installed PWA (Android and iOS), the offline edition, saved audio, and
anything gesture- or permission-shaped.

**Why it is open:** the desktop-browser suites cannot cover it, and one gap is already
documented rather than hidden: Playwright's WebKit raises an internal error on any
navigation with the network emulated off, so the WebKit half of the offline matrix runs
partially and the iPhone offline pass stays open. Downloads cannot be interrupted from
outside the page either, because the service worker answers the fetch before `page.route`
sees it.

**What "done" means:** on a real phone: install, go offline, play a saved track, close and
reopen the app (position and progress survive), turn the screen off during playback and
check the lock screen, and run the first-run flow end to end. Record what failed, not only
that it worked.

**Record it in:** a dated device note under `docs/superpowers/verification/`, naming the
device, OS version and browser engine.

## 5. Signed and notarised distribution

**Applies to:** the packaged desktop edition, if it is distributed outside this machine.

**Why it is open:** it is a decision before it is a task — certificate, cost, and who signs.
Nothing in the repository claims a signed build.

**What "done" means:** a decision is recorded (sign, or ship unsigned with the warning
stated), and if signed, the artefact verifies with `codesign --verify`/`spctl` and the
verification is attached to the release note.

**Record it in:** the decision in this file's section of the run record, and the
verification in the release note built from
`docs/superpowers/verification/RELEASE-VERIFICATION-TEMPLATE.md`.

## 6. The content that does not exist yet

**Applies to:** the emergency lesson the minor-emergency scene anticipates, and any other
lesson a shipped picture assumes.

**Why it is open:** the artwork exists and the lesson does not. Writing it is content work,
and inventing it to match a picture would be backwards. The scene mapping simply has no
lesson to attach to today, which is recorded rather than faked.

**What "done" means:** either the lesson is authored (with its own review per gates 1 and
2), or the decision is recorded that the scene stays a library picture with no lesson.
