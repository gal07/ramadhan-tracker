'use client';

import { useState } from 'react';

export default function SendNotificationButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const sendTestNotification = async () => {
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/fcm/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: 'justpastaid@gmail.com', // Change to your email
          title: '🕌 Ramadhan Reminder',
          body: 'Jangan lupa sholat Dzuhur!',
          data: {
            type: 'prayer_reminder',
            prayer: 'dzuhur',
          },
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setMessage(`✅ ${result.message || 'Notification sent!'}`);
      } else {
        setMessage(`❌ ${result.error || 'Failed to send'}`);
      }
    } catch (error: any) {
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
      <h3 className="font-medium text-gray-900 dark:text-white mb-2">
        🔔 Test Notification
      </h3>
      <button
        onClick={sendTestNotification}
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
      >
        {loading ? 'Sending...' : 'Send Test Notification'}
      </button>
      {message && (
        <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{message}</p>
      )}
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        Note: Configure Firebase Admin credentials in .env.local to send notifications
      </p>
    </div>
  );
}
