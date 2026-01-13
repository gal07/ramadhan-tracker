╔════════════════════════════════════════════════════════════════════════════════╗
║                   RAMADHAN TRACKER - SERVICE WORKER & FCM ARCHITECTURE            ║
╚════════════════════════════════════════════════════════════════════════════════╝

┌──────────────────────────────────────────────────────────────────────────────┐
│  APPLICATION FLOW - When Notification Arrives                                 │
└──────────────────────────────────────────────────────────────────────────────┘

SCENARIO 1: App is OPEN
═════════════════════════════════════════════════════════════════════════════

  Firebase Cloud Messaging
           │
           ▼
    Browser receives message
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
  [App Open]  [SW Background]
     │           │
     ├─ onMessage listener
     │  (FCM Provider.tsx)
     │
     ├─ setupForegroundNotifications()
     │
     └─ Shows notification in foreground


SCENARIO 2: App is CLOSED (OR FORCE CLOSED)
═════════════════════════════════════════════════════════════════════════════

  Firebase Cloud Messaging
           │
           ▼
  Browser/OS wakes up
           │
           ▼
  Service Worker activates
  (separate process - ALWAYS running)
           │
           ▼
  onBackgroundMessage handler (sw.js line 56)
           │
           ▼
  self.registration.showNotification()
           │
           ▼
  ✅ Notification appears on desktop/lock screen
           │
  User clicks notification
           │
           ▼
  notificationclick event (sw.js line 147)
           │
           ▼
  Opens app to /dashboard
           │
           ▼
  ✅ App loads with notification context


┌──────────────────────────────────────────────────────────────────────────────┐
│  FILE STRUCTURE & RESPONSIBILITIES                                            │
└──────────────────────────────────────────────────────────────────────────────┘

PUBLIC/
├── sw.js (★ THE CORE - ONLY SERVICE WORKER)
│   ├─ Firebase Messaging initialization
│   ├─ onBackgroundMessage handler (keeps SW alive)
│   ├─ PWA caching strategy
│   ├─ Notification click handler
│   └─ Message handler for client communication
│
├── firebase-messaging-sw.js (DEPRECATED)
│   └─ Now contains only a comment
│
└── manifest.json (PWA configuration)

SRC/APP/COMPONENTS/
├── ServiceWorkerRegistration.tsx
│   ├─ Unregisters old/conflicting SWs
│   ├─ Registers /sw.js
│   └─ Handles SW updates
│
├── FCMProvider.tsx
│   ├─ Waits for user authentication
│   ├─ Calls requestNotificationPermission()
│   ├─ Gets FCM token
│   ├─ Saves token to database
│   └─ Sets up foreground notifications
│
└── (Other components that use notifications)

SRC/LIB/
└── fcm.ts
    ├─ requestNotificationPermission()
    │  └─ Waits for SW, gets token with VAPID key
    │
    ├─ setupForegroundNotifications()
    │  └─ Listens for messages when app open
    │
    └─ saveFCMTokenToDatabase()
       └─ Stores token for later use


┌──────────────────────────────────────────────────────────────────────────────┐
│  INITIALIZATION SEQUENCE (On App Load)                                        │
└──────────────────────────────────────────────────────────────────────────────┘

1. Page loads
   │
2. ServiceWorkerRegistration component mounts
   │
   ├─ Unregister old firebase-messaging-sw.js (if exists)
   │
   └─ Register /sw.js
      │
      └─ Service Worker lifecycle begins:
         ├─ install event
         │  └─ Cache app shell
         │
         ├─ Firebase initialization
         │  └─ Set up onBackgroundMessage listener
         │
         └─ activate event
            └─ Claim all clients

3. User authenticates (NextAuth)
   │
4. FCMProvider component mounts (when session exists)
   │
   └─ requestNotificationPermission()
      │
      ├─ Check Notification API support
      │
      ├─ Request user permission
      │
      ├─ Wait for Service Worker.ready
      │
      ├─ Call getMessaging()
      │
      ├─ Call getToken() with VAPID key
      │  └─ Pass service worker registration explicitly
      │
      └─ Return FCM token

5. Token obtained
   │
   └─ saveFCMTokenToDatabase()
      │
      └─ POST to /api/fcm/save-token

