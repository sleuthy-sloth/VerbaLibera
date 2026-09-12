# Human review gates

Everything in this file is work a person has to do. None of it has been performed. The
automated suites prove the mechanical claims — the schema accepts each pack, the identities
survive a migration, the audio decodes, the pages pass axe — and none of them can answer
"is this German?", "does this sound right?", or "does a five-minute learner understand what
to do next?". A blank field here is an unfinished gate, not a passing one.

Record each result where it says, with a date and who did it. Do not infer a result from a
green test run, and do not close a gate on someone else's behalf.

## 1. Native-speaker review of the authored prose

**Applies to:** every course's target-language text — lessons, drills, transcripts,
cultural notes and the CEFR claims attached to them.

**Why it is open:** the reports say so in as many words
(`docs/astra/reports/<language>.json` → `review.nativeSpeaker: "pending"`). The prose was
authored and machine-checked for structure, never read by a speaker of the language.

**What "done" means:** a native speaker (or a fluent reviewer) has read each pack's
lesson titles, objectives, prompts, answers and cultural notes, and either accepted them or
listed the corrections. Corrections land as content edits with their own verification; the
CEFR tags are part of this review, because a tag is a claim about level, not a label
(`docs/cefr-coverage.md`).

**Record it in:** `docs/astra/reports/<language>.json` is generated, so record the outcome
in a dated verification note under `docs/superpowers/verification/` and update the
course's row in `docs/cefr-coverage.md`.

**Not a gate, but worth knowing:** `tests/fixtures/lesson-variety.ts` carries a real
three-lesson A1 Spanish starter, because no shipped pack is schemaVersion 1 any more and the
v1 engine's suites need authored content to read. It reaches no learner and blocks no
release — but it is the Spanish most readers of this repository meet first, so read it with
the Spanish pack when this review happens.

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
