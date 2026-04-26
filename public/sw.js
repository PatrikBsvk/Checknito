/**
 * Service Worker — Checknito PWA
 *
 * Strategie:
 *  - HTML stránky (navigace, dokumenty)  → NETWORK-FIRST
 *      Vždy se zkusí stáhnout čerstvá verze. Když je offline,
 *      spadneme do cache (poslední úspěšná verze stránky).
 *
 *  - Statické assety s hash v URL (/_next/static/*) → CACHE-FIRST
 *      Hash v názvu zaručuje že se URL při nové verzi změní,
 *      takže cachovat agresivně je bezpečné.
 *
 *  - API + Supabase → vždy network (nikdy necachujeme dynamická data).
 *
 * VERZE — bumpněte při každém významném changi nebo při každém deploji.
 * Když se název cache změní, `activate` smaže všechny předchozí cache,
 * což zaručí že staré HTML/JS bundly z minulého deploy zmizí.
 */
const CACHE_VERSION = 'v3-2025-04-26';
const CACHE_NAME = `checknito-${CACHE_VERSION}`;

// Pre-cache jen základní shell. Vše ostatní se nacachuje při prvním fetchi.
const PRECACHE_URLS = [
  '/manifest.json',
];

// --- Install: pre-cache & rovnou skipWaiting (aby se nový SW aktivoval hned)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
      .then(() => self.skipWaiting()),
  );
});

// --- Activate: smaž staré cache + převezmi kontrolu nad otevřenými klienty
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

// --- Helper: detekce typu requestu
const isNavigation = (request) =>
  request.mode === 'navigate' ||
  (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));

const isStaticAsset = (url) =>
  url.pathname.startsWith('/_next/static/') ||
  url.pathname.startsWith('/icons/') ||
  /\.(?:png|jpg|jpeg|svg|webp|ico|woff2?|ttf)$/.test(url.pathname);

const isAPIorSupabase = (url) =>
  url.pathname.startsWith('/api/') || url.hostname.includes('supabase');

// --- Fetch handler
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 1) API + Supabase — pass-through, žádná cache
  if (isAPIorSupabase(url)) {
    return; // necháme prohlížeč to vyřešit nativně
  }

  // 2) HTML / navigace — NETWORK-FIRST (klíčový fix pro update aplikace)
  if (isNavigation(request)) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          // Ulož čerstvou verzi do cache pro offline fallback
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, fresh.clone()).catch(() => {});
          return fresh;
        } catch {
          // Offline → poslední cached verze, fallback na home
          const cached = await caches.match(request);
          if (cached) return cached;
          const home = await caches.match('/');
          if (home) return home;
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        }
      })(),
    );
    return;
  }

  // 3) Statické assety s hash — CACHE-FIRST se stale-while-revalidate
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        try {
          const fresh = await fetch(request);
          if (fresh && fresh.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, fresh.clone()).catch(() => {});
          }
          return fresh;
        } catch {
          return new Response('Offline asset', { status: 503 });
        }
      })(),
    );
    return;
  }

  // 4) Vše ostatní (fonty, externí CSS atd.) — stale-while-revalidate
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      const networkPromise = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            cache.put(request, response.clone()).catch(() => {});
          }
          return response;
        })
        .catch(() => null);
      return cached || (await networkPromise) || new Response('Offline', { status: 503 });
    })(),
  );
});

// --- Postpříjem zprávy z klienta — umožňuje vynutit aktivaci nového SW
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
