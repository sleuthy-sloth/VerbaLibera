import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function readWorkerSource() {
  return readFile(path.join(process.cwd(), 'public/sw.js'), 'utf8');
}

describe('static PWA service worker contract', () => {
  it('declares only the approved immutable offline assets', async () => {
    // Break caught: the install cache silently expands to mutable, authenticated, or voice responses.
    const source = await readWorkerSource();

    expect(source).toContain("const STATIC_CACHE = 'voxlibre-static-v1'");
    expect(source).toContain("'/offline.html'");
    expect(source).toContain("'/icons/voxlibre-192.png'");
    expect(source).toContain("'/icons/voxlibre-512.png'");
    expect(source).toContain("'/icons/voxlibre-maskable-512.png'");
    expect(source).toContain("'/illustrations/daily-practice.png'");
  });

  it('keeps API requests out of the worker and limits fallback to navigation', async () => {
    // Break caught: privacy-sensitive APIs are intercepted or failed resource requests receive the app shell.
    const source = await readWorkerSource();

    expect(source).toContain("url.pathname.startsWith('/api/')");
    expect(source).toContain("if (request.mode === 'navigate')");
    expect(source).toContain("caches.match('/offline.html')");
  });

  it('removes only stale VoxLibre static cache versions on activation', async () => {
    // Break caught: activation removes another application's cache or retains obsolete VoxLibre static assets.
    const source = await readWorkerSource();

    expect(source).toContain("key.startsWith('voxlibre-static-') && key !== STATIC_CACHE");
  });
});
