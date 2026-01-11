'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import SendNotificationButton from '@/app/components/SendNotificationButton';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Jika tidak authenticated, paksa ke halaman login
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/');
    }
  }, [status, router]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      // SignOut akan clear session dan cookies
      await signOut({ 
        redirect: false // Jangan auto redirect, kita handle manual
      });
      // Force redirect menggunakan window.location untuk clear semua state
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
      setIsLoggingOut(false);
    }
  };

  if (isLoggingOut) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Logging out...</div>
      </div>
    );
  }
  // Tampilkan loader sampai benar-benar authenticated untuk hindari blank screen
  if (status !== 'authenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Memuat...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--ybm-light)] via-[#cfe3f7] to-[#6bc6e5]/30 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {session.user?.image && (
                  <img
                    src={session.user.image}
                    alt={session.user.name || 'User'}
                    className="w-16 h-16 rounded-full border-2 border-[#2f67b2]"
                  />
                )}
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Selamat Datang, {session.user?.name}!
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400">
                    {session.user?.email}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="bg-[#6b6f74] hover:bg-[#55585c] text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Dashboard
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Anda berhasil login! 🎉
            </p>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <button
                onClick={() => router.push('/calendar')}
                className="p-6 bg-gradient-to-br from-[#2f67b2] to-[#1f4f91] hover:from-[#1f4f91] hover:to-[#2f67b2] text-white rounded-xl shadow-lg hover:shadow-xl transition-all text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Kalender</h3>
                    <p className="text-sm text-[#e8f1fb]">Lihat dan kelola event Anda</p>
                  </div>
                </div>
              </button>

              <div className="p-6 bg-gradient-to-br from-[#6b6f74] to-[#8791a0] text-white rounded-xl shadow-lg opacity-60 cursor-not-allowed">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Statistik</h3>
                    <p className="text-sm text-[#e8f1fb]">Segera hadir</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Notification Test */}
            <SendNotificationButton />
            
            {/* Session Info */}
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                Session Information:
              </h3>
              <pre className="text-sm text-gray-600 dark:text-gray-300 overflow-x-auto">
                {JSON.stringify(session, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
