const CACHE_NAME = 'winesnap-v2';
const STATIC_CACHE = 'winesnap-static-v1';
const RUNTIME_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/placeholder.svg',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[Service Worker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

const shouldCacheRuntime = (request) => {
  const allowedDestinations = ['document', 'style', 'script', 'image'];
  const url = new URL(request.url);
  return (
    url.origin === self.location.origin &&
    allowedDestinations.includes(request.destination)
  );
};

const getValidCachedResponse = async (request) => {
  const cached = await caches.match(request);
  if (!cached) return null;

  const fetchedAt = cached.headers.get('X-SW-Fetched-At');
  if (fetchedAt) {
    const age = Date.now() - Number(fetchedAt);
    if (Number.isFinite(age) && age > RUNTIME_TTL_MS) {
      const cache = await caches.open(CACHE_NAME);
      await cache.delete(request);
      return null;
    }
  }

  return cached;
};

const createTimestampedResponse = (response) => {
  const headers = new Headers(response.headers);
  headers.set('X-SW-Fetched-At', Date.now().toString());

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

// Fetch event - network first with scoped runtime caching and offline fallbacks
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET' || !request.url.startsWith('http')) {
    return;
  }

  const isRuntimeCacheable = shouldCacheRuntime(request);

  event.respondWith((async () => {
    try {
      const networkResponse = await fetch(request);

      if (isRuntimeCacheable && networkResponse.status === 200) {
        const cache = await caches.open(CACHE_NAME);
        const timestampedResponse = createTimestampedResponse(networkResponse.clone());
        cache.put(request, timestampedResponse);
      }

      return networkResponse;
    } catch (error) {
      if (isRuntimeCacheable) {
        const cachedResponse = await getValidCachedResponse(request);
        if (cachedResponse) {
          return cachedResponse;
        }

        if (request.mode === 'navigate') {
          const fallback = await caches.match('/index.html');
          if (fallback) return fallback;
        }
      }

      return new Response('Offline - API response unavailable', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: new Headers({
          'Content-Type': 'text/plain',
          'X-SW-Error': 'offline-api',
        }),
      });
    }
  })());
});
