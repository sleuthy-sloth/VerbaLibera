You are working on the existing VerbaLibera repository:

https://github.com/sleuthy-sloth/VerbaLibera

I have attached an HTML file created in Open Design. Treat that file as the **approved visual design reference** for a new public-facing VerbaLibera landing page.

Your job is to:

1. Inspect and understand the existing VerbaLibera repository.
2. Rebuild the attached Open Design prototype properly inside the existing Next.js application.
3. Preserve all existing learning functionality.
4. Validate the application thoroughly.
5. Deploy the completed branch to Vercel as a Preview Deployment.
6. Verify the actual hosted learning application works, not only the landing page.
7. Prepare the changes for eventual production deployment from `main`.

Do NOT simply paste the Open Design HTML into the repository.

Reimplement the visual design using the actual Next.js application, React components, existing styles/Tailwind setup, routes, assets, and project conventions.

# PRIMARY GOAL

Reproduce the attached Open Design landing page as closely as practical while making it:

- production-quality
- responsive
- accessible
- maintainable
- integrated into the existing app
- visually polished on desktop and mobile
- consistent with VerbaLibera's Quiet Ink identity
- deployable on Vercel Hobby
- lightweight enough to remain practical on the free hosting tier

The attached HTML is the **visual source of truth**.

The existing VerbaLibera repository is the **engineering and product-truth source of truth**.

Where the current homepage design conflicts with the attached mockup, prefer the mockup for the public landing page.

Where the mockup conflicts with actual VerbaLibera functionality, preserve the real functionality and correct the design/copy appropriately.

# IMPORTANT ARCHITECTURAL REQUIREMENT

The landing page must NOT become a separate website.

It must live inside the existing VerbaLibera application.

The desired result is:

Landing page
→ course selection
→ lessons
→ exercises
→ account/progress
→ offline functionality

all within the same deployed application and domain.

Do not create a separate static site unless technically unavoidable.

# BEFORE MAKING CHANGES

Inspect the repository thoroughly.

At minimum inspect:

- `package.json`
- Next.js version
- App Router / Pages Router structure
- current root `/` route
- shared application layout
- navigation
- Tailwind configuration
- global CSS
- typography configuration
- reusable components
- authentication implementation
- passkey flow
- course routes
- foundation-course routes
- travel-course routes
- lesson routes
- progress APIs
- placement APIs
- study-plan APIs
- offline/PWA implementation
- service worker
- Prisma configuration
- PostgreSQL requirements
- environment-variable handling
- Vercel configuration
- build scripts
- tests
- existing metadata/SEO
- existing responsive breakpoints

Also inspect the existing brand assets:

- `/public/brand/logo-lockup.jpg`
- `/public/brand/logo-mark.jpg`
- `/public/brand/hero-banner.jpg`
- `/public/brand/empty-journal.jpg`
- `/public/brand/courses/`

Reuse original VerbaLibera assets wherever appropriate.

Do not replace them with generic stock assets.

# PRODUCT TRUTH

VerbaLibera teaches languages through practical sentence construction.

Core product philosophy:

**Learn to build the language, not guess it.**

The primary learning method is:

**Notice → Build → Vary → Use**

Current relevant capabilities include:

- structured French and Italian A1 foundation material
- sentence-construction practice
- vocabulary references
- grammar references
- prerecorded pronunciation models
- listening exercises
- slow replay
- dictation
- offline study
- spaced review
- mobile-first lessons
- passkey accounts
- account-scoped progress
- cross-device synchronization for signed-in users
- device-local guest study
- deterministic/local answer evaluation
- Anki export
- privacy-conscious behavior
- no required LLM or generative runtime while studying

Spanish and Portuguese currently contain travel-focused material.

Do NOT imply:

- complete CEFR certification
- complete B1/B2 programs unless they actually exist in the repository
- real-time AI conversation
- native-speaker-reviewed content if that review is still pending
- fake user numbers
- fake testimonials
- awards
- fake press coverage
- unsupported product metrics

If the Open Design mockup contains inaccurate product copy, correct the wording while preserving its intended visual presentation.

# LANDING-PAGE PURPOSE

The new `/` route should function as VerbaLibera's public product landing page.

It should introduce the product and lead users naturally into the learning application.

It should not replace or remove the actual learner dashboard/course experience.

