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

**Explore the project:** [design](docs/superpowers/specs/2026-08-30-voxlibre-phase-1-design.md) · [development plan](docs/superpowers/plans/2026-08-30-voxlibre-phase-1.md) · [audio licensing policy](#third-party-audio-policy)

## Current status

This repository contains the work completed so far in Phase 1:

- Next.js App Router, React, TypeScript, Tailwind CSS, and TanStack Query bootstrap.
- Accessible responsive landing shell with both initial courses.
- Prisma/PostgreSQL schema for users, languages, courses, concept blocks, drill items, SRS progress, audio segments, assessments, and mastery proofs.
- PostgreSQL migration constraints for language-pair validity, ordering, nonnegative values, audio parent exclusivity, SM-2 bounds, and passing assessment proofs.
- Original French and Italian A1 fixture data with explicitly unavailable audio URLs; no third-party course recordings are included.
- A tested construction SRS service: SM-2 quality mapping preserves response accuracy and recall latency without turning answer reveal into mastery.
- A tested concept-access policy: a passed assessment for the exact concept unlocks the related drills; progress is course-isolated.
- An accessible active-pause audio player: prompts pause indefinitely, then a deliberate touch or safe keyboard action reveals the answer. It handles audio failures, retries, cleanup, and rapid repeated input.
- Vitest, Testing Library, Playwright, lint, typecheck, and Prisma scripts.
- Design specification and implementation plan in `docs/superpowers/`.

Still planned: the responsive dashboard and learning route, read-only demo query, PWA shell, Web Speech API adapter, authentication, persisted progress mutations, full course content, and offline lesson synchronization. The next implementation tasks are recorded in the plan and must preserve the no-anonymous-mastery boundary.

## Delivery map

| Area | Delivered now | Next milestone |
| --- | --- | --- |
| Curriculum | CEFR-mapped schema, original French/Italian A1 fixtures, migration safeguards | Expand original, rights-cleared content |
| Learning engine | Exact-concept unlock policy and sentence-construction SM-2 scheduler | Persist authenticated progress and assemble lesson sessions |
| Active thinking | Segmented active-pause player with keyboard/touch controls and error recovery | Connect licensed/original recordings and voice validation |
| Product shell | Responsive landing experience and course discovery | Dashboard, lesson route, and offline PWA behavior |
| Quality | Unit/component coverage, linting, type checking, Prisma validation | Browser E2E coverage and production deployment checks |

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
├── src/
│   ├── app/                          # Next.js App Router pages and layout
│   ├── components/audio/              # Active-pause audio player and availability rules
│   ├── features/curriculum/          # Typed course fixture boundary
│   ├── features/srs/                  # Construction quality and SM-2 scheduling
│   ├── lib/                          # Prisma client and React Query provider
│   └── test/                         # Shared Vitest setup
├── tests/                             # Unit/component tests
└── docs/superpowers/                  # Approved design and implementation plan
```

The approved design is [VoxLibre Phase 1 Design](docs/superpowers/specs/2026-08-30-voxlibre-phase-1-design.md). The task-by-task execution plan is [VoxLibre Phase 1 Implementation Plan](docs/superpowers/plans/2026-08-30-voxlibre-phase-1.md).

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

The delivered foundation has passed its unit/component tests, lint, typecheck, and Prisma validation. A later Turbopack build attempt was blocked by the execution environment's port-binding permissions; this is documented rather than presented as a product failure or a passing build. `npm audit` currently reports transitive dependency findings that should be reviewed before production deployment.

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
