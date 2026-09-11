import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { vi } from 'vitest';

type WorkerHandler = (event: never) => void;

async function readWorkerSource() {
  return readFile(path.join(process.cwd(), 'public/sw.js'), 'utf8');
}

function staticAssetsFrom(source: string) {
  const declaration = source.match(/const STATIC_ASSETS = (\[[\s\S]*?\]);/);

  if (!declaration) {
    throw new Error('STATIC_ASSETS declaration is missing.');
  }

  return [...declaration[1].matchAll(/'([^']+)'/g)].map(([, asset]) => asset);
}

async function evaluateWorker(
  cacheKeys = ['verbalibera-static-v0', 'verbalibera-static-v1', 'verbalibera-static-v2', 'another-app-cache'],
) {
  const handlers = new Map<string, WorkerHandler>();
  const cacheDelete = vi.fn().mockResolvedValue(true);
  const cacheMatch = vi.fn().mockResolvedValue(undefined);
  const cachePut = vi.fn().mockResolvedValue(undefined);
  const cacheAddAll = vi.fn().mockResolvedValue(undefined);
  const cacheOpen = vi.fn().mockImplementation(() =>
    Promise.resolve({ addAll: cacheAddAll, match: cacheMatch, put: cachePut }),
  );
  const networkFetch = vi.fn().mockResolvedValue(new Response('ok'));
  const clients = { claim: vi.fn() };

  runInNewContext(await readWorkerSource(), {
    URL,
    Response,
    caches: {
      delete: cacheDelete,
      keys: vi.fn().mockResolvedValue(cacheKeys),
      match: cacheMatch,
      open: cacheOpen,
    },
    fetch: networkFetch,
    self: {
      addEventListener: (eventName: string, handler: WorkerHandler) => handlers.set(eventName, handler),
      clients,
      skipWaiting: vi.fn(),
    },
  });

  return { cacheDelete, cacheMatch, cachePut, cacheAddAll, cacheOpen, clients, handlers, networkFetch };
}

