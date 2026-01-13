'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // First, unregister any old service workers to avoid conflicts
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          // Only keep sw.js, remove any other SWs (like firebase-messaging-sw.js)
          if (registration.active?.scriptURL.includes('firebase-messaging-sw')) {
            console.log('[Main] Unregistering conflicting firebase-messaging-sw.js');
            registration.unregister();
          }
        }
      });

      // Register the main unified service worker
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log('[Main] ✅ Service Worker registered successfully at scope:', registration.scope);
          
          // Listen for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            console.log('[Main] Service Worker update found, installing...');
            
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('[Main] New Service Worker installed. Refresh to activate.');
                  // Optionally notify user about update
                }
              });
            }
          });
        })
        .catch((err) => {
          console.error('[Main] ❌ Service Worker registration failed:', err);
        });
    }
  }, []);

  return null;
}
