'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { requestNotificationPermission, setupForegroundNotifications, saveFCMTokenToDatabase } from '@/lib/fcm';

export function FCMProvider() {
  const { data: session } = useSession();

  useEffect(() => {
    // Only setup FCM if user is authenticated
    const email = session?.user?.email;
    if (!email) return;

    const setupFCM = async () => {
      try {
        // Request notification permission and get token
        const token = await requestNotificationPermission();

        if (token) {
          // Save token to database
          await saveFCMTokenToDatabase(email, token);
          
          // Setup foreground notification listener
          setupForegroundNotifications();
        }
      } catch (error) {
        console.error('FCM setup failed:', error);
      }
    };

    setupFCM();
  }, [session?.user?.email]);

  return null;
}
