const STATIC_CACHE = 'voxlibre-static-v1';
const STATIC_ASSETS = [
  '/offline.html',
  '/icons/voxlibre-192.png',
  '/icons/voxlibre-512.png',
  '/icons/voxlibre-maskable-512.png',
  '/illustrations/daily-practice.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('voxlibre-static-') && key !== STATIC_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/offline.html').then((response) => response ?? Response.error())),
    );
  }
});
