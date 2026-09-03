# VoxLibre

[![Project status](https://img.shields.io/badge/status-active%20development-7c3aed?style=flat-square)](https://github.com/sleuthy-sloth/VoxLibre)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?style=flat-square&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![License: MIT](https://img.shields.io/badge/license-MIT-fbbf24?style=flat-square)](LICENSE)

VoxLibre is a language-learning foundation built around two complementary ideas:

1. **Thinking Method:** understand cognates and sentence structure before trying to recall a form.
2. **Audio drills:** turn an understood structure into fast substitution and transformation practice.

The first release is scoped to two independent English-source courses:

- English → French (`en → fr`)
- English → Italian (`en → it`)

Both are currently seeded as original A1 demonstration shells. The curriculum model supports CEFR levels A1–C2 and additional language pairs.

**Explore the project:** [Phase 1 design](docs/superpowers/specs/2026-08-30-voxlibre-phase-1-design.md) · [Quiet Ink redesign](docs/superpowers/specs/2026-09-01-quiet-ink-interface-redesign.md) · [local voice](docs/local-voice.md) · [audio licensing policy](#third-party-audio-policy)

## Current status

This repository contains the work completed so far in Phase 1 + Quiet Ink:

- Next.js App Router, React, TypeScript, Tailwind CSS, and TanStack Query bootstrap.
- Quiet Ink design system: canvas `#f4f3ee`/ink `#1a1f1e`/teal `#1e6563`, Newsreader/Instrument Sans/IBM Plex Mono via `next/font`, flat canvas, visible focus, reduced-motion.
- Prisma/PostgreSQL schema for users, languages, courses, concept blocks, drill items, SRS progress, audio segments, assessments, and mastery proofs.
- PostgreSQL migration constraints for language-pair validity, ordering, nonnegative values, audio parent exclusivity, SM-2 bounds, and passing assessment proofs.
- Original French and Italian A1 fixture data with explicitly unavailable audio URLs; no third-party course recordings are included.
- A tested construction SRS service: SM-2 quality mapping preserves response accuracy and recall latency without turning answer reveal into mastery.
- A tested concept-access policy: a passed assessment for the exact concept unlocks the related drills; progress is course-isolated.
- An accessible active-pause audio player: prompts pause indefinitely, then a deliberate touch or safe keyboard action reveals the answer. It handles audio failures, retries, cleanup, and rapid repeated input.
- Daily Path dashboard: generic course-segment selector (`aria-pressed`), Today 8-minute card (Review/Drill/Pattern + daily goal), sticky Progress snapshot with single review-queue metric. Responsive at 760px breakpoint.
- Guided session: stepline + progress bar (rail removed), deliberate "Reveal model answer" (reset on advance), honest unavailable-audio fallback,  `Nothing was saved` completion state.
- Read-only demo progress API (`GET /api/demo/progress`, `isDemo:true`, `no-store`) and optional local voice companion (`docs/local-voice.md`).
- PWA shell: manifest with `id`/`start_url`/`standalone`/Today shortcuts, offline fallback (`offline.html`), and a conservative static-only service worker (`public/sw.js`).
- Vitest, Testing Library, Playwright, lint, typecheck, and Prisma scripts.
- Design specifications and implementation plans in `docs/superpowers/` (Phase 1 → Gamified/Signal Pop → Quiet Ink). Quiet Ink is the approved direction and supersedes Signal Pop tokens.

Still deferred: authentication, persisted progress mutations, full course content, downloadable offline lessons, offline progress sync, browser speech adapter, and CEFR certification. Preview/demo values remain non-persistent.

## Delivery map

| Area | Delivered now | Next milestone |
| --- | --- | --- |
| Curriculum | CEFR-mapped schema, original French/Italian A1 fixtures, migration safeguards | Expand original, rights-cleared content + Kokoro-authored static clips |
| Learning engine | Exact-concept unlock policy, sentence-construction SM-2 scheduler, demo session composition | Persist authenticated progress, mastery rings, Anki export |
| Active thinking | Segmented active-pause player with keyboard/touch controls and error recovery | Connect Kokoro static assets, deliberate reveal, optional faster-whisper transcribe |
| Product shell | Quiet Ink dashboard (Daily Path), guided session, PWA manifest/offline/service worker | Tap-to-gloss, Phrasebook, refined icons/screenshots |
| Quality | 85 Vitest tests, lint, typecheck, Prisma validate/generate, Next production build | Browser E2E at 1440px/390px, real-DB migration smoke, deployment checks |

## Product principles

- Answer reveal is never mastery. A learner must pass a trusted concept assessment before related drills unlock.
- French and Italian progress are isolated by concept and course; mastery in one course cannot unlock the other.
- Thinking pauses are indefinite and do not penalize the learner. Recall latency is measured only during later drills.
- The screen is intentionally quiet. Large touch targets and keyboard controls support looking away while thinking.
- Preview values are not account data and do not certify CEFR proficiency.
- Content is original or must have verified redistribution rights. The current fixture audio uses `unavailable://` markers rather than pretending that silent placeholders are lesson recordings.

## Architecture

```text
VoxLibre/
├── prisma/
│   ├── schema.prisma                 # PostgreSQL curriculum and learning data
│   ├── migrations/                   # Generated schema + PostgreSQL checks/triggers
│   └── seed.ts                       # en→fr and en→it original fixtures
├── public/
│   ├── sw.js / offline.html / manifest # PWA shell
│   └── audio/                        # Kokoro-authored static clips (when generated)
├── services/voice/                   # Optional local Kokoro + faster-whisper sidecar
├── src/
│   ├── app/                          # Next.js App Router pages, layout, manifest
│   ├── components/audio/              # Active-pause audio player and availability rules
│   ├── components/dashboard/          # DailyPathDashboard (Quiet Ink)
│   ├── components/session/            # GuidedSession (stepline + reveal)
│   ├── components/pwa/                # PWA registrar
│   ├── features/curriculum/          # Typed course fixture + access policy
│   ├── features/progress/            # Demo progress types + hooks
│   ├── features/session/             # Demo session composition
│   ├── features/srs/                  # Construction quality and SM-2 scheduling
│   ├── lib/                          # Prisma client, React Query provider, voice service
│   └── test/                         # Shared Vitest setup
├── tests/                             # Unit/component tests (85)
└── docs/superpowers/                  # Approved designs and plans (Phase 1 → Quiet Ink)
```

The approved designs are [VoxLibre Phase 1 Design](docs/superpowers/specs/2026-08-30-voxlibre-phase-1-design.md) (foundation), [Gamified Dashboard](docs/superpowers/specs/2026-08-31-gamified-dashboard-and-local-voice-design.md) (superseded by Quiet Ink), and [Quiet Ink](docs/superpowers/specs/2026-09-01-quiet-ink-interface-redesign.md) (current UI direction). Plans are in `docs/superpowers/plans/`.

## Local development

### Requirements

- Node.js 20 or newer
- npm
- PostgreSQL 14 or newer for applying migrations and running the seed

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

### Environment

Copy `.env.example` to `.env` and set `DATABASE_URL` only when working with a local PostgreSQL database. Do not commit `.env` or credentials.

```bash
cp .env.example .env
```

Validate and generate the Prisma client:

```bash
npm run prisma:format
npm run prisma:validate
npm run prisma:generate
```

With a configured database, apply the migration and seed original fixtures:

```bash
npm run prisma:migrate
npm run prisma:seed
```

The committed migration is the source of truth for PostgreSQL-only constraints. The current implementation environment did not have `DATABASE_URL`, so migration application and seeding were not attempted.

## Verification commands

```bash
npm run test                 # Vitest unit/component tests
npm run lint                 # ESLint
npm run typecheck            # TypeScript without emitting files
npm run build                # Next production build
npm run test:e2e             # Playwright browser tests (as they are added)
```

The delivered foundation passes its 85 Vitest tests, lint, typecheck, Prisma validate/generate, and Next production build (Turbopack). `npm audit` currently reports transitive dependency findings that should be reviewed before production deployment. Applying the committed migration to a real PostgreSQL instance still requires `DATABASE_URL` (see below).

## Database model

`prisma/schema.prisma` includes the required models:

- `User`, `Language`, and `Course` establish account and language-pair ownership.
- `ConceptBlock` stores structural explanations, cognate rules, CEFR level, and ordered content.
- `DrillItem` stores substitution/transformation prompts and target-language accepted responses.
- `UserProgress` stores per-drill SM-2 state: ease, interval, repetitions, due date, lapses, accuracy, and recall latency.
- `AudioSegment` makes prompt and answer clips independently addressable and marks `pauseAfter`.
- `ConceptAssessment` and `ConceptMastery` separate assessment evidence from SRS retention and enforce exact-concept drill unlocking.

The migration uses PostgreSQL checks and a trigger to prevent a mastery row from referencing a failed or mismatched assessment. Prisma validation does not replace applying the migration to a real database.

## Audio and voice roadmap

The active-pause player is an intentionally isolated client component. Its contract accepts segments shaped like:

```ts
type AudioSegment = {
  url: string;
  type: 'prompt' | 'answer';
  pauseAfter: boolean;
};
```

After a prompt ends with `pauseAfter: true`, playback remains paused until a deliberate touch, keyboard, or future speech-validation action calls `onThinkComplete`. The answer is never auto-revealed. The component avoids stealing input shortcuts, reports media failures in the UI, and exposes a retry path rather than silently skipping a learner's thinking turn.

Voice validation will be added behind a capability adapter. It will request microphone access only after an explicit action, stop recognition before instructor audio, normalize harmless punctuation/casing, distinguish recognition errors from incorrect constructions, and store no raw recordings by default. Browser recognition is not treated as a standalone pronunciation grade. See the forthcoming implementation notes in `docs/voice-validation.md` when that task lands.

## Security and privacy

- No authentication or anonymous mutation route is included yet.
- Future mutation services must accept a trusted authenticated user identity, never a client-selected user ID.
- Do not cache authenticated requests, progress mutations, or learner data in the future PWA service worker.
- Do not add copyrighted course recordings or private learner data to this public repository.

## Third-party audio policy

Language Transfer's French and Italian courses are freely playable and downloadable, but availability to listeners is not an explicit redistribution license for VoxLibre. We will not copy, slice, host, bundle, stream, or otherwise redistribute Language Transfer audio or transcripts unless the rightsholder provides written permission or publishes an explicit license that permits VoxLibre's intended use.

Until then, VoxLibre uses only original recordings or third-party audio accompanied by a documented compatible license, source URL, attribution, and any required share-alike or non-commercial compliance. The current fixture URLs intentionally remain unavailable markers. See [Language Transfer’s course page](https://www.languagetransfer.org/courses) and [FAQ](https://www.languagetransfer.org/faq) for the currently published listener/download information.

## License

VoxLibre is released under the [MIT License](LICENSE). The license covers this repository's original source code and original demonstration content. Third-party assets, recordings, or transcripts must be added only with compatible licensing and explicit attribution where required.

## Contributing

Read the design and implementation plan before making changes. New learner-facing behavior should follow test-first development and include keyboard, mobile, accessibility, and error-state coverage. Keep course content provenance explicit and preserve the distinction between answer reveal, concept mastery, and SRS review.
