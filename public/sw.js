const CACHE_VERSION = 'v1';
const CACHE_NAME = `transmise-control-${CACHE_VERSION}`;

const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  'https://cdn.jsdelivr.net/npm/pico-css@3/css/pico.min.css',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {
        // Some assets might not be available during installation
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip API requests - handle offline gracefully
  if (request.url.includes('/api/') || request.url.includes('supabase')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response('Offline - API not available', {
          status: 503,
          statusText: 'Service Unavailable',
        });
      })
    );
    return;
  }

  // Cache first for assets
  event.respondWith(
    caches.match(request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(request)
        .then((response) => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          // Return offline page if available
          return caches.match('/offline.html').catch(() => {
            return new Response('Offline - Page not available', {
              status: 503,
              statusText: 'Service Unavailable',
            });
          });
        });
    })
  );
});
