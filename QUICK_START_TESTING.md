╔════════════════════════════════════════════════════════════════════════════════╗
║                         QUICK START - TESTING GUIDE                             ║
╚════════════════════════════════════════════════════════════════════════════════╝

═══════════════════════════════════════════════════════════════════════════════════
STEP 1: PREPARE YOUR ENVIRONMENT
═══════════════════════════════════════════════════════════════════════════════════

1. Make sure .env.local has VAPID key:
   ✅ NEXT_PUBLIC_FCM_VAPID_KEY=BMueodYnZ94X2W9YoJpx...

2. Start dev server:
   npm run dev

3. Open app in browser:
   http://localhost:3000

4. Open DevTools:
   F12 or right-click → Inspect


═══════════════════════════════════════════════════════════════════════════════════
STEP 2: VERIFY SERVICE WORKER IS REGISTERED
═══════════════════════════════════════════════════════════════════════════════════

In DevTools:

1. Go to Application tab
2. Left sidebar → Service Workers
3. Should see:
   ✅ https://localhost:3000/sw.js
   ✅ Status: "activated and running"
   ✅ Scope: https://localhost:3000/

If you see firebase-messaging-sw.js → unregister it!


═══════════════════════════════════════════════════════════════════════════════════
STEP 3: CHECK SERVICE WORKER CONSOLE LOGS
═══════════════════════════════════════════════════════════════════════════════════

In DevTools Application tab:

1. Click on the service worker entry
2. A new DevTools window opens JUST for the service worker
3. Go to Console tab
4. Should see logs starting with [SW]:
   ✅ [SW] Firebase initialized successfully
   ✅ [SW] Firebase Messaging initialized and listening...
   ✅ [SW] Service Worker loaded and ready for FCM and PWA


═══════════════════════════════════════════════════════════════════════════════════
STEP 4: CHECK APP CONSOLE LOGS
═══════════════════════════════════════════════════════════════════════════════════

In DevTools Console tab (main app):

Should see:
✅ [Main] ✅ Service Worker registered successfully
✅ [FCM Provider] Setting up FCM for user: user@email.com
✅ [FCM] Waiting for service worker...
✅ [FCM] Service worker ready:
✅ [FCM] ✅ Token obtained: ...
✅ [FCM Provider] ✅ FCM token obtained, saving to database...
✅ [FCM Provider] ✅ FCM setup complete

If you don't see these → check:
- Are you logged in? (Must be authenticated)
- Did you grant notification permission?
- Is there an error in console?


═══════════════════════════════════════════════════════════════════════════════════
STEP 5: TEST NOTIFICATION (APP OPEN)
═══════════════════════════════════════════════════════════════════════════════════

1. Go to Firebase Console:
   https://console.firebase.google.com/
   → Select "ramadhan-tracker" project

2. Left sidebar → Cloud Messaging

3. Click "Send your first message"

4. Fill in:
   Title: "Test Notification"
   Body: "App is OPEN"

5. Click "Send test message"

6. Select your user/device

7. Look for:
   ✅ Notification appears in browser
   ✅ [FCM] Foreground message received: in console


═══════════════════════════════════════════════════════════════════════════════════
STEP 6: TEST NOTIFICATION (APP CLOSED) ⭐ MOST IMPORTANT TEST
═══════════════════════════════════════════════════════════════════════════════════

1. Close all browser tabs with your app
   (Completely close it, not just minimize)

2. Go to Firebase Console again

3. Send another test message:
   Title: "Test Notification"
   Body: "App is CLOSED!"

4. Look at your desktop/screen:
   ✅ Notification should appear EVEN THOUGH APP IS CLOSED
   ✅ This means Service Worker is working!

5. Click the notification:
   ✅ App should open automatically
   ✅ You should see the notification context

If notification appears → 🎉 SUCCESS! FCM is working!
If notification DOESN'T appear → see troubleshooting below