describe('static PWA service worker contract', () => {
  it('declares exactly the approved immutable offline assets', async () => {
    // Break caught: the install cache silently expands to mutable, authenticated, or voice responses.
    const assets = staticAssetsFrom(await readWorkerSource());

    expect(assets).toEqual([
      '/offline.html',
      '/icons/verbalibera-192.png',
      '/icons/verbalibera-512.png',
      '/icons/verbalibera-maskable-512.png',
      '/brand/logo-mark.jpg',
      '/brand/logo-lockup.jpg',
      '/brand/hero-banner.jpg',
      '/brand/empty-journal.jpg',
      '/brand/courses/french.jpg',
      '/brand/courses/italian.jpg',
      '/brand/courses/spanish.jpg',
      '/brand/courses/portuguese.jpg',
      '/brand/courses/german.jpg',
      '/brand/player-card.jpg',
      '/brand/player-lock.jpg',
      '/audio/french-ordering/fr-ordering-politely-prompt.wav',
      '/audio/french-ordering/fr-ordering-politely-answer.wav',
      '/audio/french-foundations/fr-identity-listen.mp3',
    ]);
  });

  it('precaches every image the offline page renders', async () => {
    // Break caught: an image added to `public/offline.html` without being added
    // here. That page is what a learner sees when nothing else can load, so a
    // missing precache is not a slow image — it is a broken one, on the one
    // screen whose whole job is to say the app still works.
    const assets = staticAssetsFrom(await readWorkerSource());
    const page = await readFile(path.join(process.cwd(), 'public/offline.html'), 'utf8');
    const images = [...page.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map(([, src]) => src);

    expect(images.length, 'the offline page renders no image at all').toBeGreaterThan(0);
    for (const src of images)
      expect(assets, `${src} is not precached, so it cannot load offline`).toContain(src);
    // And the page's fallback copy is not an image's job to carry.
    expect(page).toMatch(/<img\b[^>]*\balt=""/);
  });

  it('bypasses API requests and only supplies the offline fallback to failed navigation', async () => {
    // Break caught: privacy-sensitive APIs are intercepted or failed resources receive the app shell.
    const { cacheMatch, handlers, networkFetch } = await evaluateWorker();
    const fetchHandler = handlers.get('fetch');
    const apiEvent = {
      request: { method: 'GET', mode: 'navigate', url: 'https://verbalibera.test/api/demo/progress' },
      respondWith: vi.fn(), waitUntil: vi.fn(),
    };
    const resourceEvent = {
      request: { method: 'GET', mode: 'cors', url: 'https://verbalibera.test/unmanaged-resource.bin' },
      respondWith: vi.fn(), waitUntil: vi.fn(),
    };

    fetchHandler?.(apiEvent as never);
    fetchHandler?.(resourceEvent as never);

    expect(apiEvent.respondWith).not.toHaveBeenCalled();
    expect(resourceEvent.respondWith).not.toHaveBeenCalled();
    expect(networkFetch).not.toHaveBeenCalled();

    const offlineResponse = new Response('offline path');
    cacheMatch.mockImplementation((arg: unknown) => {
      if (arg === '/offline.html') return Promise.resolve(offlineResponse);
      return Promise.resolve(undefined);
    });
    networkFetch.mockRejectedValue(new Error('network unavailable'));
    const navigationEvent = {
      request: { method: 'GET', mode: 'navigate', url: 'https://verbalibera.test/learn/english-to-french' },
      respondWith: vi.fn(), waitUntil: vi.fn(),
    };

    fetchHandler?.(navigationEvent as never);

    expect(navigationEvent.respondWith).toHaveBeenCalledTimes(1);
    expect(networkFetch).toHaveBeenCalledWith(navigationEvent.request);
    await expect(navigationEvent.respondWith.mock.calls[0][0]).resolves.toBe(offlineResponse);
    expect(cacheMatch).toHaveBeenCalledWith('/offline.html');
  });

  it('deletes only stale VerbaLibera static cache versions on activation', async () => {
    // Break caught: activation removes another application's cache or retains obsolete VerbaLibera static assets.
    const { cacheDelete, clients, handlers } = await evaluateWorker([
      'verbalibera-static-v0',
      'verbalibera-static-v1',
      'verbalibera-static-v2',
      'voxlibre-static-v2',
      'another-app-cache',
    ]);
    const activateHandler = handlers.get('activate');
    const activationEvent = { waitUntil: vi.fn() };

    activateHandler?.(activationEvent as never);

    expect(activationEvent.waitUntil).toHaveBeenCalledTimes(1);
    await activationEvent.waitUntil.mock.calls[0][0];

    expect(cacheDelete).toHaveBeenCalledTimes(4);
    expect(cacheDelete).toHaveBeenCalledWith('verbalibera-static-v0');
    expect(cacheDelete).toHaveBeenCalledWith('verbalibera-static-v1');
    expect(cacheDelete).toHaveBeenCalledWith('voxlibre-static-v2');
    expect(cacheDelete).toHaveBeenCalledWith('verbalibera-static-v2');
    expect(cacheDelete).not.toHaveBeenCalledWith('another-app-cache');
    expect(clients.claim).toHaveBeenCalledTimes(1);
  });

  it('keeps navigation private while caching audio and Next static', async () => {
    // Break caught: service worker regresses to v1, misses lesson/audio, or caches private API responses.
    const source = await readWorkerSource();

    // Cache changes must invalidate the previous shell.
    const worker = await evaluateWorker(['verbalibera-static-v7']);
    const activation = { waitUntil: vi.fn() };
    worker.handlers.get('activate')?.(activation as never);
    await activation.waitUntil.mock.calls[0][0];
    expect(worker.cacheDelete).toHaveBeenCalledWith('verbalibera-static-v7');
    // A precise pattern: `/verbalibera-static-v1/` also matches v10, v11 and
    // v199, so the guard used to pass for a worker that had never left v1.
    expect(source).not.toMatch(/verbalibera-static-v1['"]/);

    // Cache-Control no-store must still be documented for /api/* (privacy boundary)
    // grep for Cache-Control no-store and absence of /api in precache
    expect(source).toMatch(/Cache-Control/);
    expect(source).toMatch(/no-store/);
    expect(source).toMatch(/\/api\//);

    const assets = staticAssetsFrom(source);
    // precache must include app shell
    expect(assets).not.toContain('/');
    expect(assets).toContain('/offline.html');
    // precache must include lesson routes (/learn/*)
    expect(assets.some((a) => a.startsWith('/learn/'))).toBe(false);
    // precache must include audio (**)
    expect(assets.some((a) => a.startsWith('/audio/'))).toBe(true);
    // precache handling for Next static (verified via source contains _next/static)
    expect(source).toMatch(/\/_next\/static/);
    // never cache API
    expect(assets.some((a) => a.includes('/api'))).toBe(false);
    expect(assets.some((a) => a.includes('/api/demo/progress'))).toBe(false);

    // runtime behavior: lesson/audio/images/next-static should be served via cache, api must bypass
    const { handlers } = await evaluateWorker();
    const fetchHandler = handlers.get('fetch');
    const lessonEvent = {
      request: { method: 'GET', mode: 'navigate', url: 'https://verbalibera.test/learn/english-to-french' },
      respondWith: vi.fn(), waitUntil: vi.fn(),
    };
    const audioEvent = {
      request: { method: 'GET', mode: 'cors', url: 'https://verbalibera.test/audio/french-ordering/fr-ordering-politely-prompt.wav' },
      respondWith: vi.fn(), waitUntil: vi.fn(),
    };
    const imageEvent = {
      request: { method: 'GET', mode: 'cors', url: 'https://verbalibera.test/images/vocab/coffee.jpg' },
      respondWith: vi.fn(), waitUntil: vi.fn(),
    };
    const nextStaticEvent = {
      request: { method: 'GET', mode: 'cors', url: 'https://verbalibera.test/_next/static/chunks/webpack.js' },
      respondWith: vi.fn(), waitUntil: vi.fn(),
    };
    const apiEvent2 = {
      request: { method: 'GET', mode: 'cors', url: 'https://verbalibera.test/api/demo/progress' },
      respondWith: vi.fn(), waitUntil: vi.fn(),
    };

    fetchHandler?.(lessonEvent as never);
    fetchHandler?.(audioEvent as never);
    fetchHandler?.(imageEvent as never);
    fetchHandler?.(nextStaticEvent as never);
    fetchHandler?.(apiEvent2 as never);

    // lessons, audio, images, and Next static must be intercepted (respondWith called)
    expect(lessonEvent.respondWith).toHaveBeenCalledTimes(1);
    expect(audioEvent.respondWith).toHaveBeenCalledTimes(1);
    expect(imageEvent.respondWith).toHaveBeenCalledTimes(1);
    expect(nextStaticEvent.respondWith).toHaveBeenCalledTimes(1);
    // api must never be intercepted
    expect(apiEvent2.respondWith).not.toHaveBeenCalled();
  });
});

it('never puts personalized lesson HTML into the shared browser cache', async () => {
  const { handlers, networkFetch, cachePut } = await evaluateWorker();
  const privatePage = new Response('private account lesson', { headers: { 'Cache-Control': 'private, no-store' } });
  networkFetch.mockResolvedValue(privatePage);
  const event = { request: { method: 'GET', mode: 'navigate', url: 'https://verbalibera.test/learn/english-to-french' }, respondWith: vi.fn() };
  handlers.get('fetch')?.(event as never);
  await expect(event.respondWith.mock.calls[0][0]).resolves.toBe(privatePage);
  await Promise.resolve();
  expect(cachePut).not.toHaveBeenCalled();
});

it('serves the cached course banner when the downloaded lesson is offline', async () => {
  const { handlers, networkFetch, cacheMatch } = await evaluateWorker();
  const banner = new Response('saved-banner-bytes');
  networkFetch.mockRejectedValue(new Error('offline'));
  cacheMatch.mockResolvedValue(banner);
  const event = { request: { method: 'GET', mode: 'cors', url: 'https://verbalibera.test/brand/courses/italian.jpg' }, respondWith: vi.fn(), waitUntil: vi.fn() };
  handlers.get('fetch')?.(event as never);
  expect(event.respondWith).toHaveBeenCalledTimes(1);
  await expect(event.respondWith.mock.calls[0][0]).resolves.toBe(banner);
});

it.each([
  { status: 200, stored: true },
  { status: 206, stored: false },
])('returns audio HTTP $status while caching only complete responses', async ({ status, stored }) => {
  const { handlers, networkFetch, cachePut } = await evaluateWorker();
  const response = new Response('audio bytes', {
    status,
    headers: {
      'Content-Type': 'audio/mpeg',
      ...(status === 206 ? { 'Content-Range': 'bytes 0-10/100' } : {}),
    },
  });
  networkFetch.mockResolvedValue(response);
  const event = {
    request: {
      method: 'GET', mode: 'cors',
      url: 'https://verbalibera.test/audio/italian-foundations/it-market-foundation-listen.mp3',
    },
    respondWith: vi.fn(), waitUntil: vi.fn(),
  };
  handlers.get('fetch')?.(event as never);
  await expect(event.respondWith.mock.calls[0][0]).resolves.toBe(response);
  await Promise.all(event.waitUntil.mock.calls.map(([pending]) => pending));
  expect(cachePut).toHaveBeenCalledTimes(stored ? 1 : 0);
});

/**
 * The offline matrix's failure half (roadmap 3A).
 *
 * The happy path — install a course, disconnect, open it — is covered by
 * `tests/e2e/offline.spec.ts` against a real service worker. These cases are the
 * ones that are hard to reach from outside: what the worker serves when the
 * network is gone, and what it refuses to serve when a download never finished.
 * A partially installed course that still answered would be worse than no
 * course at all, because the learner would hear a track that stops halfway.
 */
describe('the offline matrix: what the worker serves when the network is gone', () => {
  const PACK_CACHE = 'verbalibera-pack-fr-foundations-1.0.0-abc';
  const READY = '/__course_pack_ready__';

  /** An installed cache: the ready marker plus one asset. */
  function installed(assetPath: string, asset: Response, ready = true) {
    return (key: unknown) =>
      Promise.resolve(
        key === READY ? (ready ? new Response('1.0.0') : undefined) : key === assetPath ? asset : undefined,
      );
  }

  it('serves a saved course pack with the network down', async () => {
    const saved = new Response('{"schemaVersion":2}');
    const { handlers, networkFetch, cacheMatch } = await evaluateWorker([PACK_CACHE]);
    networkFetch.mockRejectedValue(new Error('offline'));
    cacheMatch.mockImplementation(installed('/packs/french.json', saved));
    const event = {
      request: { method: 'GET', mode: 'cors', url: 'https://verbalibera.test/packs/french.json' },
      respondWith: vi.fn(),
    };
    handlers.get('fetch')?.(event as never);
    await expect(event.respondWith.mock.calls[0][0]).resolves.toBe(saved);
  });

  it('serves the long audio lesson from the installed pack, not only from the static cache', async () => {
    // The track is cached by the download (`installPack`), not by a first play.
    const track = new Response('mp3 bytes');
    const { handlers, networkFetch, cacheMatch } = await evaluateWorker([PACK_CACHE]);
    networkFetch.mockRejectedValue(new Error('offline'));
    cacheMatch.mockImplementation(
      installed('/audio/french-foundations/fr-identity-listen.mp3', track),
    );
    const event = {
      request: {
        method: 'GET',
        mode: 'cors',
        url: 'https://verbalibera.test/audio/french-foundations/fr-identity-listen.mp3',
      },
      respondWith: vi.fn(),
      waitUntil: vi.fn(),
    };
    handlers.get('fetch')?.(event as never);
    await expect(event.respondWith.mock.calls[0][0]).resolves.toBe(track);
  });

  it('refuses to serve a download that never finished', async () => {
    // No ready marker means `installPack` never committed: the cache belongs to
    // an interrupted download, and serving from it is how a learner ends up
    // with half a course.
    const orphaned = new Response('{"schemaVersion":2,"truncated":true}');
    const { handlers, networkFetch, cacheMatch } = await evaluateWorker([PACK_CACHE]);
    networkFetch.mockRejectedValue(new Error('offline'));
    cacheMatch.mockImplementation(installed('/packs/french.json', orphaned, false));
    const event = {
      request: { method: 'GET', mode: 'cors', url: 'https://verbalibera.test/packs/french.json' },
      respondWith: vi.fn(),
    };
    handlers.get('fetch')?.(event as never);
    const served = await event.respondWith.mock.calls[0][0];
    // An error response, not the orphaned bytes.
    expect(served.status).toBe(0);
    expect(served).not.toBe(orphaned);
  });

  it('does not treat another app\u2019s pack cache as an installation', async () => {
    const { handlers, networkFetch, cacheMatch } = await evaluateWorker(['verbalibera-static-v9']);
    networkFetch.mockRejectedValue(new Error('offline'));
    cacheMatch.mockImplementation(installed('/packs/french.json', new Response('bytes')));
    const event = {
      request: { method: 'GET', mode: 'cors', url: 'https://verbalibera.test/packs/french.json' },
      respondWith: vi.fn(),
    };
    handlers.get('fetch')?.(event as never);
    const served = await event.respondWith.mock.calls[0][0];
    expect(served.status).toBe(0);
  });
});
