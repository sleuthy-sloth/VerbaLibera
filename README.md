# VerbaLibera

[![CI](https://github.com/sleuthy-sloth/VerbaLibera/actions/workflows/ci.yml/badge.svg)](https://github.com/sleuthy-sloth/VerbaLibera/actions/workflows/ci.yml)
[![GitHub release](https://img.shields.io/github/v/release/sleuthy-sloth/VerbaLibera)](https://github.com/sleuthy-sloth/VerbaLibera/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-teal.svg)](LICENSE)
[![Live demo](https://img.shields.io/badge/demo-live-teal)](https://verbalibera.vercel.app)
[![Offline PWA](https://img.shields.io/badge/offline-PWA-teal)](public/sw.js)
[![No runtime AI](https://img.shields.io/badge/runtime_AI-none-teal)](docs/astra/phase-status.md)

Language learning through practical sentence construction. VerbaLibera introduces a pattern, asks you to build it yourself, then lets you reveal a model answer — no timers, no punishing progress bars.

Live demo: [verbalibera.vercel.app](https://verbalibera.vercel.app)

## What this is

VerbaLibera is a free, offline-capable language app built on the [Language Transfer](https://www.languagetransfer.org/) Thinking Method: discover the pattern first, think before answering, never memorize in isolation. It covers French, German, Italian, Portuguese, and Spanish at the A1 foundation level.

The course workspace is available as:

- **Web app** — the hosted demo above, or run locally with `npm run dev`
- **Portable HTML** — one file you can keep on your desktop and open in any browser
- **Desktop app** — unsigned Apple Silicon DMG with local PostgreSQL storage

None of these require an account, server, or internet connection for practice. Guest progress stays in your browser.

## Course structure

Each foundation lesson follows the same loop: explanation and worked examples → zero-recall word choice → sentence building → listening track. The **Course path** shows what's next, what's unlocked, and what needs review.

French and Italian have the broadest coverage. German, Portuguese, and Spanish each have a four-lesson route through introductions, café requests, and numbers.

### Listen tracks

The **Listen** tab has audio-only Thinking Method tracks for walks and screen-off study. Each track is ~10 minutes with think-pauses and target-language reveals. Current tracks:

- 🇫🇷 French — Identity and introductions
- 🇮🇹 Italian — At the market
- 🇪🇸 Spanish — Introductions and café
- 🇧🇷 Portuguese — Introductions and café
- 🇩🇪 German — Introductions and café

Tracks are built locally with Kokoro TTS and can be saved as MP3s. Provenance and transcription review are in `docs/audio-provenance/`.

## Building from source

You need Node.js 22+ and npm. PostgreSQL is optional.

### Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### With Docker

```bash
cp .env.example .env
docker compose up --build
```

### Tests

```bash
npm run test          # unit + component
npm run test:e2e      # Chromium
npm run test:e2e:portable  # single-file artifact
npm run content:validate
npm run lint
npm run typecheck
```

### Voice sidecar (optional)

Local TTS/STT with Kokoro, no API keys needed:

```bash
cd services/voice
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

See [docs/local-voice.md](docs/local-voice.md) for the full setup.

## Accounts

Passkey accounts (WebAuthn, no passwords) are optional. Guest visitors see honest blank state — no placeholder progress. Signing in persists reviews and derived lesson completion across devices via Prisma/PostgreSQL.

Privacy: no learner audio is stored by default. The voice route returns only a transcript and discards the recording. Typed answers are checked locally in the browser.

## Known limits

- Partial A1 only — no B1 content yet
- Foundation lessons are machine-authored and consistency-checked; native-speaker review is still open
- Placement is a rough starting suggestion, not a CEFR certification
- Physical iPhone testing (Add to Home Screen, offline relaunch, background/foreground) is still open
- No hosted voice service — the sidecar is local-only

If you spot an unnatural phrase or mistake, [file a content correction](https://github.com/sleuthy-sloth/VerbaLibera/issues/new?template=content-correction.yml) with the lesson, the prompt, and what it should say.

## Deploy to Vercel

1. Create a free Postgres at [neon.tech](https://neon.tech)
2. Import `sleuthy-sloth/VerbaLibera` into a personal Hobby Vercel project
3. Set env vars: `DATABASE_URL`, `AUTH_JWT_PRIVATE_KEY`/`AUTH_JWT_PUBLIC_KEY`, `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN`
4. Deploy — `vercel.json` handles migrations and build

Generate the ES256 key pair:

```bash
openssl ecparam -genkey -name prime256v1 -noout -out private.pem
openssl pkcs8 -topk8 -nocrypt -in private.pem -out private-pkcs8.pem
openssl ec -in private.pem -pubout -out public.pem
```

## Status

VerbaLibera is in active development. See [docs/astra/phase-status.md](docs/astra/phase-status.md) for what's next. The design and implementation plan lives in [docs/superpowers/](docs/superpowers/).

## License

MIT. See [LICENSE](LICENSE). Third-party assets must be added only with compatible licensing and attribution.