When the user chooses to start learning, route them into the appropriate existing application flow.

# LANDING-PAGE STRUCTURE

Follow the uploaded HTML's structure closely.

The desired narrative is approximately:

1. Navigation
2. Hero
3. Product demonstration
4. Notice → Build → Vary → Use methodology
5. Anti-gamification philosophy
6. Courses/languages
7. Offline study
8. Listening/pronunciation
9. Privacy/local-first behavior
10. Mobile product experience
11. Open-source section
12. Final CTA
13. Footer

If the attached mockup differs somewhat, follow the mockup.

# HERO

Preserve the strongest composition from the attached prototype.

Main idea:

**Stop guessing. Start building sentences.**

or the equivalent approved headline in the mockup.

The hero should communicate sentence construction visually.

Example progression:

`Je voudrais`

→

`Je voudrais un café`

→

`Je voudrais un café, s'il vous plaît.`

Sentence pieces may animate gently into place.

Use grammar annotations, translations, underlines, margin notes, or editorial marks where appropriate.

Do NOT use:

- a generic SaaS dashboard
- a laptop mockup
- fake analytics
- meaningless floating cards

# VISUAL DIRECTION

The product identity is **Quiet Ink**.

Preserve and expand it.

Use:

- warm paper-like backgrounds
- slightly warm near-black ink
- muted teal accent
- editorial serif typography
- readable sans-serif interface typography
- thin rules
- intentional whitespace
- restrained illustration
- subtle paper texture
- language annotations
- sentence fragments as visual motifs

Avoid:

- purple/blue gradient blobs
- neon
- excessive glassmorphism
- endless rounded cards
- generic feature grids
- gradient headline text
- decorative 3D objects
- AI-themed graphics
- random dashboard widgets

The page should feel literary and modern rather than corporate.

# TYPOGRAPHY

Typography matters heavily.

Use an editorial serif/display style for major headings.

Use a highly readable sans-serif for:

- body copy
- navigation
- UI controls
- buttons

Use italic styling sparingly for:

- translation
- linguistic notes
- editorial annotation

Before adding fonts, inspect the existing application fonts.

Prefer existing fonts if possible.

If a new font materially improves visual fidelity:

- use an open/web-licensed font
- load it through the correct Next.js font mechanism
- keep the number of font files minimal
- avoid unnecessary page-weight increases

# RESPONSIVE IMPLEMENTATION

The page must be intentionally designed at:

- ~390 px mobile
- modern iPhone sizes
- ~768 px tablet
- laptop
- ~1440 px desktop
- large desktop

Do not merely stack desktop sections vertically.

Recompose layouts for mobile where appropriate.

Pay particular attention to:

- hero typography
- sentence assembly visual
- navigation
- course artwork
- product demonstration
- annotations
- overlapping elements
- section spacing
- CTAs

No unintended horizontal scrolling.

# MOBILE-FIRST QUALITY

VerbaLibera is intended to work well on phones.

The landing page should feel deliberately designed for mobile.

Requirements:

- touch-friendly controls
- readable text sizes
- accessible menu
- no tiny navigation links
- no desktop-only hover dependency
- no unusable overlapping artwork
- useful spacing at 390 px width

# MOTION

Reproduce good motion from the Open Design prototype.

Good examples:

- sentence fragments assembling
- underline drawing
- annotations fading in
- section reveal
- small course-art movement
- gentle parallax
- restrained hover states

Avoid:

- constant floating elements
- bouncing controls
- particle effects
- aggressive scroll-jacking
- expensive full-page animation systems

Prefer:

- CSS transitions
- CSS keyframes
- lightweight React interaction

Avoid adding a large animation library unless the existing project already uses one or it offers a clear technical advantage.

Respect:

`prefers-reduced-motion`

The complete landing page must remain usable with motion disabled.

# ACCESSIBILITY

Check:

- semantic HTML
- heading hierarchy
- navigation landmarks
- keyboard navigation
- focus visibility
- button/link semantics
- contrast
- image alt text
- decorative-image handling
- touch target size
- reduced-motion support
- mobile menu accessibility
- form labels where applicable

Accessibility takes priority over exact pixel reproduction.

# PERFORMANCE

Keep the page suitable for Vercel Hobby and mobile devices.

Favor:

- React Server Components where appropriate
- static rendering where appropriate
- CSS effects
- optimized Next.js `<Image>`
- lazy loading below-the-fold imagery
- efficient font loading
- minimal client-side JavaScript

Avoid:

- large JavaScript animation frameworks for small effects
- giant client components
- unnecessary dependencies
- large videos
- oversized unoptimized images

Inspect bundle impact if you add significant dependencies.

# COMPONENT STRUCTURE

Do not build the entire landing page as one giant component.

Use clear sections when appropriate.

Possible structure:

- `LandingNav`
- `Hero`
- `SentenceBuilderDemo`
- `LearningMethod`
- `PhilosophySection`
- `CourseShowcase`
- `OfflineSection`
- `ListeningSection`
- `PrivacySection`
- `MobileShowcase`
- `OpenSourceSection`
- `FinalCTA`
- `LandingFooter`

These names are suggestions.

Prefer existing project conventions.

Do not over-componentize tiny visual elements.

# REAL ROUTES

Every CTA must use a real route.

Do NOT use:

`href="#"`

Inspect the application and determine the correct destinations.

Examples:

**Start learning**
→ actual course/dashboard entry point

**French**
→ actual French course page

**Italian**
→ actual Italian course page

**Sign in**
→ actual passkey/account flow

**View on GitHub**
→ https://github.com/sleuthy-sloth/VerbaLibera

If the existing app distinguishes between dashboard and public landing entry, preserve that distinction clearly.

# PRESERVE EXISTING FUNCTIONALITY

The redesign must not break:

- course pages
- lesson pages
- foundation lessons
- travel lessons
- listening
- offline mode
- PWA behavior
- service worker
- passkey accounts
- sign-in
- progress
- placement
- study plans
- API routes
- Prisma
- Anki export
- mobile experience

Do not refactor unrelated parts of the application unless required.

# PROTOTYPE CLEANUP

The uploaded Open Design HTML may contain prototype-oriented code such as:

- inline styles
- absolute-position hacks
- fixed dimensions
- duplicated CSS
- prototype scripts
- layout shortcuts

Do not copy those implementation patterns blindly.

Recreate the appearance using clean production techniques:

- CSS grid
- Flexbox
- container widths
- `clamp()`
- fluid type
- responsive spacing
- sensible media queries
- relative positioning
- reusable design tokens

The production implementation should be cleaner than the prototype.

# ARTWORK

Use existing VerbaLibera artwork first.

If the prototype contains an element that has no direct asset:

1. Recreate it with CSS if appropriate.
2. Use inline SVG if appropriate.
3. Reuse existing VerbaLibera artwork where possible.
4. Do not fetch random stock photography.
5. Do not introduce copyrighted third-party assets.

For simple illustrations, editorial marks, arrows, lines, annotation strokes, sentence construction pieces, etc., prefer SVG/CSS.

# COPY

Use the uploaded design copy as a starting point.

Adjust copy when needed for accuracy.

Keep the tone:

- plain
- concise
- thoughtful
- confident

Avoid generic startup copy.

Avoid phrases such as:

- revolutionary
- unlock fluency
- transform your learning
- AI-powered
- game-changing

# SEO AND METADATA

Inspect the existing metadata implementation.

Update the root landing-page metadata if appropriate.

Suggested direction:

Title:

`VerbaLibera — Learn Languages by Building Sentences`

Description:

`Structured language learning through sentence construction, deliberate practice, listening, and offline study — without streak pressure or a required AI runtime.`

Adjust as needed to match repository conventions.

Do not make unsupported SEO claims.

# DATABASE AND HOSTING ARCHITECTURE

The production application should continue to use the existing deployment architecture unless inspection shows that it is outdated.

Preferred architecture:

GitHub
→ Vercel
→ VerbaLibera Next.js application

Database:
→ hosted PostgreSQL compatible with the existing Prisma setup

The repository currently expects PostgreSQL.

Do not replace the database layer simply for the landing-page redesign.

# VERCEL DEPLOYMENT TARGET

The completed application should remain compatible with **Vercel Hobby**.

This project is currently a personal/open-source non-commercial project.

Do not add hosting architecture that unnecessarily requires a paid tier.

Keep serverless usage reasonable.

Do not introduce:

