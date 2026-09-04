# VerbaLibera Phase 1 Design

Date: 2026-08-30

Status: The user approved the proposed architecture in conversation. This written specification is awaiting review before implementation planning.

## 1. Objective and scope

Build a runnable, responsive foundation for VerbaLibera, a language-learning application that combines deliberate sentence construction with subsequent high-intensity spoken drills. The first release contains two English-source courses: English to French and English to Italian. The data model supports additional language pairs and CEFR levels A1 through C2.

The learner first understands a structural concept, hears a construction prompt, and thinks or speaks without a time limit. After explicitly requesting the instructor's answer, the learner can compare their construction. Merely requesting an answer or finishing audio does not establish mastery. A separate concept assessment is required before related automation drills can be unlocked.

Phase 1 delivers:

- A commented PostgreSQL Prisma schema and the database constraints needed to preserve its invariants.
- A Next.js App Router application using React, TypeScript, Tailwind CSS, and TanStack Query.
- A working, reusable segmented HTML audio player with indefinite active pauses.
- A responsive dashboard and example learning screen, with demonstration progress clearly identified.
- A pure, tested SM-2-based scheduler for sentence-construction drills.
- Server-side curriculum access policy and service boundaries, with tests for concept-specific unlocking.
- An installable PWA shell, icons, and a safe offline fallback.
- Setup instructions, an architecture tree, and a concrete voice-validation integration guide.
- A public GitHub repository at `sleuthy-sloth/VerbaLibera`, subject to the name being available.

The first release seeds two independent A1 course shells:

- `english-to-french`: English source language (`en`) and French target language (`fr`), with an original Thinking Method example built around English `-tion` to French `-tion` cognates and a linked transformation drill.
- `english-to-italian`: English source language (`en`) and Italian target language (`it`), with an original Thinking Method example built around English `-tion` to Italian `-zione` cognates and a linked transformation drill.

These examples establish the content and audio-segment formats; they are not a claim that either course is complete. Each course has its own ordered concept sequence, mastery state, drill unlocks, and progress totals. A learner's completed French concept cannot unlock an Italian drill, even when the structural pattern resembles it.

Authentication, production account persistence, automated speech grading, recorded-course ingestion, downloadable offline lessons, and offline progress synchronization are later phases. Phase 1 must not represent preview data as persisted account data or claim to certify CEFR proficiency. Public hosting of a running application is not part of this repository-publication step.

## 2. Architectural decision

The selected approach is a runnable vertical foundation with explicitly labeled demonstration data. A snippets-only deliverable would not exercise the interaction or mobile layout. Building production authentication, speech evaluation, and a complete curriculum immediately would exceed the requested Phase 1.

Server Components render page structure and course metadata. Client Components own audio, keyboard interaction, and query state. TanStack Query handles the dashboard's read-only progress request and its loading, error, and retry states. Database access remains in server-only modules; database models are mapped to narrow serializable application types before crossing the client boundary.

There is no unauthenticated progress-mutation endpoint. Production service interfaces accept a trusted user identity supplied by a future authentication layer, never an arbitrary client-selected user ID. The database-backed unlock policy is implemented and tested as a service boundary, but a preview visit does not create a real assessment or persist real mastery.

### Planned structure

```text
VerbaLibera/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── public/
│   ├── audio/
│   ├── icons/
│   ├── offline.html
│   └── sw.js
├── src/
│   ├── app/
│   │   ├── api/demo/progress/route.ts
│   │   ├── learn/[conceptId]/page.tsx
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── manifest.ts
│   │   └── page.tsx
│   ├── components/
│   │   ├── audio/AudioPlayer.tsx
│   │   ├── dashboard/
│   │   └── pwa/
│   ├── features/
│   │   ├── curriculum/
│   │   ├── progress/
│   │   └── srs/
│   └── lib/
│       ├── prisma.ts
│       └── query-provider.tsx
├── tests/
├── docs/
│   ├── architecture.md
│   ├── voice-validation.md
│   └── superpowers/
├── .env.example
└── README.md
```

The implementation plan may add focused helper and test files without changing these responsibility boundaries.

## 3. Curriculum and persistence

### Required models

| Model | Responsibility |
| --- | --- |
| `User` | Stable learner identity, unique account identifier, and timestamps; no plaintext credentials. |
| `Language` | Unique language tag, display name, and source/target course relations. |
| `Course` | Language pair, unique slug, title, description, and ordered concepts. The initial rows are English to French and English to Italian. |
| `ConceptBlock` | Course membership, CEFR level, order, structural rule or cognate explanation, assessment criteria, and associated drills. |
| `DrillItem` | Exactly one governing concept, CEFR level, substitution/transformation type, construction prompt, accepted responses, recall target, and audio. |
| `UserProgress` | One record per learner and drill, containing SM-2 ease, interval, repetition count, due date, lapse count, last review time, accuracy, and recall latency. |

Additional models make the required behavior explicit:

- `AudioSegment`: ordered, separately addressable audio clips with `PROMPT` or `ANSWER` type, a `pauseAfter` flag, URL, optional transcript, duration metadata, and content provenance. Each segment belongs to exactly one concept or drill, not both.
- `ConceptAssessment`: a learner's assessment attempt against a specific concept, including evaluation method, result, and completion timestamp. A playback-completed event is not an assessment result.
- `ConceptMastery`: a unique learner/concept record referencing a passing assessment. This record is the authoritative drill-unlock condition, separate from SRS retention estimates.

Use an enum for CEFR levels `A1`, `A2`, `B1`, `B2`, `C1`, and `C2`, and enums for drill kind, audio segment kind, and assessment result. Use explicit named relations where the same models are linked more than once.

### Integrity requirements

- Concept ordering is unique within a course; audio ordering is unique within its parent.
- User/drill progress and user/concept mastery are unique pairs.
- A mastery record's referenced assessment must belong to the same learner and concept and have a passing result; enforce this through composite foreign keys and, where needed, a database trigger in the migration.
- PostgreSQL check constraints enforce audio segment parent exclusivity, nonnegative intervals and durations, and a minimum ease factor of 1.3 where relevant.
- Prisma relations enforce ownership; application validation additionally requires a drill's CEFR level to agree with its governing concept for this phase.
- Due-queue indexes begin with user identity and due time; curriculum indexes support course and CEFR filtering.
- Accepted responses belong to the target-language construction, not isolated vocabulary flashcards.
- Content provenance distinguishes original demonstration material from future imported material. No external course recordings are bundled without verified redistribution permission.
- Deleting an account can remove its dependent learning records. Curriculum deletion must not silently destroy retained learner history; use restrictive relations or explicit archival behavior.
- A course's source and target language must differ. `en → fr` and `en → it` are distinct courses even though they share `en` as a source language.

PostgreSQL-only constraints must be included in committed migrations and documented; comments in `schema.prisma` alone are not enforcement.

## 4. Concept-to-drill transition

The production access service resolves a drill and its concept, then checks the requesting learner's mastery record for that exact concept. Mastery of another concept in the same course does not unlock it.

A future authenticated assessment command will evaluate construction attempts against authored criteria and transactionally record a passing assessment plus concept mastery. The Phase 1 service must not accept a client's bare `passed: true` as evidence of mastery. Public mutation routes remain absent until trusted identity and assessment evaluation are implemented.

Preview mode can demonstrate locked and unlocked curriculum states using fixed fixtures. The interface must label these as examples and must not imply that listening, clicking through, or a client-only toggle earned production mastery.

## 5. Active-pause audio contract

The required segment input is an array of `{ url: string; type: "prompt" | "answer"; pauseAfter: boolean }`. Optional identifiers and transcript metadata may be added without requiring them for the basic player API.

The component exposes `onThinkComplete`, which fires only when the learner deliberately completes a thinking pause. It also exposes completion and error callbacks as appropriate. A future speech adapter can invoke the same completion action through a narrowly typed imperative handle; it must not duplicate playback state management.

### State and sequencing

The player has distinct idle, loading, playing, manually paused, thinking, complete, and error states.

1. Playback starts only after a user gesture.
2. Each segment is played by an HTML audio element.
3. When a segment ends with `pauseAfter: true` and another segment remains, the player enters thinking state. It does not schedule an automatic answer.
4. In thinking state, the primary touch control or Spacebar calls the completion action, emits `onThinkComplete`, and attempts to play the next segment exactly once.
5. Segments without `pauseAfter` advance normally. Authors mark Thinking Method prompts with `pauseAfter: true`.
6. When the final segment ends, the session completes even if its flag is set; there is no nonexistent segment to resume.
7. A rejected playback promise or media error displays an actionable retry state. It never silently skips a prompt or reveals the next answer.

Thinking time is unlimited and is measured separately from drill recall latency. Revealing an answer does not submit correctness or mastery.

### Interaction and lifecycle

- Primary controls use at least 44-by-44 CSS-pixel touch targets, accessible labels, visible focus, and adequate contrast.
- The Spacebar shortcut ignores repeated keydown events, modifier combinations, inputs, textareas, editable content, and focused interactive controls with their own keyboard behavior.
- The interface de-emphasizes transcripts; an answer transcript is not shown before the learner requests the answer. Accessible optional text is available without requiring note-taking.
- Double taps and repeated callbacks cannot advance twice.
- Changing lessons resets the old sequence, cancels pending work, and prevents stale media events from advancing the replacement lesson. Equivalent arrays recreated during ordinary rendering do not restart playback.
- Unmounting pauses audio, releases listeners, and prevents subsequent state updates.
- Playback remains recoverable after browser interruption or autoplay rejection. No guarantee is made that a mobile browser will allow unattended background audio.
- Empty input renders a safe empty state. Invalid URLs fail visibly without crashing the page.

The shipped example must use real playable original clips or clearly identify unavailable media; silent placeholder audio must not be presented as a working spoken lesson.

## 6. Sentence-construction SRS

Implement the scheduler as a deterministic pure function receiving prior scheduling state, review quality, and an explicit review timestamp. Use the standard SM-2 quality scale of 0 through 5 and document the selected rounding rule.

