# Physical-device QA — iPhone Safari and the installed PWA

The runbook for gate 4 of `docs/human-review-gates.md`. **Nothing in this file has been
performed.** Every field below is empty on purpose: a blank field is an unfinished check,
not a passing one, and no automated result may be copied into a device observation.

This exists because a desktop browser is not a phone. Chromium at 390px wide has no home
indicator, no notch, no real touch, no silent switch, no lock screen and no Safari. The
layers below are the split:

| Layer | Where it runs | What it settles |
| --- | --- | --- |
| Viewport contract | `npx vitest run tests/device-viewport-contract.test.ts` | The declarations a device pass would otherwise be the first thing to notice: `viewport-fit=cover`, no locked zoom, the standalone offline page matching, and every bottom-pinned surface reserving the home indicator. |
| Layout smoke | `E2E_BASE_URL=http://localhost:3101 npx playwright test tests/e2e/viewport.spec.ts --project=chromium` | No sideways overflow, the tab capsule inside the screen, thumb-sized controls, landscape navigation — at 320, 390 and 430px wide. |
| Accessibility sweep | `npm run a11y:audit` | Axe across 20 route/viewport combinations, including tab order and structure. |
| Offline matrix | `E2E_BASE_URL=http://localhost:3101 npx playwright test --config playwright.offline.config.ts` | The install path, the cached shell and the failure copy, on Chromium and WebKit. The WebKit half runs partially — see the note under section 6. |
| **This checklist** | A real iPhone, Safari, and the installed app | Touch, the home indicator, the silent switch, the lock screen, Airplane Mode on real radios, install and update, and Safari's own behaviour. |

## Build under test

| Field | Value |
| --- | --- |
| Commit (`git rev-parse HEAD`) | |
| Date and time of the pass | |
| Who performed it | |
| Device (model) | |
| iOS version | |
| Safari version | |
| App state (browser tab / installed to Home Screen / both) | |
| URL or host reachable from the device (LAN IP, tunnel, or production) | |
| Hosting (`npm run dev`, `npm run build && npm start`, deployed) | |

Prepare the device before starting:

```bash
git rev-parse HEAD                     # the commit for the table above
npm run build && npx next start -H 0.0.0.0 -p 3100   # reachable from the phone
# or, for the offline and installed-app passes:
npm run portable:build                 # the single-file edition, served over the LAN
```

Open the site from the phone over the LAN address (for example `http://10.0.0.83:3100`).
Note that installing to the Home Screen and the service worker both need a secure context
in Safari — over plain HTTP that means `localhost`, so over a LAN address **expect the
install prompt and the offline cache to be unavailable**; that is a hosting limit, not a
failure of the app. Record which context was used, because the installed-app checks cannot
be signed off from an insecure origin.

## 1. Install and update

- [ ] Safari shows the site, no console-visible breakage, no layout shift on load.
- [ ] Share → **Add to Home Screen** offers the app name and icon (not a screenshot).
- [ ] The installed app opens with **no Safari chrome** (no address bar, no tab bar).
- [ ] The status bar area is painted with the theme colour rather than white.
- [ ] The icon on the home screen is the VerbaLibera mark, not a default tile.
- [ ] Opening a deep link inside the installed app keeps the app context (does not bounce to Safari).

Evidence — icon, splash and chrome:

| Check | Result (pass/fail) | Note or capture |
| --- | --- | --- |
| App opens standalone | | |
| Icon correct | | |
| Theme colour in the status bar | | |

