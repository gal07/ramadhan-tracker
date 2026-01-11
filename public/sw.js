// Service Worker untuk PWA dan FCM
const CACHE_NAME = 'ramadhan-tracker-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/ybm_logo.png',
  '/favicon.ico',
];

// Import Firebase Messaging (for background notifications)
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Setup Firebase Messaging if available (safe to call even if not configured)
try {
  if (typeof firebase !== 'undefined' && firebase.messaging) {
    firebase.initializeApp({
      apiKey: "AIzaSyBNylF4mEPkCR-Ct0dMJ7CGSSKX-rxa3JI",
      authDomain: "ramadhan-tracker.firebaseapp.com",
      projectId: "ramadhan-tracker",
      storageBucket: "ramadhan-tracker.firebasestorage.app",
      messagingSenderId: "900979907746",
      appId: "1:900979907746:web:bb05c7409291d34da4cbfb",
    });

    const messaging = firebase.messaging();

    // Handle background messages
    messaging.onBackgroundMessage((payload) => {
      console.log('Background FCM message received:', payload);
      const notificationTitle = payload.notification?.title || 'Notification';
      const notificationOptions = {
        body: payload.notification?.body || '',
        icon: '/ybm_logo.png',
        badge: '/ybm_logo.png',
      };
      self.registration.showNotification(notificationTitle, notificationOptions);
    });
  }
} catch (error) {
  console.log('FCM not fully configured, continuing without it:', error.message);
}

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
