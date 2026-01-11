'use client';

import { useState, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // Check session status dan handle redirect
  useEffect(() => {
    if (status === 'authenticated' && session) {
      router.replace('/dashboard');
    }
  }, [session, status, router]);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      // signIn akan auto redirect setelah berhasil
      await signIn('google', { 
        callbackUrl: '/dashboard',
        redirect: true 
      });
    } catch (error) {
      console.error('Error signing in with Google:', error);
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-linear-to-br from-[#2f67b2] via-[#3f7fca] to-[#6bc6e5] dark:from-[#1f4f91] dark:via-[#2f67b2] dark:to-[#3f8ad6]">
        {/* Floating Circles */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#6bc6e5]/25 rounded-full blur-3xl animate-float-delay"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-[#2f67b2]/20 rounded-full blur-3xl animate-pulse-slow"></div>
        
        {/* Moon/Stars for Ramadhan theme */}
        <div className="absolute top-10 right-20 text-white/30 text-6xl">🌙</div>
        <div className="absolute bottom-32 left-16 text-white/35 text-4xl">⭐</div>
        <div className="absolute top-40 right-40 text-white/35 text-3xl">✨</div>
        <div className="absolute bottom-10 right-1/3 text-white/35 text-2xl">⭐</div>
      </div>

      {/* Content */}
      <div className="relative w-full max-w-md z-10">
        <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white/20">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-block mb-4">
              <img
                src="/ybm_logo.png"
                alt="YBM BRILiaN Logo"
                className="w-40 h-auto mx-auto"
              />
            </div>
            <h1 className="text-3xl font-bold bg-linear-to-r from-[#2f67b2] to-[#6bc6e5] dark:from-[#6bc6e5] dark:to-[#2f67b2] bg-clip-text text-transparent mb-2">
              Selamat Datang
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              Ramadhan Tracker - Catat Ibadahmu
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Silakan login menggunakan akun Google Anda
            </p>
          </div>

          {/* Google Sign In Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium py-3 px-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors duration-200 shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                style={{ fill: '#4285F4' }}
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                style={{ fill: '#34A853' }}
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                style={{ fill: '#FBBC05' }}
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                style={{ fill: '#EA4335' }}
              />
            </svg>
            {isLoading ? 'Memproses...' : 'Masuk dengan Google'}
          </button>
        </div>
      </div>
    </div>
  );
}