Update behaviour, after a new build is served (bump the service worker's cache name to force it):

- [ ] With the app closed, a new build is picked up on the next open without a hard reload dance.
- [ ] No stale screen: the course list and a lesson open to the new content.
- [ ] Nothing in local storage is lost by the update — the language choice and progress survive.

| Check | Result | Note |
| --- | --- | --- |
| Update picked up | | |
| Progress survived the update | | |

## 2. Onboarding

- [ ] First open shows the language step, not a dashboard with a default course.
- [ ] Tapping a language card works first time (no missed taps, no zoom).
- [ ] Continue is reachable without scrolling past the keyboard when the keyboard is open.
- [ ] The first-win sequence runs end to end: meet, recognise, build, and the recap.
- [ ] Choosing writes the choice — reload the app and it does **not** ask again.
- [ ] A learner who abandons mid-flow resumes on the same screen after a reload.
- [ ] With the sound muted (silent switch on), the first win is still completable.

| Step | Result | Note |
| --- | --- | --- |
| Language step | | |
| First win | | |
| Resume after reload | | |
| Sound-off path | | |

## 3. Course shell and artwork

- [ ] The course page shows its banner, uncropped, with no letterboxing or stretching.
- [ ] Rotating the device re-lays out the banner without a sideways scrollbar.
- [ ] The course path lists lessons, locked rows naming their prerequisite, and the next lesson.
- [ ] Lesson artwork (scene pictures) renders at the declared 4:3 and is not squashed.
- [ ] Text over artwork stays readable (no artwork behind body copy).

| Surface | Result | Note or capture |
| --- | --- | --- |
| Course page banner | | |
| Lesson scene | | |
| Course path | | |

## 4. Lesson playback

- [ ] A model recording starts on the first tap, without a second tap to unblock.
- [ ] With the **silent switch on**, playback follows the app's stated behaviour and the copy
      tells the truth about it.
- [ ] With headphones connected, playback routes to them and continues when they are removed
      (or stops, if that is what the browser does — record which).
- [ ] Locking the screen mid-track keeps playing (where the platform allows it) or pauses
      cleanly; either way it does not stop the app working on unlock.
- [ ] The lock screen shows the track's title and artwork.
- [ ] Transport controls on the lock screen work: play, pause, and skip if offered.
- [ ] Listening position is remembered after closing the app completely and reopening.
- [ ] A lesson's practice (choice, order, cloze, typing) accepts touch input with the
      keyboard, and the keyboard does not cover the answer field.

| Check | Result | Note or capture |
| --- | --- | --- |
| Audio starts | | |
| Silent switch behaviour | | |
| Headphone routing | | |
| Lock screen metadata | | |
| Position remembered | | |
| Typed answers reachable | | |

## 5. Resume after reload

- [ ] Mid-lesson reload returns to the same step, with progress counts unchanged.
- [ ] Closing the app from the switcher and reopening resumes the same lesson.
- [ ] A completed lesson stays completed and does not relock.
- [ ] Progress written on the phone is visible in the same app after going offline and back.
- [ ] If signed in: progress appears on another device (record the latency honestly).

| Check | Result | Note |
| --- | --- | --- |
| Reload mid-lesson | | |
| Cold reopen | | |
| Completion kept | | |

## 6. Offline and downloaded mode

Enable Airplane Mode for this whole section.

- [ ] The app opens with no network at all — a cold start, not a warm tab.
- [ ] A downloaded course opens and its lessons play, including audio.
- [ ] The offline page appears for an uncached route, is readable, and is **clear of the home
      indicator and the rounded corners** (it opts into `viewport-fit=cover`; this is the check
      that proves the insets land correctly on real hardware).
- [ ] Nothing claims to be available that is not: an undownloaded course says so.
- [ ] Leaving Airplane Mode on, a download attempt fails with an explanation rather than a
      spinner that never resolves.
- [ ] Turning the network back on recovers without a restart.

> **Known limitation, do not re-report as a bug:** Playwright's WebKit raises an internal
> error on any navigation with the network emulated off, so the automation cannot cover the
> WebKit offline path at all. This section is the only place that gets covered, which is why
> it exists.

| Check | Result | Note or capture |
| --- | --- | --- |
| Cold start offline | | |
| Downloaded lesson + audio | | |
| Offline page insets | | |
| Honest failure copy | | |

## 7. Orientation and viewport

- [ ] Rotating to landscape re-lays out every screen visited above, with no sideways scroll.
- [ ] In landscape the floating tab capsule is gone and the header navigation is present.
- [ ] Rotating back restores the portrait layout without a refresh.
- [ ] Two-finger **pinch-zoom works** and is not blocked (the viewport declares no locked scale).
- [ ] Text is readable at the system's default text size, and the layout survives a larger one.
- [ ] With the on-screen keyboard open, the focused field stays visible.

| Surface | Portrait | Landscape | Note |
| --- | --- | --- | --- |
| Dashboard | | | |
| Course page | | | |
| Lesson | | | |
| Listen | | | |

## 8. Touch targets and gestures

- [ ] The four tabs, the primary action and the language switcher are all comfortably hittable
      with a thumb, one-handed.
- [ ] No control requires a double tap or a long press.
- [ ] A tap is not mistaken for a swipe: scrolling a lesson does not fire a control.
- [ ] Safari's swipe-back gesture from the left edge does not lose an in-progress lesson
      (or does — record which, with the step).
- [ ] Long-pressing text does not select the whole card.
- [ ] The **Done** key on the keyboard dismisses it rather than submitting twice.

| Control | Result | Note |
| --- | --- | --- |
| Tab capsule | | |
| Primary action | | |
| Language switcher | | |
| Swipe-back during a lesson | | |

## 9. Safe areas, notch and home indicator

- [ ] The floating tab capsule clears the home indicator with visible room to spare.
- [ ] The practice action bar and any raised toast do the same, at the bottom of the screen.
- [ ] Nothing important sits under the notch or the Dynamic Island in portrait or landscape.
- [ ] Installed-app mode does not shift content under the status bar when it is tapped to scroll to top.

| Surface | Result | Note or capture |
| --- | --- | --- |
| Tab capsule | | |
| Action bar / toast | | |
| Notch side in landscape | | |

## 10. Failures and observations

Record what failed, not only that it worked. Each entry: what you did, what you expected,
what happened, and a capture if one is possible.

| # | Step | Expected | Observed | Capture |
| --- | --- | --- | --- | --- |
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

## Recording the result

Write a dated note at `docs/superpowers/verification/YYYY-MM-DD-device-qa-<device>.md` holding
this table filled in plus the failures above, and name the device, OS version and browser
engine. Then update gate 4 of `docs/human-review-gates.md`: a section that passed is marked
passed with the note's path, and anything left unperformed is named as unperformed.

Do not infer a device result from the automated layers. They ran on a desktop engine, and
their green badge says nothing about a touch screen.
