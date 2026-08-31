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
  cacheKeys = ['voxlibre-static-v0', 'voxlibre-static-v1', 'voxlibre-static-v2', 'another-app-cache'],
) {
  const handlers = new Map<string, WorkerHandler>();
  const cacheDelete = vi.fn().mockResolvedValue(true);
  const cacheMatch = vi.fn();
  const networkFetch = vi.fn();
  const clients = { claim: vi.fn() };

  runInNewContext(await readWorkerSource(), {
    URL,
    Response,
    caches: {
      delete: cacheDelete,
      keys: vi.fn().mockResolvedValue(cacheKeys),
      match: cacheMatch,
      open: vi.fn(),
    },
    fetch: networkFetch,
    self: {
      addEventListener: (eventName: string, handler: WorkerHandler) => handlers.set(eventName, handler),
      clients,
      skipWaiting: vi.fn(),
    },
  });

  return { cacheDelete, cacheMatch, clients, handlers, networkFetch };
}

describe('static PWA service worker contract', () => {
  it('declares exactly the approved immutable offline assets', async () => {
    // Break caught: the install cache silently expands to mutable, authenticated, or voice responses.
    const assets = staticAssetsFrom(await readWorkerSource());

    expect(assets).toEqual([
      '/offline.html',
      '/icons/voxlibre-192.png',
      '/icons/voxlibre-512.png',
      '/icons/voxlibre-maskable-512.png',
      '/illustrations/daily-practice.png',
    ]);
  });

  it('bypasses API requests and only supplies the offline fallback to failed navigation', async () => {
    // Break caught: privacy-sensitive APIs are intercepted or failed resources receive the app shell.
    const { cacheMatch, handlers, networkFetch } = await evaluateWorker();
    const fetchHandler = handlers.get('fetch');
    const apiEvent = {
      request: { method: 'GET', mode: 'navigate', url: 'https://voxlibre.test/api/demo/progress' },
      respondWith: vi.fn(),
    };
    const resourceEvent = {
      request: { method: 'GET', mode: 'cors', url: 'https://voxlibre.test/illustrations/daily-practice.png' },
      respondWith: vi.fn(),
    };

    fetchHandler?.(apiEvent as never);
    fetchHandler?.(resourceEvent as never);

    expect(apiEvent.respondWith).not.toHaveBeenCalled();
    expect(resourceEvent.respondWith).not.toHaveBeenCalled();
    expect(networkFetch).not.toHaveBeenCalled();

    const offlineResponse = new Response('offline path');
    cacheMatch.mockResolvedValue(offlineResponse);
    networkFetch.mockRejectedValue(new Error('network unavailable'));
    const navigationEvent = {
      request: { method: 'GET', mode: 'navigate', url: 'https://voxlibre.test/learn/english-to-french' },
      respondWith: vi.fn(),
    };

    fetchHandler?.(navigationEvent as never);

    expect(navigationEvent.respondWith).toHaveBeenCalledTimes(1);
    expect(networkFetch).toHaveBeenCalledWith(navigationEvent.request);
    await expect(navigationEvent.respondWith.mock.calls[0][0]).resolves.toBe(offlineResponse);
    expect(cacheMatch).toHaveBeenCalledWith('/offline.html');
  });

  it('deletes only stale VoxLibre static cache versions on activation', async () => {
    // Break caught: activation removes another application's cache or retains obsolete VoxLibre static assets.
    const { cacheDelete, clients, handlers } = await evaluateWorker();
    const activateHandler = handlers.get('activate');
    const activationEvent = { waitUntil: vi.fn() };

    activateHandler?.(activationEvent as never);

    expect(activationEvent.waitUntil).toHaveBeenCalledTimes(1);
    await activationEvent.waitUntil.mock.calls[0][0];

    expect(cacheDelete).toHaveBeenCalledTimes(2);
    expect(cacheDelete).toHaveBeenCalledWith('voxlibre-static-v0');
    expect(cacheDelete).toHaveBeenCalledWith('voxlibre-static-v2');
    expect(cacheDelete).not.toHaveBeenCalledWith('voxlibre-static-v1');
    expect(cacheDelete).not.toHaveBeenCalledWith('another-app-cache');
    expect(clients.claim).toHaveBeenCalledTimes(1);
  });
});
