# Privacy — what is and isn't logged

VerbaLibera is built for production observability **without surveillance**. We need enough signal to know the service is healthy, but we never track learners.

## What is logged

Every API route is wrapped with `withObserve` (`src/lib/observe.ts`). On each request the wrapper records only three safe fields:

- **route** — the matched API path, e.g. `/api/voice/transcribe`, `/api/demo/progress`
- **status** — the HTTP status code returned (200, 400, 413, 500, etc.)
- **duration** — wall-clock time in milliseconds (`durationMs`) from handler entry to response

On failure an additional `error` field contains a truncated, sanitized error message (at most 500 characters, typically `error.message`). No stack trace, no request headers, no user identifier.

Logging sinks:

- `console.error` — JSON line `{"route": "...", "status": 200, "durationMs": 42}` visible in server/container logs
- optional `SENTRY_DSN` — if `process.env.SENTRY_DSN` is set, the same sanitized payload is POSTed fire-and-forget to that URL. If unset, nothing is sent.

Both sinks receive **only** `route`/`status`/`duration` (`durationMs`) and the sanitized `error`.

## What is never logged

We **never** log request or response bodies, and we **never** log:

- **audio** — no raw learner recordings, no `audio/webm` or `audio/wav` bytes, no audio file names beyond the static lesson assets already in `public/audio`
- **transcript** — no speech-to-text output, no learner utterance text, no `transcript` field from the voice companion
- **credential** — no WebAuthn credential ID, public key, counter, or transports; no session token, cookie value, or `accountIdentifier`
- **body** — no JSON payload (`response`, `courseSlug`, `drillId`, `verdict`, `clientMutationId`, etc.), no FormData, no multipart boundaries
- no `Authorization` header, no IP address, no `User-Agent`, no geo, no learner identifier beyond the route itself

In short: observability answers “which route, what status, how long?” — not “who said what.”

## Verification

- `tests/observe.test.ts` asserts that `observe` and `withObserve` never emit `transcript`/`audio`/`credential`/`body`, that they always emit `route`/`status`/`duration`, and that this document mentions `route`/`status`/`duration` in the “what is logged” section while stating that `audio`/`transcript`/`credential` are never logged.
- `src/lib/observe.ts` is intentionally tiny (≈40 lines) and strips any extra fields — even if a caller passes `transcript`/`audio`/`credential`/`body`, they are ignored and never serialized.
- All `src/app/api/*` handlers are wrapped with `withObserve('/api/...', handler)` so no route can bypass the policy.

## Learner controls

All voice features remain opt-in (explicit browser action to start recording), transient (transcript is checked locally and discarded), and never persisted. See `docs/local-voice.md` for the voice boundary and `docs/asset-provenance.md` for committed lesson audio provenance.
