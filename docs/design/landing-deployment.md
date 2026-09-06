# Landing page deployment and verification

The public `/` page is statically rendered. The existing learner dashboard lives at `/dashboard`; requests to `/?course=…` redirect with the query preserved. Foundation courses, travel lessons, passkeys, progress/placement/study-plan APIs and the privacy-safe service worker remain in the same Next.js application.

## Preview configuration

Use the `astra/landing-page-redesign` Preview environment. Its `DATABASE_URL` points to a separate empty-and-seeded database (`verbalibera_landing_preview`) on the existing hosted PostgreSQL service. It does not contain production learner records. Separate Preview ES256 session keys are configured. Production configuration is unchanged.

Required variable names:
- `DATABASE_URL`
- `AUTH_JWT_PRIVATE_KEY`
- `AUTH_JWT_PUBLIC_KEY`
- `WEBAUTHN_RP_ID`
- `WEBAUTHN_ORIGIN`

Optional variables:
- `WEBAUTHN_RP_NAME`
- `VERBALIBERA_VOICE_SERVICE_URL` (leave unset for hosted deterministic fallback)
- `REGISTRATION_TOKEN` (only when registration is restricted)
- `SENTRY_DSN` (optional diagnostics)

The file-path JWT alternatives in `.env.example` remain supported for operator-managed servers; use inline secrets on Vercel. No values belong in source control.

Preview passkeys are configured for the stable HTTPS alias `verbalibera-landing-preview.vercel.app`. Use that alias for account testing; credentials are intentionally domain-specific. Production continues using its own hostname/origin settings. A future custom domain requires updating both WebAuthn environment variables and accounting for existing passkeys' RP binding.

The existing `vercel.json` build command, `prisma migrate deploy && npm run build`, is preserved. The landing page adds no dependencies, server processes, scheduled jobs, or generative runtime. Its images use the existing artwork with Next image optimization; existing next/font fonts are reused.

## Intentional differences from the prototype

- Public CTAs open real dashboard, course, listening and login routes. Course cards now have explicit links.
- Mobile navigation is a keyboard-accessible disclosure, with Escape returning focus to its toggle.
- The model demo accepts a typed sentence and reveals/hides an answer. It does not pretend to grade free text.
- The listening example uses actual audio with native accessible controls and a working slow-speed selector.
- Copy distinguishes local foundation checking from other online services, and recognizes that introductory recognition exercises exist.
- Illustrative lesson numbers and invented setup commands were removed. Mobile examples are labeled as a glimpse of the method rather than screenshots of the actual interface.
- Motion is a single CSS sentence entrance with reduced-motion support. Below-fold content is visible without waiting for a scroll observer. No expensive fixed texture/parallax effect.
- The mobile offline section places the explanation before the illustrative screens; artwork retains its full aspect ratio.

## Release workflow

Review the feature branch and its tested Preview, then merge normally into `main` to trigger Production. Do not use Preview credentials or database settings in Production. Do not promote a Preview configured with its isolated database and RP hostname directly into Production.
