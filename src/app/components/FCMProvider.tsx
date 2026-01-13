'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { requestNotificationPermission, setupForegroundNotifications, saveFCMTokenToDatabase } from '@/lib/fcm';

export function FCMProvider() {
  const { data: session } = useSession();

  useEffect(() => {
    // Only setup FCM if user is authenticated
    const email = session?.user?.email;
    if (!email) {
      console.log('[FCM Provider] Waiting for user session...');
      return;
    }

    console.log('[FCM Provider] Setting up FCM for user:', email);

    const setupFCM = async () => {
      try {
        // Request notification permission and get token
        const token = await requestNotificationPermission();

        if (token) {
          console.log('[FCM Provider] ✅ FCM token obtained, saving to database...');
          
          // Save token to database
          await saveFCMTokenToDatabase(email, token);
          
          // Setup foreground notification listener
          setupForegroundNotifications();
          
          console.log('[FCM Provider] ✅ FCM setup complete');
        } else {
          console.warn('[FCM Provider] ⚠️ Failed to obtain FCM token');
        }
      } catch (error) {
        console.error('[FCM Provider] ❌ FCM setup failed:', error);
      }
    };

    setupFCM();
  }, [session?.user?.email]);

  return null;
}
