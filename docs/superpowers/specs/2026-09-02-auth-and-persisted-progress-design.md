# Authentication and persisted progress design

## Objective

Give learners passkey sign-in and real, account-scoped SM-2 progress while keeping a fully truthful preview mode for signed-out visitors. This changes the app's core truth: learner progress becomes persisted data for signed-in users, and every saved/preview claim in the UI derives from one source.

## Background

The Prisma schema already models per-user SM-2 state (`UserProgress` with ease/interval/repetitions/dueAt/lapse, `ConceptAssessment`, `ConceptMastery`) and `User.accountIdentifier @unique`, but nothing writes to them: every visitor shares one static `DemoProgressSnapshot` from `GET /api/demo/progress`. A pure SM-2 scheduler and a pure daily-session composer exist client-side. There are no auth libraries and no session models.

## Authentication (SME-reviewed)

- **Passkey-only (WebAuthn) sign-in.** No SMTP dependency, no password storage, phishing-resistant; fits the operator-plus-few-learners deployment. `User.accountIdentifier` holds a human-readable label (e.g. an email for display); the WebAuthn credential ID is the auth join key. OAuth and email+password are explicitly deferred.
- **Stateless session:** a 30-minute httpOnly, secure, sameSite=lax JWT signed ES256 with an operator-managed key on disk (`jose`). No Session table; revocation is key rotation. A refresh on activity extends the window.
- **Prisma addition:** `model Credential { id String @id @default(cuid()); userId String; credentialId String @unique; publicKey Bytes; counter BigInt @default(0); transports String?; createdAt DateTime @default(now()); user User @relation(fields: [userId], references: [id], onDelete: Cascade); @@index([userId]) }` — signature counter for clone detection.
- **Next.js 16 mechanics:** session guarding lives in the new root `proxy.ts` convention (middleware.js is deprecated in Next 16); mutations use the double-submit cookie CSRF pattern; Server Actions are avoided for auth-sensitive writes in favor of route handlers.

## Progress persistence (SME-reviewed)

- **Read model:** the `DemoProgressSnapshot` client contract is unchanged; for signed-in users it is composed server-side from `UserProgress`/`ConceptMastery` rows and the due-review count (`dueAt <= now`), computed per request. Signed-out visitors keep today's fixture snapshot (preview mode).
- **Write path:** one auth-guarded `POST /api/progress/review` accepting `{drillItemId, quality, latencyMs, clientMutationId?}` with a ≤1 KB body bound. In a single transaction: upsert `UserProgress` (SM-2 computed server-side by the existing pure scheduler — it moves out of client-only use) and insert a `ReviewLog` row for idempotency (`@@unique([userId, drillItemId, clientMutationId])`; duplicate submissions return the cached result). Response: `{nextReviewAt, intervalDays}`.
- **Quality mapping:** a named pure function `verdict + latencyMs → quality 0–5`: exact + <3s → 5; exact + 3–8s → 4; exact + >8s → 3; close + <3s → 3; close + 3–8s → 2; close + >8s → 1; try_again → 0. Latency is measured from prompt render to submit on the client and validated to a sane bound server-side.
- **Daily goal / review queue:** derived per request from `dueAt` counts — no denormalized counters at this user count.
- **Content seeding:** fixtures upsert to `DrillItem` by natural key on every deploy with a content-version guard so fixture drift is detected; `drillItemId` joins fixtures to progress rows.

## Truth and copy

A single `isPreviewMode` flag (derived from session state) feeds one shared copy module. Signed-out users keep the current preview promises ("Nothing was saved.", demo data notices). Signed-in users see account-scoped truth ("Saved to your account.", real due counts). The completion sentence "Checked locally. Nothing was saved." refers to the answer-check pipeline and remains true for the checking payload — but session progress claims must follow the flag.

## Privacy

Learner progress is now persisted, account-scoped, and visible only to that account. This is stated plainly in the README and UI. The existing rules are unchanged: no learner audio is ever stored; answer-check payloads still travel only to the localhost sidecar; no third-party calls; no trackers.

## Out of scope (deferred)

Offline sync, OAuth/email fallbacks, mastery/assessment write flows (schema ready, UI flows later), multi-device conflict resolution beyond last-write-wins, admin/enrollment UI beyond operator-run registration.

## Acceptance criteria

- Passkey registration + sign-in works; unauthenticated mutation attempts get 401; the guard redirects unauthenticated page reads to the login route.
- Progress snapshot for a signed-in user reflects their `UserProgress` rows; signed-out users get the unchanged fixture snapshot.
- `POST /api/progress/review` computes SM-2 server-side, is idempotent per `clientMutationId`, and rejects unauthenticated/oversized/invalid bodies with 401/413/400.
- Preview copy is byte-identical to today for signed-out users; signed-in copy uses the shared module.
- Seed upsert is idempotent across two consecutive runs and detects fixture version drift.
- Full suite, lint, typecheck, build pass; e2e covers signed-out preview and a signed-in review flow using Playwright's virtual WebAuthn authenticator.
