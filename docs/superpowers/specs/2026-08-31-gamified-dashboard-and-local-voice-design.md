# VerbaLibera Gamified Dashboard and Local Voice Design

Date: 2026-08-31

Status: Approved in conversation; this document is awaiting user review before implementation planning.

## 1. Objective and scope

Refocus VerbaLibera from the Thinking Method to a practical, drill-first language-learning experience. The product retains proven retrieval practice: sentence-construction SRS, DLI/FSI-style substitution and transformation drills, model audio, and deliberate spoken responses. It removes cognate-led structural lessons, indefinite “thinking” framing, and user-facing references to the Thinking Method.

The immediate goal is a mobile-first dashboard that feels motivational and polished without becoming punitive. The selected experience is **Daily Path**: a short guided session is the primary action, supported by a streak, XP, daily goal, course progress, and a small SRS queue indicator. The visual direction is **Signal Pop**: original indigo, coral, lime, and off-white artwork with expressive abstract language/speech motifs.

The scope also establishes an optional self-hosted voice companion: Kokoro generates original instructional TTS audio and faster-whisper transcribes short learner responses. It is intentionally optional; a learner can complete every session by touch or keyboard when it is unavailable.

Phase 1 delivers:

- A responsive, accessible Daily Path dashboard for English → French and English → Italian.
- A deterministic demo guided-session composition from sentence-construction reviews and drill practice.
- Gentle, non-punitive progress feedback: XP, a daily goal, a streak, and course completion.
- A learner-facing vocabulary migration from Thinking Method concepts to practical patterns and drills.
- Original Signal Pop visual assets, including PWA icons, generated with the built-in image tool and stored in the repository with provenance.
- A documented, local-only Python voice-service contract for Kokoro TTS and faster-whisper STT, with no raw-audio persistence by default.
- Tests for dashboard states, responsive behavior, session composition, progress calculations, and voice-service failure handling.

This phase does not add authentication, real user mutations, social competition, hearts, leagues, leaderboards, language-level certification, cloud voice processing, or a browser-only local-model runtime.

## 2. Product principles

- **Guide, do not pressure.** A session is a recommended next action, never a penalty loop. There are no hearts, forced countdowns, streak loss screens, or comparative ranking.
- **Practice sentences, not isolated lists.** SRS continues to schedule authored sentence constructions; FSI/DLI substitution and transformation drills supply repetition and automation.
- **Reward completion honestly.** XP, streaks, and goals reflect practice events in preview mode. They never represent proficiency, mastery, or assessment success.
- **Keep learning available.** Speech, audio, and online services augment the experience; they do not gate it.
- **Keep it original.** VerbaLibera may be inspired by the clarity and motivation of modern language products but must not reproduce their mascots, artwork, copy, sound, or brand treatment.
- **Protect learner privacy.** Local voice processing is opt-in and ephemeral. A transcript is an input to the current answer check, not an account record by default.

## 3. Learner experience

### Dashboard: Daily Path

The dashboard has one dominant action: `Continue 8-minute session`. Its content is assembled in this order:

1. Due sentence-construction reviews, if any.
2. An FSI/DLI substitution or transformation drill round tied to the current course.
3. One new practical pattern only when the review load leaves room in the target session.

The dashboard also shows:

- A small daily-goal progress indicator, expressed as completed practice steps out of a modest target.
- A streak labelled as a **practice flow**, not a punitive streak-loss mechanic.
- Total demonstration XP, clearly labelled as preview progress until authenticated persistence exists.
- The selected course, current unit/pattern, and course-completion progress.
- A due-review count that explains why the session starts with retrieval practice.
- A secondary course switcher that lets a learner choose French or Italian without burying the Daily Path action.

On narrow screens, content forms a single column with the primary action within the first viewport. Desktop widens the information grid without changing the action hierarchy. All controls have 44 CSS-pixel minimum touch targets, visible focus, accessible names, and reduced-motion behavior.

### Guided session

A session begins with a compact “today’s path” introduction, then moves through individual practice cards. Cards can use model audio, a prompt, tap/keyboard continuation, optional speech, a self-check/reveal, and a clear response outcome. The old Thinking Method wording is removed:

| Remove | Replace with |
| --- | --- |
| Thinking Method | Practical patterns + drill practice |
| Concept block | Pattern / unit |
| Think pause | Response turn |
| `onThinkComplete` user language | Continue / submit response |
| Cognate rule | Brief usage model where an authored pattern needs one |

The existing audio component may still support deliberate pauses, but it becomes a generic response-turn control. It must not market the pause as a Thinking Method exercise.

### Gentle progress system

- Each completed practice card contributes preview XP and daily-goal progress.
- Completing a day’s target extends a practice-flow streak; missed days do not show punishment UI.
- Completing a session produces a small Signal Pop celebration that respects `prefers-reduced-motion`.
- Course progress is a descriptive count of completed units/patterns, not a CEFR claim.
- Recall latency remains an input to SRS quality mapping, but the UI presents supportive pacing feedback rather than a punitive score.

## 4. Curriculum and SRS boundary

The existing Prisma `ConceptBlock`, `ConceptAssessment`, and `ConceptMastery` records retain their integrity relationships for this phase. User-facing names and new authoring copy become **patterns**, **assessments**, and **drills**; a disruptive database-model rename is deferred until a dedicated data migration is justified.

The content model changes as follows:

- New French and Italian fixtures use practical grammar/usage patterns rather than cognate or Thinking Method explanations.
- Each pattern links to FSI/DLI-style sentence drills and their target responses.
- A successful assessment remains the only basis for production drill unlocks. Watching, listening, revealing an answer, gaining XP, or completing a preview session never writes mastery.
- The existing SM-2 scheduler and quality mapper remain pure domain services. Later authenticated persistence uses them after an answer has been evaluated by an authored policy.

## 5. Local voice architecture

### Runtime boundary

Add a separate Python FastAPI service under `services/voice/`. It starts only when a local/self-hosted operator opts in. Next.js communicates with it through server-side routes or a clearly configured same-host proxy; the browser never receives a model-service secret or a cloud fallback endpoint.

```text
Browser microphone (explicit action)
        │ short audio blob
        ▼
Next.js voice route ─────▶ Local voice service (FastAPI)
                                  ├── Kokoro: authored TTS generation
                                  └── faster-whisper: transient transcription
        ▼
typed transcript / result only
        ▼
authored answer matcher → session UI
```

The local voice service defines:

- `GET /health` — reports only capability and configured language/voice availability.
- `POST /tts` — accepts authored text, target-language code, and a permitted voice; returns generated WAV/MP3 bytes only for operator-authorized content generation.
- `POST /transcribe` — accepts a short, size-limited learner recording plus the expected language; returns final transcript text and diagnostic status.

The service rejects oversized or unsupported media, does not persist raw audio, does not retain transcripts by default, and returns structured availability/errors. A microphone denial, unavailable service, unsupported language, no speech, or transcription failure leaves the learner on the normal tap/keyboard path and does not lower SRS quality.

### Kokoro TTS

Kokoro is used for original instructional voice clips. Authoring generates stable, reviewable audio files ahead of time; lesson playback does not block on inference. Generated clips carry provenance that identifies Kokoro, selected voice, model version, source text, and creation date. The project documents the model’s license and validates voice/language availability before publishing course material.

### faster-whisper STT

faster-whisper receives an explicit target language, local model/device configuration, and a short response window. The first supported configuration is CPU `int8`, with optional CUDA configurations documented separately. The model is initialized once per service process, with bounded request concurrency to avoid memory pressure. Transcript matching is authored and normalized only for harmless formatting differences; it must not treat transcription as a pronunciation grade.

### PWA and hosting truthfulness

The PWA is installable as a web application, but installation does not make native Python models run on a phone. The local service is suitable for a developer machine or self-hosted deployment where it runs alongside the application. A future device-local model feature requires a separate native or browser-runtime design, hardware profiling, package-size budget, consent model, and offline-download plan.

## 6. Visual asset system

Use the built-in image-generation tool to produce original raster assets for the project:

- `public/brand/verbalibera-app-icon-source.png`: a square Signal Pop icon with an abstract coral speech wave and lime motion accent on indigo; no text, no brand imitation, and a strong silhouette at 32 pixels.
- Derived `192×192` and `512×512` regular and maskable PWA PNG icons. The maskable version maintains safe-zone padding and does not use a transparent background.
- `public/illustrations/`: one original, inclusive abstract “daily practice” illustration that supports the dashboard but does not convey a real learner’s identity or mimic another product’s artwork.