═══════════════════════════════════════════════════════════════════════════════════
STEP 7: VERIFY IN NETWORK TAB (OPTIONAL - FOR DEBUGGING)
═══════════════════════════════════════════════════════════════════════════════════

In DevTools:

1. Go to Network tab
2. Click on "Fetch/XHR" filter
3. Send test message from Firebase
4. Should see:
   ✅ POST request to /api/fcm/save-token (if new device)
   ✅ Successful responses

This shows token communication is working.


╔════════════════════════════════════════════════════════════════════════════════╗
║                            TROUBLESHOOTING                                     ║
╚════════════════════════════════════════════════════════════════════════════════╝

PROBLEM 1: Service Worker NOT showing as "activated and running"
─────────────────────────────────────────────────────────────────
Solution:
1. Check if there are errors in service worker console
2. Try: Hard refresh (Ctrl+Shift+R)
3. Check: Application → Storage → Clear site data
4. Restart: npm run dev
5. Re-register the app

PROBLEM 2: "Notification permission denied"
─────────────────────────────────────────────
Solution:
1. Chrome address bar: Click 🔒 lock icon
2. Find "Notifications" setting
3. Change to "Allow"
4. Refresh page (F5)
5. Log in again

PROBLEM 3: "FCM VAPID key not configured"
──────────────────────────────────────────
Solution:
1. Open .env.local
2. Check NEXT_PUBLIC_FCM_VAPID_KEY exists
3. If missing:
   a. Firebase Console → Project Settings
   b. Cloud Messaging tab
   c. Copy Web Push Certificates → Public key
   d. Add to .env.local
   e. Restart: npm run dev

PROBLEM 4: Token obtained but notification doesn't show when app closed
─────────────────────────────────────────────────────────────────────
Solution:
1. Check Service Worker console (might have errors)
2. Verify onBackgroundMessage handler exists (sw.js line 56)
3. Make sure you're sending message to correct user/token
4. Try clearing caches: Application → Storage → Clear site data

PROBLEM 5: Two service workers registered (firebase-messaging-sw.js + sw.js)
──────────────────────────────────────────────────────────────────────────
Solution:
1. This should be auto-fixed by new ServiceWorkerRegistration.tsx
2. If still showing both:
   a. DevTools → Application → Service Workers
   b. Manually unregister firebase-messaging-sw.js
   c. Hard refresh (Ctrl+Shift+R)

PROBLEM 6: Service Worker doesn't update with new code
───────────────────────────────────────────────────────
Solution:
1. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
2. DevTools → Application → Service Workers → Unregister all
3. Clear storage: Application → Storage → Clear site data
4. Close browser completely
5. Reopen and test


╔════════════════════════════════════════════════════════════════════════════════╗
║                          COMMAND REFERENCE                                     ║
╚════════════════════════════════════════════════════════════════════════════════╝

Start development server:
npm run dev

Build for production:
npm run build

Start production server:
npm start

Check for errors:
npm run lint

View console logs from service worker:
→ DevTools → Application → Service Workers → Click on sw.js

Send test notification:
→ Firebase Console → Cloud Messaging → Send test message


╔════════════════════════════════════════════════════════════════════════════════╗
║                         CHECKLIST FOR SUCCESS                                  ║
╚════════════════════════════════════════════════════════════════════════════════╝

After implementing these changes, you should have:

✅ Only /sw.js registered (no firebase-messaging-sw.js)
✅ Service worker status: "activated and running"
✅ onBackgroundMessage handler in service worker
✅ FCM token obtained and logged
✅ Token saved to database
✅ Notifications show when app is OPEN
✅ Notifications show when app is CLOSED
✅ Clicking notification opens app
✅ No browser console errors
✅ No service worker console errors


If all are checked → Your FCM + PWA setup is COMPLETE and WORKING! 🎉

═══════════════════════════════════════════════════════════════════════════════════
