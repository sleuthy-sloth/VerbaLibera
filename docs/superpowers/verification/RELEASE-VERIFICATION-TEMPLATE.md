# Release verification note — template

Copy this file to `docs/superpowers/verification/<date>-<scope>.md` for every candidate release or
delivery package. A note with a blank field is an unfinished note, not a passing one — write
"not performed" rather than leaving a gap, and never infer a result from a green badge.

## Scope

- Package / phase:
- What is in the artifact: (exact list of editions and generated files)
- What is deliberately NOT in it:

## Identity

- Commit under test: `<full sha>`
- Branch and remote: `<branch>` → `<remote ref>`
- Working tree state at test time: (clean / named modified files — generated bundles are expected
  output, never assume "clean")
- Package version (`package.json`):
- Editions tested: hosted web / signed-in web / installed offline PWA / portable HTML
  (Chromium, WebKit) / packaged desktop — say which, and which were skipped

## Environment

- OS + version, Node version, npm version
- Browser/engine versions for any browser test
- Databases or services required (disposable Postgres, local voice sidecar, none)

## Commands and results

Run each and paste the real summary line. Do not summarise from memory.

| Command | Result |
| --- | --- |
| `npm run content:validate` | |
| `npm run content:audio-check` | |
| `npm run content:build` (twice; byte-identical?) | |
| `npm run test` (`npx vitest run`) | |
| `npx tsc --noEmit` | |
| `npm run lint` | |
| `npm run build` | |
| `npx playwright test --project=chromium --workers=1` | |
| `npm run test:e2e:portable` | |
| `python -m pytest services/voice/tests -q` | |

## Artifact digests

`shasum -a 256` every produced artifact. A digest recorded before the final regeneration is stale —
hash the shipped bytes.

| Artifact | sha256 | Bytes |
| --- | --- | --- |
| `public/study.css` | | |
| `public/study.js` | | |
| `dist/portable/VerbaLibera-Portable.html` | | |
| desktop installer (if built) | | |

## Limitations and unverified claims

- Human listening checklist: performed / not performed
- Native-speaker review: performed / not performed
- Observed usability session: performed / not performed
- Physical device QA: performed / not performed
- Anything the automated run cannot prove (contrast over `color-mix()`, prosody quality,
  pronunciation quality, live deployment status, packaged-app startup)

## Rollback

- How to revert, and what the revert does not restore (regenerated artifacts, learner progress).
