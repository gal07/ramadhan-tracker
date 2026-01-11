// Service Worker untuk PWA
const CACHE_NAME = 'ramadhan-tracker-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/ybm_logo.png',
  '/favicon.ico',
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
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
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Jangan cache route yang sensitif terhadap auth
  const isAuthSensitive = (
    url.pathname.startsWith('/dashboard') ||
    url.pathname.startsWith('/calendar') ||
    url.pathname.startsWith('/api/auth')
  );

  if (isAuthSensitive) {
    // Selalu network-first tanpa menyentuh cache
    event.respondWith(fetch(event.request));
    return;
  }

  // Default: cache-first untuk aset publik
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }

      const fetchRequest = event.request.clone();
      return fetch(fetchRequest).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      });
    })
  );
});
