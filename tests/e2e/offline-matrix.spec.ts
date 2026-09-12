import { test, expect, type Page } from '@playwright/test';

/**
 * Offline matrix — the failure half (roadmap 3A) —
 * plus a note on what cannot be tested from here.
 */

async function installFrench(page: Page) {
  await page.goto('/courses/french#offline-download');
  await page.getByRole('button', { name: 'Download for offline study', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open offline study' })).toBeVisible({ timeout: 30000 });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
}

/** The committed download: a pack cache carrying the ready marker. */
function committedCaches(page: Page) {
  return page.evaluate(async () => {
    const keys = (await caches.keys()).filter((key) => key.startsWith('verbalibera-pack-'));
    const ready: string[] = [];
    for (const key of keys) {
      const cache = await caches.open(key);
      if (await cache.match('/__course_pack_ready__')) ready.push(key);
    }
    return ready;
  });
}

// An install that cannot finish must leave nothing half-installed, and the
// learner must be able to try again when the connection comes back.
//
// Why this is "start offline" rather than "go offline halfway": Playwright's
// request routing does not see fetches that the service worker intercepts
// (`installPack` runs in the page, but the worker answers it), so a mid-flight
// `route.abort()` never fires. Verified by probe: 0 routes seen and the install
// completed. The mid-flight case is covered where it can be made deterministic
// — `tests/offline-install-listen.test.ts`, which fails the transfer partway
// and asserts the cache is discarded.
test('a download that cannot finish leaves nothing half-installed, and retrying works', async ({ page, context }) => {
  // Load the course page while still connected — otherwise the offline shell
  // answers the navigation and there is no download button at all. The story is
  // the real one: the page is open, the connection drops, the learner presses it.
  await page.goto('/courses/french#offline-download');
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const download = page.getByRole('button', { name: 'Download for offline study', exact: true });
  await expect(download).toBeVisible();
  await context.setOffline(true);

  await download.click();
  // A learner-facing message, not the engine's "Failed to fetch" — and one that
  // says the device was left as it was. (Next's route announcer is also an
  // alert, so this is scoped to the download section.)
  const alert = page.locator('#offline-download').getByRole('alert');
  await expect(alert).toContainText(/download failed — check your connection/i, { timeout: 30000 });
  await expect(alert).toContainText(/nothing was saved/i);
  await expect(page.getByText('Not downloaded yet')).toBeVisible();
  // Nothing committed: no cache carries the ready marker, so the service worker
  // will not serve a partial course.
  expect(await committedCaches(page)).toEqual([]);

  // The learner reconnects and presses it again.
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Download for offline study', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open offline study' })).toBeVisible({ timeout: 30000 });
  expect((await committedCaches(page)).length).toBe(1);
});

// A long track has to stream from the saved copy with no network, and the
// worker must not keep a partial response: a cached 206 is how a track comes
// back truncated on the next visit. Chromium only — see the WebKit notes below.
test('an offline track plays from the saved copy and stores nothing partial', async ({ page, context, browserName }) => {
  test.skip(
    browserName === 'webkit',
    'Playwright WebKit cannot play media from Cache Storage with the network emulated off ' +
      '(the element raises a load error), so the playback half of this case is Chromium only. ' +
      'WebKit still covers the install and the cache below.',
  );
  await installFrench(page);
  await context.setOffline(true);

  const audioUrls: string[] = [];
  const responses: Array<{ range?: string; status: number; cached: boolean }> = [];
  page.on('response', async (response) => {
    if (!response.url().includes('fr-identity-listen.mp3')) return;
    responses.push({
      range: response.request().headers()['range'],
      status: response.status(),
      cached: response.fromServiceWorker(),
    });
    audioUrls.push(response.url());
  });

  await page.goto('/study.html?language=french&view=listen');
  await page.getByRole('button', { name: 'Names and introductions', exact: true }).click();
  const player = page.getByLabel('Play the audio lesson: Names and introductions');
  await player.evaluate(async (audio: HTMLAudioElement) => {
    audio.load();
    await new Promise<void>((resolve) => {
      audio.addEventListener('loadedmetadata', () => resolve(), { once: true });
    });
    await audio.play();
    audio.currentTime = 300;
  });
  await expect
    .poll(() => player.evaluate((audio: HTMLAudioElement) => audio.currentTime))
    .toBeGreaterThan(299);
  expect(await player.evaluate((audio: HTMLAudioElement) => audio.duration)).toBeGreaterThan(480);
  // It came from the cache: the network is off, and no request left the device.
  expect(responses.length).toBeGreaterThan(0);
  expect(responses.every((entry) => entry.status === 200 || entry.status === 206)).toBe(true);

  // Nothing partial was kept anywhere: a range response is returned to the
  // player, never stored (`public/sw.js` guards on `response.status === 200`).
  const partial = await page.evaluate(async (url) => {
    const keys = await caches.keys();
    let found = 0;
    for (const key of keys) {
      const cache = await caches.open(key);
      const hit = await cache.match(url);
      if (hit && hit.status !== 200) found += 1;
    }
    return found;
  }, '/audio/french-foundations/fr-identity-listen.mp3');
  expect(partial).toBe(0);
  expect(audioUrls.length).toBeGreaterThan(0);
  await context.setOffline(false);
});