6. setupForegroundNotifications()
   │
   └─ Listen for messages via onMessage()
      └─ When message arrives (app open):
         └─ Show notification


┌──────────────────────────────────────────────────────────────────────────────┐
│  MESSAGE FLOW - HOW FCM TOKEN GETS TO BACKEND                                 │
└──────────────────────────────────────────────────────────────────────────────┘

User Logs In
    │
    ▼
FCMProvider mounts
    │
    ▼
requestNotificationPermission()
    │
    ▼
Service Worker activated & ready
    │
    ▼
getToken(messaging, {
  vapidKey: "...",
  serviceWorkerRegistration: registration  ← KEY: Pass SW to Firebase
})
    │
    ▼
Firebase returns FCM token
    │
    ▼
saveFCMTokenToDatabase(email, token)
    │
    ▼
POST /api/fcm/save-token
    │
    ├─ Headers: { "Content-Type": "application/json" }
    │
    └─ Body: {
        userId: "user@example.com",
        token: "device-fcm-token",
        userAgent: "Mozilla/5.0..."
       }
    │
    ▼
Backend stores token in Firestore/Database
    │
    ▼
Backend can now send notifications to this user


┌──────────────────────────────────────────────────────────────────────────────┐
│  WHY THIS ARCHITECTURE WORKS FOR APP CLOSED NOTIFICATIONS                     │
└──────────────────────────────────────────────────────────────────────────────┘

Service Worker ≠ Your App
├─ Service Worker is a SEPARATE JavaScript thread
├─ Runs in background even when:
│  ├─ App tab is closed
│  ├─ Browser is closed (if PWA installed)
│  └─ Device is asleep
│
└─ Firebase Cloud Messaging
   ├─ Sends to browser/OS
   ├─ NOT to specific app instance
   └─ Browser routes to service worker
      └─ Service worker shows notification

This is why onBackgroundMessage MUST be in service worker!


┌──────────────────────────────────────────────────────────────────────────────┐
│  ENVIRONMENT VARIABLES REQUIRED                                               │
└──────────────────────────────────────────────────────────────────────────────┘

In .env.local (NEXT_PUBLIC_* required for client-side):

✅ NEXT_PUBLIC_FIREBASE_API_KEY
✅ NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
✅ NEXT_PUBLIC_FIREBASE_PROJECT_ID
✅ NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
✅ NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
✅ NEXT_PUBLIC_FIREBASE_APP_ID
✅ NEXT_PUBLIC_FCM_VAPID_KEY          ← Most critical for notifications!

Where to get VAPID Key:
→ Firebase Console
→ Project Settings
→ Cloud Messaging tab
→ Web Push Certificates
→ Copy "Public Key"


┌──────────────────────────────────────────────────────────────────────────────┐
│  DEBUGGING LOGS TO LOOK FOR                                                   │
└──────────────────────────────────────────────────────────────────────────────┘

In browser console (F12):

During initialization:
  ✅ [Main] ✅ Service Worker registered successfully at scope: /
  ✅ [SW] Firebase initialized successfully
  ✅ [SW] Firebase Messaging initialized and listening for background messages

During FCM setup:
  ✅ [FCM Provider] Setting up FCM for user: user@example.com
  ✅ [FCM] Waiting for service worker...
  ✅ [FCM] Service worker ready: https://localhost:3000/
  ✅ [FCM] ✅ Token obtained: ...
  ✅ [FCM Provider] ✅ FCM token obtained, saving to database...
  ✅ [FCM Provider] ✅ FCM setup complete

When message arrives (app open):
  ✅ [FCM] Foreground message received: {...}
  ✅ [FCM] Showing foreground notification via service worker

When notification clicked:
  ✅ [SW] Notification clicked: ramadhan-notification
  ✅ [SW] Focusing existing window (or Opening new window to /dashboard)


╔════════════════════════════════════════════════════════════════════════════════╗
║  SUMMARY: Service Worker keeps the connection alive to Firebase Cloud Messaging ║
║  even when your app is completely closed. The onBackgroundMessage handler is    ║
║  triggered by Firebase, and it displays the notification using the browser's    ║
║  native notification system. When user clicks, it opens your app.               ║
╚════════════════════════════════════════════════════════════════════════════════╝
