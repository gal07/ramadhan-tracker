// Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
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
} catch (error) {
  console.error('[SW] Firebase initialization error:', error);
}

const messaging = firebase.messaging();

// Handle background messages (untuk FCM campaigns dari Firebase Console)
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message received:', payload);
  
  const notificationTitle = payload.notification?.title || 'Ramadhan Tracker';
  const notificationOptions = {
    body: payload.notification?.body || 'Ada notifikasi baru',
    icon: payload.notification?.icon || '/ybm_logo.png',
    badge: payload.notification?.icon || '/ybm_logo.png',
    vibrate: [200, 100, 200],
    tag: 'ramadhan-notification',
    requireInteraction: false,
    data: payload.data || {},
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification.tag);
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then((clientList) => {
        // Check if window already open
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window if not found
        if (clients.openWindow) {
          return clients.openWindow('/dashboard');
        }
      })
  );
});