Every generated asset is visually inspected, saved inside the repository, and recorded in `docs/asset-provenance.md` with prompt, tool, intended use, generation date, and license/provenance status. No third-party logos, trademarks, known mascots, or generated in-image text are accepted.

Signal Pop uses these application design tokens:

| Token | Value | Use |
| --- | --- | --- |
| Ink | `#20233D` | primary type, high-contrast action |
| Indigo | `#7068FF` | brand and progress |
| Coral | `#FF765F` | celebration and emphasis |
| Lime | `#B8F266` | positive completion accent |
| Cloud | `#F8F7FF` | canvas |

## 7. Application architecture

Add narrow boundaries rather than a single dashboard component:

```text
src/
├── app/
│   ├── api/demo/progress/route.ts     # read-only preview snapshot
│   ├── learn/[courseSlug]/page.tsx    # guided-session entry point
│   ├── manifest.ts                    # app metadata and Signal Pop icons
│   └── page.tsx                       # Daily Path dashboard
├── components/
│   ├── dashboard/                     # presentational cards and action hierarchy
│   ├── session/                       # session card, progress, completion state
│   ├── audio/                         # generic response-turn player
│   └── voice/                         # opt-in browser recording/capability UI
├── features/
│   ├── progress/                      # typed demo snapshot and gentle progress math
│   ├── session/                       # pure session composition service
│   ├── curriculum/                    # patterns, authored content, access policy
│   └── srs/                           # existing scheduler and quality functions
└── lib/
    └── voice-service.ts               # server-only local-service client
services/voice/
├── app.py                             # FastAPI endpoints and request bounds
├── service/                           # TTS/STT adapters and configuration
├── tests/                             # Python contract tests
└── requirements.txt                   # explicitly pinned local dependencies
```

Client components receive only serializable dashboard/session data. The demo progress endpoint is `no-store`, read-only, and never accepts a user identifier. The voice-service client is server-only; it checks configuration and health before proxying a short request. React Query manages only the preview snapshot and uses an accessible loading/error/retry state.

## 8. Error handling and accessibility

- The dashboard renders deliberate loading, error/retry, no-reviews, and no-current-course states.
- Unavailable seeded audio remains visibly unavailable rather than pretending to be an instructional recording.
- A voice failure preserves keyboard/touch controls and reports a short screen-reader-visible message without exposing raw service errors.
- Browser recording begins only after an explicit action and stops before model audio plays.
- Interactive celebration visuals are motion-reduced or static when the user requests reduced motion.
- Colors, focus rings, semantic headings, button labels, and status announcements meet the existing accessibility baseline.

## 9. Verification and acceptance

Implementation is ready to publish when:

- Dashboard tests prove the primary session action, French/Italian course switching, loading/error/empty states, daily goal, XP, due count, and responsive card semantics.
- A pure session-composition test proves reviews precede drill rounds, session size is bounded, and a new pattern is introduced only when capacity permits.
- Existing SRS and exact-concept access tests remain green after vocabulary/content migration.
- Audio tests prove generic response turns retain safe keyboard, media error, cleanup, and single-advance behavior; no UI copy references the Thinking Method.
- Voice client tests prove unavailable service, microphone rejection, malformed transcript result, and service errors preserve non-voice progression.
- Python contract tests prove audio-size/type limits, no-persistence defaults, target-language validation, and stable diagnostics.
- Generated icon/illustration assets exist at the exact manifest dimensions and have provenance documentation.
- The PWA manifest refers to original Signal Pop assets with correct regular and maskable icon metadata.
- Vitest, ESLint, TypeScript, Prisma validation, and the available production build/browser checks pass.
- The README distinguishes preview experience from persistence, local voice from hosted voice, original assets from third-party content, and delivered work from future scope.

## 10. Explicit non-goals and deferred decisions

- No user-supplied voice cloning or custom voice training.
- No learner audio, transcript, XP, streak, or assessment persistence without authentication and explicit data-policy work.
- No external automatic-speech-assessment claim and no pronunciation score.
- No cloud fallback for the local voice service.
- No attempt to run Python Kokoro/faster-whisper directly in the browser/PWA.
- No direct or derivative use of Mango or Duolingo brand assets, names in product UI, characters, sound effects, or lesson content.
