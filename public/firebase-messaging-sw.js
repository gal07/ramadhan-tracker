// Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
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
  console.log('Background message received:', payload);
  
  const notificationTitle = payload.notification?.title || 'Ramadhan Tracker';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/ybm_logo.png',
    badge: '/ybm_logo.png',
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
