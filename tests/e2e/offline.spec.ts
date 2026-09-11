import { test, expect } from '@playwright/test';

test('offline navigation shows a reconnect page and never cached account HTML', async ({ page, context }) => {
  await page.goto('/learn/english-to-french');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.goto('/learn/english-to-french', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Your practice path is waiting.' })).toBeVisible();
  // The state mark is part of the offline promise: it is precached with the rest
  // of the brand art, so the page a learner lands on when nothing else loads is
  // not a bare card. Decorative, so the copy has to say everything.
  const mark = page.locator('main img.mark');
  await expect(mark).toHaveAttribute('alt', '');
  await expect(mark).toHaveAttribute('src', '/brand/empty-journal.jpg');
  await expect
    .poll(() => mark.evaluate((img: HTMLImageElement) => img.naturalWidth), { timeout: 15_000 })
    .toBeGreaterThan(0);
  // And it did not have to reach the network for it.
  const markFromCache = await page.evaluate(async () => {
    const cached = await caches.match('/brand/empty-journal.jpg');
    return cached?.ok ?? false;
  });
  expect(markFromCache, 'the mark was not served from the precache').toBe(true);
  const cachedPages = await page.evaluate(async () => {
    const keys = await caches.keys();
    const requests = (await Promise.all(keys.map(async key => (await caches.open(key)).keys()))).flat();
    return requests.map(request => new URL(request.url).pathname).filter(path => path.startsWith('/learn/') || path.startsWith('/api/'));
  });
  expect(cachedPages).toEqual([]);
  expect(await page.evaluate(async () => { try { await fetch('/api/demo/progress'); return false; } catch { return true; } })).toBe(true);
  await context.setOffline(false);
});

test('downloaded v2 language can be opened from the PWA offline welcome page', async ({ page, context }) => {
  await page.goto('/courses/italian#offline-download');
  await page.getByRole('button', { name: 'Download for offline study', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open offline study' })).toBeVisible({ timeout: 30000 });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Your practice path is waiting.' })).toBeVisible();
  await page.getByRole('link', { name: 'Italian' }).click();
  await expect(page.getByRole('heading', { name: 'Italian foundations', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Course path' })).toBeVisible();
  // The course page's artwork is part of the offline promise too: the service
  // worker precaches every banner, and the course page used to render none for a
  // v2 course — so "downloaded" meant a page with no picture on it.
  const banner = page.locator('img.course-banner');
  await expect(banner).toHaveAttribute('src', /\/brand\/courses\/italian\.jpg/);
  await expect
    .poll(() => banner.evaluate((img: HTMLImageElement) => img.naturalWidth), { timeout: 15000 })
    .toBeGreaterThan(0);
  const firstLesson = page.getByRole('button', { name: 'First words', exact: true });
  await expect(firstLesson).toBeEnabled();
  await firstLesson.click();
  await page.getByRole('button', { name: 'Begin practice' }).click();
  // v2 lesson player opens offline; its model audio is part of the installed pack.
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'First words', exact: true })).toBeVisible();
});

// Roadmap 3A: standalone offline Listen. The audio-lesson path used to exist
// only inside the hosted app — a learner who saved a language for offline study
// lost Listen entirely, and the long track was not in any pack's media array, so
// the download never cached it either. Now the download takes the audio with it
// and Listen is a view in the downloaded edition.
test('the downloaded edition can listen to the audio lesson with the network off', async ({ page, context }) => {
  await page.goto('/courses/french#offline-download');
  await page.getByRole('button', { name: 'Download for offline study', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open offline study' })).toBeVisible({ timeout: 30000 });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);

  // The audio came with the download, not with a first play: the track is in the
  // installed pack cache before the network is ever switched off, and the size
  // was quoted to the learner before they pressed download.
  await expect(page.getByText(/and 4\.9 MB of audio lessons/)).toBeVisible();
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    for (const key of keys.filter((name) => name.startsWith('verbalibera-pack-'))) {
      const cache = await caches.open(key);
      if (await cache.match('/audio/french-foundations/fr-identity-listen.mp3')) return true;
    }
    return false;
  });
  expect(cached).toBe(true);

  await context.setOffline(true);
  await page.goto('/study.html?language=french&view=listen');
  await expect(page.getByRole('heading', { name: 'Listen', exact: true })).toBeVisible();
  await expect(page.getByText(/Saved on this device: 4\.9 MB of audio lessons/)).toBeVisible();
  const track = page.getByRole('button', { name: 'Names and introductions', exact: true });
  await track.click();
  const player = page.getByLabel('Play the audio lesson: Names and introductions');
  await expect(player).toHaveAttribute('src', '/audio/french-foundations/fr-identity-listen.mp3');
  // A real decode with no connection at all — the point of the whole slice.
  await player.evaluate(async (audio: HTMLAudioElement) => {
    audio.load();
    await new Promise<void>((resolve, reject) => {
      audio.addEventListener('loadedmetadata', () => resolve(), { once: true });
      audio.addEventListener('error', () => reject(new Error('Audio failed to decode offline')), { once: true });
    });
    await audio.play();
  });
  expect(await player.evaluate((audio: HTMLAudioElement) => audio.duration)).toBeGreaterThan(480);
  await expect.poll(() => player.evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeGreaterThan(0);

  // Position is kept offline too, and a cold start picks it up.
  await player.evaluate((audio: HTMLAudioElement) => {
    audio.currentTime = 300;
  });
  await expect.poll(() =>
    page.evaluate(() => localStorage.getItem('verbalibera_listen_position:fr-identity-foundation')),
  ).toBe('300');
  await player.evaluate((audio: HTMLAudioElement) => audio.pause());
  await page.goto('/study.html?language=french&view=listen');
  await page.getByRole('button', { name: 'Names and introductions', exact: true }).click();
  await expect(page.getByText(/(resume from|resumed at) 5:00/i)).toBeVisible();
  await context.setOffline(false);
});

test('a scene viewed online is cached, so the picture is there with no connection', async ({
  page,
  context,
}) => {
  await page.goto('/learn/english-to-french?concept=fr-ordering-politely');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // The worker caches `/images/**` on fetch rather than installing the scenes with
  // every visit, so this is the guarantee that matters: after a learner has seen the
  // picture once, it is on the device.
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const scene = page.locator('img[src="/images/scenes/ordering-coffee.jpg"]');
  await expect
    .poll(() => scene.evaluate((img: HTMLImageElement) => img.naturalWidth), { timeout: 15000 })
    .toBeGreaterThan(0);

  const cached = await page.evaluate(() =>
    caches.match('/images/scenes/ordering-coffee.jpg').then((hit) => !!hit),
  );
  expect(cached, 'the scene is not in the cache after being viewed').toBe(true);

  // And it really is the cache answering: with the network off, the same URL still
  // resolves to bytes.
  await context.setOffline(true);
  const offlineHit = await page.evaluate(() =>
    caches.match('/images/scenes/ordering-coffee.jpg').then((hit) => !!hit),
  );
  expect(offlineHit, 'the scene disappeared from the cache when the network went off').toBe(true);
});