// The app itself has to come back when the connection does, not stay on the
// reconnect page until storage is cleared.
test('the app recovers when the connection returns', async ({ page, context, browserName }) => {
  test.skip(
    browserName === 'webkit',
    'Playwright WebKit raises an internal error on any navigation while the network is emulated ' +
      'off, service worker or not (probed: reload, goto and a cold file all fail), so the offline ' +
      'half of this case cannot run here. Recorded rather than silenced.',
  );
  await page.goto('/learn/english-to-french');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.goto('/learn/english-to-french', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Your practice path is waiting.' })).toBeVisible();

  await context.setOffline(false);
  await page.goto('/learn/english-to-french');
  await expect(page.getByRole('heading', { name: 'Your practice path is waiting.' })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Course path' }).or(page.getByRole('main'))).toBeVisible();
});

// Reopening the installed app straight into the audio lesson — no in-app
// navigation first, which is what a home-screen shortcut does.
test('a cold offline start goes straight into Listen', async ({ page, context, browserName }) => {
  test.skip(
    browserName === 'webkit',
    'A cold start means navigating while offline, which Playwright WebKit cannot do (internal ' +
      'error). The WebKit half of this story is the install-and-cache case below.',
  );
  await installFrench(page);
  await context.setOffline(true);

  const cold = await context.newPage();
  await cold.goto('/study.html?language=french&view=listen');
  await expect(cold.getByRole('heading', { name: 'Listen', exact: true })).toBeVisible();
  await cold.getByRole('button', { name: 'Names and introductions', exact: true }).click();
  // The card says the track is on this device, because it is: the download
  // cached it, so the learner never had to play it online first.
  await expect(cold.getByText(/this track plays with no connection/i)).toBeVisible({ timeout: 15000 });
  const player = cold.getByLabel('Play the audio lesson: Names and introductions');
  await player.evaluate(async (audio: HTMLAudioElement) => {
    audio.load();
    await new Promise<void>((resolve, reject) => {
      audio.addEventListener('loadedmetadata', () => resolve(), { once: true });
      audio.addEventListener('error', () => reject(new Error('offline audio failed')), { once: true });
    });
  });
  expect(await player.evaluate((audio: HTMLAudioElement) => audio.duration)).toBeGreaterThan(480);
  await cold.close();
  await context.setOffline(false);
});

// What WebKit can do, and therefore what the WebKit project is worth: register
// the worker, install a course, and hold the audio in Cache Storage. The
// playback and navigation halves of the matrix need Chromium (see the skips
// above), and the portable WebKit run covers "plays with no network at all",
// because that file has no network to reach for.
test('a WebKit engine installs the course and keeps the audio in Cache Storage', async ({ page }) => {
  await installFrench(page);
  const stored = await page.evaluate(async () => {
    const track = await caches.match('/audio/french-foundations/fr-identity-listen.mp3');
    const pack = await caches.match('/packs/french.json');
    const keys = (await caches.keys()).filter((key) => key.startsWith('verbalibera-pack-'));
    let ready = false;
    for (const key of keys) {
      const cache = await caches.open(key);
      if (await cache.match('/__course_pack_ready__')) ready = true;
    }
    return { track: Boolean(track), pack: Boolean(pack), ready };
  });
  expect(stored).toEqual({ track: true, pack: true, ready: true });
});
