# VoxLibre

Language learning through sentence construction. The app shows you a prompt, plays audio if it's available, and waits for you to think before revealing the answer. No timers rushing you, no auto-advance.

![Dashboard on desktop](docs/screenshots/dashboard-desktop.png)

![Session on desktop](docs/screenshots/session-desktop.png)

The screenshots above are the live app running locally. The dashboard is mobile-first, so the narrow layout is the one most learners will see.

![Dashboard on mobile](docs/screenshots/dashboard-mobile.png)

![Session on mobile](docs/screenshots/session-mobile.png)

## What this is

VoxLibre is a preview implementation of an active-pause language learning tool. The current release has two original A1 course shells:

- English → French
- English → Italian

Each course is made of concept blocks and sentence-construction drills. The session route walks through a fixed order: due reviews first, then a drill round, then a new pattern if there's room. It is deliberately bounded to about eight minutes.

The audio player is the part that gets the most attention. After a prompt plays, the screen pauses indefinitely. A tap, click, or safe keyboard action reveals the answer. Nothing auto-plays the next step, and nothing penalizes you for taking time to think.

## What works and what doesn't

This repo is a working preview, not a finished product.

Working:

- Two A1 course shells with original French and Italian fixture data.
- Responsive dashboard and guided session route.
- Active-pause audio player with keyboard, touch, and error handling.
- Prisma/PostgreSQL schema for users, courses, concepts, drills, progress, and audio segments.
- SM-2 sentence-construction scheduler (quality mapping keeps answer reveal from counting as mastery).
- Exact-concept access policy: a passed assessment unlocks the related drills.
- Safe PWA shell with original generated assets and a static-only service worker.
- Optional local FastAPI voice sidecar using Kokoro for TTS and faster-whisper for STT.

Not working yet:

- Authentication. There are no accounts, so all progress is preview-only.
- Persistence mutations. SRS writes, mastery records, and progress updates are not saved.
- Real audio fixtures. Prompt URLs are intentionally marked `unavailable://` until licensed or original recordings are added.
- Offline sync for mutable learner data.
- Hosted voice service. The sidecar is local-only.

Privacy-wise, no learner audio is persisted by default. The voice route returns only a transcript and status; it does not store recordings or transcripts.

## Quick start

You need Node.js 20 or newer, npm, and optionally PostgreSQL 14 or newer if you want to apply migrations and run seeds.

```bash
npm install
cp .env.example .env
```

If you have a local database, set `DATABASE_URL` in `.env`, then:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

If you just want to run the app without a database, the preview uses fixture data and the dashboard snapshot endpoint works without `DATABASE_URL`:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Running tests

```bash
npm run test          # Vitest unit and component tests
npm run test:e2e      # Playwright browser tests
npm run lint          # ESLint
npm run typecheck     # TypeScript, no emit
npm run build         # Next production build
```

For the Python voice service:

```bash
cd services/voice
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/pytest
```

## Voice sidecar

The optional voice companion runs locally and is called only through server-only Next.js routes. It does not download model weights during the default test suite. See [docs/local-voice.md](docs/local-voice.md) for setup, environment variables, and privacy notes.

## Status and roadmap

VoxLibre is in active development. The immediate next steps are authentication, persisted progress mutations, full course content, real audio fixtures, and offline lesson sync. The design and implementation plan lives in [docs/superpowers/](docs/superpowers/).

## License

Released under the [MIT License](LICENSE). The license covers the original source code and demonstration content. Third-party assets, recordings, or transcripts must be added only with compatible licensing and attribution.
