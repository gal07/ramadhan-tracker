'use client';

import { useState, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { data: session } = useSession();
  const router = useRouter();

  // Redirect jika sudah login
  useEffect(() => {
    if (session) {
      router.push('/dashboard');
    }
  }, [session, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Email atau password salah!');
      } else if (result?.ok) {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Error signing in:', error);
      setError('Terjadi kesalahan saat login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signIn('google', { callbackUrl: '/dashboard' });
    } catch (error) {
      console.error('Error signing in with Google:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#2f67b2] via-[#3f7fca] to-[#6bc6e5] dark:from-[#1f4f91] dark:via-[#2f67b2] dark:to-[#3f8ad6]">
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
            <h1 className="text-3xl font-bold bg-gradient-to-r from-[#2f67b2] to-[#6bc6e5] dark:from-[#6bc6e5] dark:to-[#2f67b2] bg-clip-text text-transparent mb-2">
              Selamat Datang
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Ramadhan Tracker - Catat Ibadahmu
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400 text-center">
                {error}
              </p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Input */}
            <div>
              <label 
                htmlFor="email" 
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#2f67b2] focus:border-transparent dark:bg-gray-700 dark:text-white transition-all"
                placeholder="nama@email.com"
              />
            </div>

            {/* Password Input */}
            <div>
              <label 
                htmlFor="password" 
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#2f67b2] focus:border-transparent dark:bg-gray-700 dark:text-white transition-all"
                placeholder="••••••••"
              />
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember"
                  type="checkbox"
                  className="h-4 w-4 text-[#2f67b2] focus:ring-[#2f67b2] border-gray-300 rounded"
                />
                <label 
                  htmlFor="remember" 
                  className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
                >
                  Ingat saya
                </label>
              </div>
              <a 
                href="#" 
                className="text-sm text-[#2f67b2] hover:text-[#1f4f91] dark:text-[#6bc6e5] dark:hover:text-[#2f67b2]"
              >
                Lupa password?
              </a>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#2f67b2] hover:bg-[#1f4f91] disabled:bg-[#2f67b2]/50 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
            >
              {isLoading ? 'Memproses...' : 'Masuk'}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">
                Atau lanjutkan dengan
              </span>
            </div>
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

          {/* Sign Up Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Belum punya akun?{' '}
              <a 
                href="#" 
                className="text-[#2f67b2] hover:text-[#1f4f91] dark:text-[#6bc6e5] dark:hover:text-[#2f67b2] font-medium"
              >
                Daftar sekarang
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