Successful reviews use initial intervals of one and six days, followed by the previous interval multiplied by the ease factor. Failed reviews reset consecutive repetitions and schedule a one-day retry. Apply the SM-2 ease adjustment with a floor of 1.3. Use UTC timestamps and deterministic date arithmetic.

A separate grading function maps construction accuracy and recall latency to review quality. A fast wrong answer remains a failure. Correct but slower construction receives a lower passing quality than accurate, prompt recall. Missing timing data does not masquerade as a zero-millisecond response. Thresholds are explicit per drill rather than a universal language-proficiency benchmark.

The SRS is for retrieval practice after concept comprehension. Unlimited foundational thinking time is never a failing grade. No claim is made that the timing heuristic is a validated fluency measurement.

## 7. Dashboard and responsive presentation

The dashboard shows the current curriculum band, concepts mastered, and due SRS queue size. Demonstration values are supplied by a read-only fixture endpoint and visibly labeled as demonstration progress. Loading, retryable failure, and empty states are designed rather than omitted.

The visual direction is calm and audio-first: restrained colors, clear typography, generous spacing, and an obvious continue-learning action. Desktop may use a wider dashboard grid; mobile stacks content without horizontal overflow. The learning screen prioritizes listening and one large action over dense explanatory text.

Support keyboard navigation, reduced-motion preferences, and screen-reader status announcements without announcing every playback tick. Test at a narrow phone viewport and a conventional desktop viewport.

## 8. PWA boundary

Provide a manifest with the VerbaLibera name, standalone display mode, start URL, theme/background colors, and suitable regular and maskable icons. Register the service worker only in the browser, with versioned caches and explicit old-cache cleanup.

Phase 1 guarantees an offline fallback after a successful initial online visit, not a complete offline curriculum. Cache only deliberately public static fallback assets. Do not cache authenticated requests, progress mutations, arbitrary APIs, or private learner information. Navigation network failures should reach the fallback rather than an indefinite loading screen.

Document HTTPS requirements, platform-dependent installation UX, and the fact that repository publication does not deploy an HTTPS application. Development on localhost remains supported.

## 9. Voice validation: next phase

Keep speech recognition behind a browser capability adapter, independent of the audio player and curriculum evaluation policy.

1. Detect recognition support and target-language availability; provide keyboard/touch continuation when unavailable.
2. Request microphone access only after an explicit learner action and explain whether the selected implementation may process audio remotely.
3. Listen only during thinking or drill-response windows. Stop recognition before playing instructor audio so the instructor cannot satisfy the learner's answer.
4. Process final transcripts against authored accepted sentence variants. Normalize harmless casing and punctuation without erasing meaningful grammatical distinctions.
5. Distinguish no speech, denied permission, unsupported recognition, transport failure, ambiguous transcription, and genuinely incorrect construction. Recognition failure alone must not penalize retention.
6. Make answer reveal and correctness evaluation separate operations. Recognized speech can trigger the completion action, but only assessed construction can contribute to mastery.
7. Measure response onset separately from recognition/network completion so service latency does not become learner recall time.
8. Add a local Whisper integration only after profiling target-device performance and defining consent, retention, and model-download behavior.

Browser transcription is not a reliable standalone pronunciation grade. Store no raw recordings by default; any later retention needs explicit scope and consent. The implementation guide must verify current browser behavior against primary documentation before coding the adapter.

## 10. Verification and acceptance

Phase 1 is ready to publish when:

- Prisma schema validation and generated-client type checking pass.
- Committed PostgreSQL migrations contain the promised uniqueness, ownership, and check constraints. Any inability to apply them to a real database is disclosed.
- Audio tests prove the prompt does not auto-advance while thinking, deliberate continuation advances once, normal segments advance, empty/final segments are safe, media errors are recoverable, and lesson changes/unmounts prevent stale callbacks.
- Keyboard tests cover editable elements, native controls, modifier keys, and repeated keydowns.
- SRS tests cover first and second successes, later intervals, failures, ease floors, invalid input, deterministic due dates, incorrect fast responses, and untimed responses.
- Access-policy tests prove exact-concept mastery is required and playback completion is insufficient.
- The dashboard's loading, error, demo, and empty states are exercised.
- Production build, linting, and TypeScript checks pass.
- Browser checks verify narrow-mobile and desktop layouts, learning controls, manifest delivery, worker registration, and offline fallback where the available environment supports them.
- The README separates delivered functionality from deferred integrations and includes local setup, environment variables, database commands, test commands, architecture, and voice-validation next steps.
- No secrets, private learner data, unlicensed recordings, or generated dependency/build directories are published.

## 11. Publication and handoff

Before creating the repository, check whether `sleuthy-sloth/VerbaLibera` already exists. If it does, inspect its ownership and content before deciding whether it is the intended destination; do not overwrite an unrelated repository. If it is absent, create it as public, commit the verified application, and push the project.

The final handoff includes the GitHub URL, links to `schema.prisma` and `AudioPlayer.tsx`, the architecture documentation, verification results, and concrete remaining steps. Deployment credentials and authentication secrets are neither required for the Phase 1 preview nor committed to GitHub.