- long-running background workers
- always-running servers
- persistent Node processes
- unnecessary scheduled jobs
- large server-side AI models
- expensive runtime requirements

The learning application should continue to work without requiring an LLM endpoint.

# EXISTING VERCEL CONFIGURATION

Inspect:

- `vercel.json`
- environment-variable documentation
- build commands
- Prisma migration behavior
- production deployment configuration

Do not delete working deployment configuration unless you have confirmed it is obsolete or incorrect.

The existing repository may already use something similar to:

`prisma migrate deploy && npm run build`

Preserve correct migration behavior.

# ENVIRONMENT VARIABLES

Identify every environment variable required for a fully functional hosted deployment.

At minimum investigate:

- `DATABASE_URL`
- `AUTH_JWT_PRIVATE_KEY`
- `AUTH_JWT_PUBLIC_KEY`
- `WEBAUTHN_RP_ID`
- `WEBAUTHN_ORIGIN`
- `VERBALIBERA_VOICE_SERVICE_URL`

Do NOT commit secrets.

Use `.env.example` as the documentation source where appropriate.

For a hosted Vercel deployment, the local-only voice sidecar may remain disabled unless there is already a compatible hosted service.

The application must degrade cleanly when the optional voice sidecar is unavailable.

# WEBAUTHN / PASSKEY DEPLOYMENT

Passkey authentication must work correctly on the hosted HTTPS domain.

For the production Vercel domain, configure:

`WEBAUTHN_RP_ID`

to the production hostname without protocol.

Example:

`verbalibera.vercel.app`

Configure:

`WEBAUTHN_ORIGIN`

to the complete HTTPS origin.

Example:

`https://verbalibera.vercel.app`

Do not hardcode these values into application source if the project already uses environment variables.

# PREVIEW DEPLOYMENT STRATEGY

Work on a dedicated feature branch.

Suggested branch:

`astra/landing-page-redesign`

Push that branch to GitHub.

Do not merge directly into `main`.

If the repository is already connected to Vercel, allow the Git integration to create a Preview Deployment automatically.

If it is not connected, prepare the repository for connection but do not invent credentials.

The expected workflow is:

`astra/landing-page-redesign`
→ GitHub
→ Vercel Preview Deployment
→ visual/function testing
→ merge
→ Production Deployment

# PREVIEW ENVIRONMENT VARIABLES

Preview deployments may require Preview-scoped environment variables.

Determine which variables are needed for the preview to build and run.

Document them clearly.

Do not expose secret values in:

- commits
- logs
- README output
- final response

If Preview should use a separate database to prevent test activity from affecting production, recommend that configuration.

Do not silently point destructive preview behavior at production data.

# DEPLOYMENT CHECKLIST

After pushing the branch:

1. Confirm Vercel creates a Preview Deployment.
2. Confirm the deployment build succeeds.
3. Open the deployed preview.
4. Test the public landing page.
5. Test the actual application beyond the landing page.

Do NOT consider deployment successful just because `/` renders.

# HOSTED FUNCTIONAL TESTING

On the Preview Deployment, verify as much as reasonably possible:

## Landing page

- root `/`
- navigation
- desktop layout
- mobile layout
- CTAs
- responsive menu
- images
- fonts
- animation
- reduced-motion behavior

## Learning

Test at least:

- French course entry
- Italian course entry
- lesson page
- sentence-construction exercise
- model answer reveal
- local deterministic checking
- listening controls where available
- course navigation

## Account

If preview environment variables support authentication:

- passkey sign-up flow
- passkey sign-in
- account state
- progress display

Do not create production user data merely to test a preview environment.

## Offline / PWA

Check:

- manifest
- application shell
- service-worker registration
- offline study entry where practical
- no obvious regression to offline behavior

## APIs

Check that relevant API routes do not produce deployment-only failures.

# LOCAL VALIDATION BEFORE DEPLOYMENT

Run the project's normal checks.

At minimum:

`npm run lint`

`npm run typecheck`

`npm run test`

`npm run build`

Also run relevant browser/E2E tests if configured, including WebKit/mobile-focused tests where reasonable.

If the repository uses:

`npm run test:e2e`

or

`npm run test:e2e:webkit`

run the relevant suites.

Also run:

`npm run content:validate`

if it remains part of the current repository scripts.

Do not skip failing checks.

Investigate and fix regressions introduced by this work.

