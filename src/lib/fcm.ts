import { initializeApp } from 'firebase/app';
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
let app = null;
try {
  app = initializeApp(firebaseConfig);
} catch (error) {
  // App already initialized
  app = require('firebase/app').getApp();
}

/**
 * Request notification permission and get FCM token
 */
export async function requestNotificationPermission(): Promise<string | null> {
  try {
    // Check if notifications are supported
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return null;
    }

    // Request permission if not already granted
    if (Notification.permission === 'denied') {
      console.log('Notification permission denied');
      return null;
    }

    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('Notification permission not granted');
        return null;
      }
    }

    // Get FCM token
    if (!process.env.NEXT_PUBLIC_FCM_VAPID_KEY) {
      console.warn('FCM VAPID key not configured');
      return null;
    }

    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FCM_VAPID_KEY,
    });

    console.log('FCM Token obtained:', token);
    return token;
  } catch (error) {
    console.error('Failed to get FCM token:', error);
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
      console.log('Foreground message received:', payload);

      const notificationTitle = payload.notification?.title || 'Notification';
      const notificationOptions: NotificationOptions = {
        body: payload.notification?.body || '',
        icon: '/ybm_logo.png',
        badge: '/ybm_logo.png',
      };

      // Show notification in foreground
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification(notificationTitle, notificationOptions);
        });
      }
    });
  } catch (error) {
    console.error('Failed to setup foreground notifications:', error);
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
      throw new Error('Failed to save FCM token');
    }

    console.log('FCM token saved to database');
  } catch (error) {
    console.error('Failed to save FCM token:', error);
  }
}
