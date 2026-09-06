# VerbaLibera landing page implementation plan

**Goal:** Integrate the approved Open Design landing page into the existing app and validate a Vercel Preview.
**Architecture:** Server-rendered editorial sections with scoped CSS; small client islands for navigation and answer reveal. Preserve the existing learner dashboard at `/dashboard`, redirect legacy course queries, and retain all learning/data services.
**Tech stack:** Next.js 16.3.3, React 19, CSS Modules, existing next/font fonts, Prisma/PostgreSQL, Vitest and Playwright.
**Spec:** `docs/design/landing-page-brief.md`; approved local Open Design `verba-libera-landing.html` (project a39d3651-6161-43db-874e-c32a74d0a0f5).

## Constraints
- Work on `astra/landing-page-redesign`; never merge or deploy main.
- Preserve original artwork, learning content, auth, migrations and offline caching policy.
- No new runtime dependency or LLM requirement. Do not commit secrets.
- Preview account tests must use an isolated database.

## Tasks
- [ ] 1. Establish baseline with `npm test`; inspect routes, auth, assets, offline, deployment and local Next docs.
- [ ] 2. Add regression coverage for public landing, model reveal, navigation, dashboard query and PWA launch. Observe failures before implementation.
- [ ] 3. Build `src/components/landing/` section components and CSS Module. Use existing fonts and optimized images. Real links: `/dashboard`, `/login`, `/courses/french`, `/courses/italian`, `/learn/english-to-spanish`, `/learn/english-to-portuguese`.
- [ ] 4. Move dashboard server page to `src/app/dashboard/page.tsx`; update daily-path links, post-login destinations, language-switch query, manifest launch and tests. Keep `/?course=…` redirect compatibility.
- [ ] 5. Add browser acceptance coverage at 390, 768, 1440 and 1920px, menu keyboard behavior, answer reveal, reduced motion and learning navigation. Compare screenshots with the approved prototype.
- [ ] 6. Run lint, typecheck, unit tests, content validation, production build, Chromium E2E and iPhone WebKit tests. Investigate failures and record exact outcomes.
- [ ] 7. Configure branch-scoped Preview auth and isolated database where credentials allow; preserve migration deployment. Commit and push, inspect Vercel build, test deployed guest learning, offline and supported account flows.
- [ ] 8. Document Preview URL/SHA, environment names, QA results, deliberate design deviations and any blockers. Prepare normal review without merging.