If an existing unrelated test is already failing before your changes, identify it clearly rather than hiding it.

# VISUAL QA

Compare the implemented page directly with the uploaded Open Design HTML.

Inspect:

- hero dimensions
- typography
- spacing
- colors
- alignment
- artwork
- sentence compositions
- section rhythm
- content width
- mobile adaptation
- large desktop appearance

The result should look recognizably like the approved design.

Do not settle for a page that is merely "inspired by" it.

# BROWSER QA

At minimum check:

- Chromium desktop
- Chromium mobile viewport
- WebKit if the current project test setup supports it

Pay special attention to iPhone/WebKit behavior.

# VERCEL DRY RUN

If Vercel CLI is available and the project is linked, perform a dry deployment inspection before the real preview deployment if practical.

Confirm:

- Next.js is correctly detected
- expected project files are included
- large/unexpected files are not being uploaded
- build configuration is correct

Do not treat this as a substitute for an actual Preview Deployment.

# PRODUCTION DEPLOYMENT

Do not force-push or directly overwrite `main`.

Once the preview is validated, prepare the branch to be merged normally.

The desired production workflow is:

feature branch
→ Preview Deployment
→ review
→ merge into `main`
→ automatic Vercel Production Deployment

The live production application should continue to include:

- landing page
- learning app
- courses
- lessons
- accounts
- progress
- offline functionality

on the same deployment.

# CUSTOM DOMAIN READINESS

Do not require a custom domain.

The application should function correctly on the existing:

`*.vercel.app`

domain.

However, keep the implementation compatible with adding a custom domain later.

Authentication configuration must be domain-aware through environment variables rather than permanently tied to one hostname.

# SECURITY

Do not:

- expose secrets client-side
- commit `.env`
- leak database credentials
- leak JWT keys
- store WebAuthn secrets in code
- expose server-only environment values
- weaken authentication to simplify deployment

Inspect client/server boundaries carefully.

# GIT WORKFLOW

Use a dedicated branch:

`astra/landing-page-redesign`

Use logical commits.

Suggested pattern:

`feat: build new VerbaLibera landing page`

`feat: add responsive landing interactions`

`fix: preserve mobile and accessibility behavior`

`test: update landing page coverage`

Do not create dozens of trivial commits.

Do not merge `main`.

# SCOPE CONTROL

Focus primarily on:

- the landing page
- the minimum shared navigation/layout work needed
- deployment compatibility
- required tests

Do not redesign:

- lessons
- dashboard
- account pages
- placement
- study plans
- unrelated internal interfaces

unless a small compatibility change is required.

# FINAL REPORT

At completion, report:

## Implementation

- summary of the landing-page implementation
- major design decisions
- key components created
- important files modified

## Product preservation

Confirm that:

- learning routes remain functional
- existing course data remains intact
- passkeys remain intact
- offline/PWA behavior remains intact
- no LLM runtime was introduced as a requirement

## Validation

List the exact commands run and results.

Example:

- `npm run lint` — PASS
- `npm run typecheck` — PASS
- `npm run test` — PASS
- `npm run test:e2e` — PASS
- `npm run build` — PASS

Use actual results, not assumptions.

## Deployment

Provide:

- Git branch name
- commit SHA
- Vercel Preview Deployment URL
- deployment status
- production domain currently configured, if known

## Hosted verification

Describe which live preview routes and functionality you tested.

## Environment

List required environment-variable **names only**.

Never print secret values.

## Differences from prototype

List any intentional deviations from the Open Design HTML and why.

Examples:

- accessibility
- responsive behavior
- performance
- existing application routing
- product accuracy

## Remaining issues

Clearly identify anything that could not reasonably be completed.

Do not hide known problems.

# FINAL STANDARD

This page should not look like a generic AI-generated landing-page template.

It should feel specifically built for VerbaLibera.

The complete hosted application should communicate:

- language as something you construct
- calm rather than pressure
- thoughtful learning
- privacy and ownership
- open-source software
- literary/editorial character

The public landing page and the actual language-learning application must function together as one coherent product.

Treat:

**The uploaded Open Design HTML as the art direction.**

Treat:

**The existing VerbaLibera repository as the product and engineering source of truth.**

And treat:

**The Vercel Preview Deployment as part of the acceptance test, not merely an optional final step.**