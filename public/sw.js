const STATIC_CACHE = 'verbalibera-static-v2';
const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/icons/verbalibera-192.png',
  '/icons/verbalibera-512.png',
  '/icons/verbalibera-maskable-512.png',
  '/illustrations/daily-practice.png',
  '/learn/english-to-french',
  '/learn/english-to-italian',
  '/learn/english-to-spanish',
  '/learn/english-to-portuguese',
  '/audio/french-ordering/fr-ordering-politely-prompt.wav',
  '/audio/french-ordering/fr-ordering-politely-answer.wav',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => (key.startsWith('verbalibera-static-') || key.startsWith('voxlibre-static-')) && key !== STATIC_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // API routes are never cached — Cache-Control: no-store (handled by server, bypassed here)
  // This preserves privacy: learner progress and auth responses stay network-only.
  if (request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return;
  }

  // App shell, lesson routes, audio, images, and Next static are cached for offline use.
  // Precaches: /, /learn/*, /audio/**, /images/**, /_next/static/**
  if (
    url.pathname === '/' ||
    url.pathname.startsWith('/learn/') ||
    url.pathname.startsWith('/audio/') ||
    url.pathname.startsWith('/images/') ||
    url.pathname.startsWith('/_next/static/')
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then(
            (cached) => cached ?? caches.match('/offline.html').then((response) => response ?? Response.error()),
          ),
        ),
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/offline.html').then((response) => response ?? Response.error())),
    );
  }
});
