import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase (reuse existing instance if available)
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

/**
 * Request notification permission and get FCM token
 */
export async function requestNotificationPermission(): Promise<string | null> {
  try {
    // Check if notifications are supported
    if (!('Notification' in window)) {
      console.log('[FCM] This browser does not support notifications');
      return null;
    }

    // Request permission if not already granted
    if (Notification.permission === 'denied') {
      console.log('[FCM] Notification permission denied');
      return null;
    }

    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('[FCM] Notification permission not granted');
        return null;
      }
    }

    // Check VAPID key
    if (!process.env.NEXT_PUBLIC_FCM_VAPID_KEY) {
      console.error('[FCM] VAPID key not configured in environment variables!');
      return null;
    }

    // CRITICAL: Wait for service worker to be ready before getting token
    console.log('[FCM] Waiting for service worker...');
    const registration = await navigator.serviceWorker.ready;
    console.log('[FCM] Service worker ready:', registration.scope);

    const messaging = getMessaging(app);

    // Get token with explicit service worker registration
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FCM_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    console.log('[FCM] ✅ Token obtained:', token?.substring(0, 20) + '...');
    return token;
  } catch (error) {
    console.error('[FCM] Failed to get FCM token:', error);
    return null;
  }
}

/**
 * Listen for foreground messages and show notification
 */
export function setupForegroundNotifications(): void {
  try {
    const messaging = getMessaging(app);

    onMessage(messaging, (payload) => {
      console.log('[FCM] Foreground message received:', payload);

      const notificationTitle = payload.notification?.title || 'Ramadhan Tracker';
      const notificationOptions: NotificationOptions = {
        body: payload.notification?.body || 'Ada notifikasi baru',
        icon: '/icon512_maskable.png',
        badge: '/ybm_logo.png',
        tag: 'ramadhan-notification',
        requireInteraction: true, // Keep notification until user interacts
        data: payload.data,
      };

      // Show notification via service worker
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((registration) => {
          console.log('[FCM] Showing foreground notification via service worker');
          // Some browsers suppress notifications if the tab is focused.
          // We force it, but if it fails, we log it.
          registration.showNotification(notificationTitle, notificationOptions)
            .catch(err => console.error('[FCM] Service Worker showNotification failed:', err));
        }).catch(err => console.error('[FCM] Service Worker not ready:', err));
      } else {
        // Fallback for non-SW environments (rare for PWA)
        new Notification(notificationTitle, notificationOptions);
      }
    });

    console.log('[FCM] Foreground notifications setup complete');
  } catch (error) {
    console.error('[FCM] Failed to setup foreground notifications:', error);
  }
}

/**
 * Save FCM token to database (call this after getting token)
 */
export async function saveFCMTokenToDatabase(userId: string, token: string): Promise<void> {
  try {
    const response = await fetch('/api/fcm/save-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        token,
        userAgent: navigator.userAgent,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to save FCM token: ${response.status}`);
    }

    console.log('[FCM] ✅ Token saved to database');
  } catch (error) {
    console.error('[FCM] Failed to save token to database:', error);
  }
}
