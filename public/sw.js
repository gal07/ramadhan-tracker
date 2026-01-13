// ============================================================================
// Service Worker untuk PWA + FCM (Unified - Handles both PWA caching and FCM)
// ============================================================================
const CACHE_NAME = 'ramadhan-tracker-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/icon512_maskable.png',
  '/favicon.ico',
];

// Import Firebase Messaging (for background notifications when app is closed)
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// ============================================================================
// Install Event - Cache resources for PWA offline support
// ============================================================================
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[SW] Install complete, skipping waiting');
        return self.skipWaiting();
      })
  );
});

// ============================================================================
// Setup Firebase Messaging for Background Notifications
// THIS IS CRITICAL: Keeps service worker alive even when app is closed
// ============================================================================
let messaging = null;
try {
  firebase.initializeApp({
    apiKey: "AIzaSyBNylF4mEPkCR-Ct0dMJ7CGSSKX-rxa3JI",
    authDomain: "ramadhan-tracker.firebaseapp.com",
    projectId: "ramadhan-tracker",
    storageBucket: "ramadhan-tracker.firebasestorage.app",
    messagingSenderId: "900979907746",
    appId: "1:900979907746:web:bb05c7409291d34da4cbfb",
  });
  console.log('[SW] Firebase initialized successfully');
  
  messaging = firebase.messaging();

  // ========================================================================
  // CRITICAL: Handle background messages when app is closed
  // This handler KEEPS the service worker ALIVE and LISTENING
  // ========================================================================
  messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Background FCM message received:', payload);
    
    const notificationTitle = payload.notification?.title || 'Ramadhan Tracker';
    const notificationOptions = {
      body: payload.notification?.body || 'Ada notifikasi baru',
      icon: payload.notification?.icon || '/icon512_maskable.png',
      badge: payload.notification?.badge || '/ybm_logo.png',
      vibrate: [200, 100, 200],
      tag: 'ramadhan-notification',
      requireInteraction: false,
      data: payload.data || {},
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
  });
  
  console.log('[SW] Firebase Messaging initialized and listening for background messages');
} catch (error) {
  console.error('[SW] Firebase initialization error:', error);
}

// ============================================================================
// Activate Event - Clean old caches and claim all clients
// ============================================================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Service worker activated and claiming all clients');
      return self.clients.claim();
    })
  );
});

// ============================================================================
// Fetch Event - Cache strategy for PWA offline support
// ============================================================================
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip caching for auth-sensitive and API routes
  const isAuthSensitive = (
    url.pathname.startsWith('/dashboard') ||
    url.pathname.startsWith('/calendar') ||
    url.pathname.startsWith('/doa') ||
    url.pathname.startsWith('/quran') ||
    url.pathname.startsWith('/api/auth') ||
    url.pathname.startsWith('/api/fcm')
  );

  if (isAuthSensitive) {
    // Network-first for auth-sensitive routes
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first strategy for public assets
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
      }).catch(() => {
        // Return cached response if network fails
        return caches.match(event.request);
      });
    })
  );
});

// ============================================================================
// Notification Click Handler - Navigate to app when notification is clicked
// ============================================================================
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification.tag);
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if window already open
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url.includes('/dashboard') && 'focus' in client) {
            console.log('[SW] Focusing existing window');
            return client.focus();
          }
        }
        // Open new window if not found
        if (clients.openWindow) {
          console.log('[SW] Opening new window to /dashboard');
          return clients.openWindow('/dashboard');
        }
      })
  );
});

// ============================================================================
// Message Handler - Handle messages from clients
// ============================================================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Received SKIP_WAITING command');
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLIENTS_CLAIM') {
    console.log('[SW] Received CLIENTS_CLAIM command');
    self.clients.claim();
  }
});

console.log('[SW] Service Worker loaded and ready for FCM and PWA');
