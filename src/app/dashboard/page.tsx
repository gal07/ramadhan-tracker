'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { db } from '@/lib/firebase';
import { addDoc, collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import SendNotificationButton from '@/app/components/SendNotificationButton';
import StatisticsSection from './StatisticsSection';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  // Calendar states
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activities, setActivities] = useState<Array<{ id: string; name: string; category: string; categoryLabel: string; icon?: string; order?: number }>>([]);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [activitiesError, setActivitiesError] = useState('');
  const [showView, setShowView] = useState<'calendar' | 'statistics'>('calendar');
  
  // Notification permission states
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [showNotificationBanner, setShowNotificationBanner] = useState(false);
  const [notificationRequestStatus, setNotificationRequestStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
  
  // PWA installation states
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  // Jika tidak authenticated, paksa ke halaman login
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/');
    }
  }, [status, router]);

  // Check notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
      
      // Check if banner was dismissed before
      const dismissed = localStorage.getItem('notification-banner-dismissed');
      
      // Show banner if permission is default and not dismissed
      if (Notification.permission === 'default' && dismissed !== 'true') {
        setTimeout(() => {
          setShowNotificationBanner(true);
        }, 2000);
      }
    }
  }, []);

  // Listen untuk foreground FCM messages (saat app terbuka)
  useEffect(() => {
    if (status !== 'authenticated') return;
    if (typeof window === 'undefined') return;
    if (notificationPermission !== 'granted') return;

    const messaging = getMessaging();

    // Handle messages saat app terbuka (foreground)
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('📬 Foreground message received:', payload);

      const title = payload.notification?.title || 'Ramadhan Tracker';
      const body = payload.notification?.body || 'Ada notifikasi baru';
      const icon = payload.notification?.icon || '/icon-192x192.png';

      // Tampilkan notifikasi via service worker
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification(title, {
            body,
            icon,
            badge: '/icon-192x192.png',
            tag: 'ramadhan-notification',
            requireInteraction: false,
            data: payload.data,
            vibrate: [200, 100, 200],
          } as NotificationOptions & { vibrate: number[] });
        });
      }
    });

    return () => unsubscribe();
  }, [status, notificationPermission]);

  // PWA installation detection
  useEffect(() => {
    // Cek apakah sudah running di standalone mode (sudah diinstall)
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                          (window.navigator as any).standalone === true || // iOS Safari
                          document.referrer.includes('android-app://'); // Android TWA
      setIsAppInstalled(isStandalone);
      return isStandalone;
    };

    const installed = checkInstalled();

    // Jika belum diinstall, setup event listeners
    if (!installed) {
      // Listen untuk beforeinstallprompt (PWA belum diinstall dan bisa diinstall)
      const handleBeforeInstall = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setIsAppInstalled(false);
        
        // Check if install banner was dismissed before
        const installDismissed = localStorage.getItem('install-banner-dismissed');
        if (installDismissed !== 'true') {
          setTimeout(() => {
            setShowInstallBanner(true);
          }, 3000); // Show after 3 seconds
        }
      };

      // Listen untuk appinstalled (PWA baru saja diinstall)
      const handleAppInstalled = () => {
        setIsAppInstalled(true);
        setDeferredPrompt(null);
        setShowInstallBanner(false);
        localStorage.removeItem('install-banner-dismissed');
        console.log('PWA was installed successfully');
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstall);
      window.addEventListener('appinstalled', handleAppInstalled);

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
        window.removeEventListener('appinstalled', handleAppInstalled);
      };
    }
  }, []);

  // Calendar constants
  const CATEGORY_ORDER: Array<{ key: string; label: string }> = [
    { key: 'bangun_tidur', label: 'Bangun Tidur' },
    { key: 'waktu_subuh', label: 'Waktu Subuh' },
    { key: 'pagi_hari', label: 'Pagi Hari' },
    { key: 'waktu_dzuhur', label: 'Waktu Dzuhur' },
    { key: 'waktu_ashar', label: 'Waktu Ashar' },
    { key: 'waktu_maghrib', label: 'Waktu Maghrib' },
    { key: 'waktu_isya', label: 'Waktu Isya' },
    { key: 'waktu_tidur', label: 'Waktu Tidur' },
  ];

  // Request notification permission
  const handleRequestNotification = async () => {
    if (typeof window === 'undefined') return;

    // Reset status message on every click
    setNotificationRequestStatus({ type: 'info', message: 'Meminta izin notifikasi...' });

    if (!('Notification' in window)) {
      setNotificationRequestStatus({ type: 'error', message: 'Browser Anda tidak mendukung notifikasi.' });
      alert('Browser Anda tidak mendukung notifikasi.');
      return;
    }
    if (!window.isSecureContext) {
      setNotificationRequestStatus({ type: 'error', message: 'Aktifkan HTTPS atau gunakan localhost agar izin bisa diminta.' });
      alert('Aktifkan HTTPS atau gunakan localhost untuk mengizinkan notifikasi.');
      return;
    }

    // Helper: show a sample notification via service worker when possible
    const showNotificationPreview = async () => {
      try {
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          await registration.showNotification('Notifikasi Aktif! 🎉', {
            body: 'Anda akan menerima pengingat ibadah dari Ramadhan Tracker',
            icon: '/icon-192x192.png',
            badge: '/icon-192x192.png',
          });
          return;
        }

        new Notification('Notifikasi Aktif! 🎉', {
          body: 'Anda akan menerima pengingat ibadah dari Ramadhan Tracker',
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
        });
      } catch (error) {
        console.error('Error showing notification preview:', error);
      }
    };

    try {
      // If already granted, do not prompt again — just show feedback
      if (Notification.permission === 'granted') {
        setNotificationPermission('granted');
        setShowNotificationBanner(false);
        await showNotificationPreview();
        setNotificationRequestStatus({ type: 'success', message: 'Notifikasi sudah aktif.' });
        return;
      }

      const permission = await Notification.requestPermission();
      const resolvedPermission = permission ?? Notification.permission ?? 'default';
      setNotificationPermission(resolvedPermission);

      if (resolvedPermission === 'granted') {
        setShowNotificationBanner(false);
        await showNotificationPreview();
        setNotificationRequestStatus({ type: 'success', message: 'Notifikasi berhasil diaktifkan.' });
        
        // Simpan FCM Token setelah permission granted
        await saveFCMToken();
        return;
      }

      if (resolvedPermission === 'denied') {
        setShowNotificationBanner(false);
        setNotificationRequestStatus({ type: 'error', message: 'Notifikasi diblokir. Aktifkan lewat pengaturan browser lalu coba lagi.' });
        return;
      }

      setNotificationRequestStatus({ type: 'info', message: 'Izin belum diputuskan. Coba klik ulang atau buka pengaturan notifikasi browser.' });
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      setNotificationRequestStatus({ type: 'error', message: 'Gagal meminta izin notifikasi. Coba lagi.' });
      alert('Gagal meminta izin notifikasi. Coba lagi.');
    }
  };

  // Fungsi untuk menyimpan FCM token ke Firestore
  const saveFCMToken = async () => {
    try {
      if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
        console.log('Service worker not supported');
        return;
      }
      if (!session?.user?.email) {
        console.log('User not authenticated');
        return;
      }

      // Tunggu service worker ready
      const registration = await navigator.serviceWorker.ready;
      
      const messaging = getMessaging();
      
      // Dapatkan FCM token dengan VAPID key
      // ⚠️ PENTING: Ganti dengan VAPID key dari Firebase Console
      // Firebase Console → Project Settings → Cloud Messaging → Web Push certificates
      const token = await getToken(messaging, {
        vapidKey: 'BKqB9YourVapidKeyHere', // ⚠️ GANTI INI dengan VAPID key Anda!
        serviceWorkerRegistration: registration,
      });

      if (token) {
        console.log('✅ FCM Token obtained:', token);
        
        // Simpan token ke Firestore
        const userEmail = session.user.email;
        await setDoc(
          doc(db, 'users', userEmail),
          {
            fcmToken: token,
            fcmTokenUpdatedAt: serverTimestamp(),
            deviceInfo: {
              userAgent: navigator.userAgent,
              platform: navigator.platform,
              language: navigator.language,
            },
          },
          { merge: true }
        );
        
        console.log('✅ FCM token saved to Firestore for:', userEmail);
      } else {
        console.warn('⚠️ No FCM token available. Check VAPID key and service worker.');
      }
    } catch (error) {
      console.error('❌ Error saving FCM token:', error);
    }
  };

  const handleDismissNotificationBanner = () => {
    setShowNotificationBanner(false);
    localStorage.setItem('notification-banner-dismissed', 'true');
  };

  // Handle PWA install prompt
  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      console.log('Install prompt not available');
      return;
    }

    try {
      // Show the install prompt
      deferredPrompt.prompt();
      
      // Wait for the user's response
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
        setShowInstallBanner(false);
      } else {
        console.log('User dismissed the install prompt');
      }
      
      // Clear the deferredPrompt
      setDeferredPrompt(null);
    } catch (error) {
      console.error('Error showing install prompt:', error);
    }
  };

  const handleDismissInstallBanner = () => {
    setShowInstallBanner(false);
    localStorage.setItem('install-banner-dismissed', 'true');
  };

  // Load activities from Firestore
  useEffect(() => {
    if (status !== 'authenticated') return;

    const loadActivities = async () => {
      setLoadingActivities(true);
      setActivitiesError('');
      try {
        const snapshot = await getDocs(collection(db, 'activities'));
        const items = snapshot.docs.map((doc) => {
          const data = doc.data();
          const categoryKey = (data.category as string) ?? '';
          const categoryMeta = CATEGORY_ORDER.find((c) => c.key === categoryKey);
          return {
            id: doc.id,
            name: data.name as string,
            category: categoryKey,
            categoryLabel: categoryMeta?.label ?? categoryKey,
            icon: data.icon as string | undefined,
            order: (data.order as number) ?? 0,
          };
        });

        items.sort((a, b) => {
          const aIndex = CATEGORY_ORDER.findIndex((c) => c.key === a.category);
          const bIndex = CATEGORY_ORDER.findIndex((c) => c.key === b.category);
          if (aIndex !== bIndex) return aIndex - bIndex;
          return (a.order ?? 0) - (b.order ?? 0);
        });

        setActivities(items);
      } catch (error) {
        console.error('Gagal memuat activities:', error);
        setActivitiesError('Gagal memuat data aktivitas');
      } finally {
        setLoadingActivities(false);
      }
    };

    loadActivities();
  }, [status]);

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

  // Calendar helper functions
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month, 1).getDay();
  };

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const today = new Date();
  const isCurrentMonth = 
    currentDate.getMonth() === today.getMonth() && 
    currentDate.getFullYear() === today.getFullYear();

  // Generate array of days
  const days = [];
  
  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  
  // Days of the month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getDateKey = (year: number, monthZeroBased: number, day: number) => {
    return `${year}-${String(monthZeroBased + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  // Periode Ramadhan: 18 Februari - 19 Maret 2026
  const RAMADHAN_YEAR = 2026;
  const RAMADHAN_START = new Date(2026, 1, 18); // 18 Februari (bulan 1 = Februari)
  const RAMADHAN_END = new Date(2026, 2, 19);   // 19 Maret (bulan 2 = Maret)

  // Cek apakah tanggal tertentu termasuk dalam periode Ramadhan
  const isDateInRamadhan = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return date >= RAMADHAN_START && date <= RAMADHAN_END;
  };

  // Cek apakah bulan saat ini memiliki hari-hari Ramadhan
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const hasRamadhanDays = 
    currentYear === RAMADHAN_YEAR && 
    (currentMonth === 1 || currentMonth === 2); // Februari atau Maret

  const handleToggleActivity = (activityId: string) => {
    setSelectedActivities((prev) =>
      prev.includes(activityId)
        ? prev.filter((id) => id !== activityId)
        : [...prev, activityId]
    );
  };

  const handleDayClick = async (day: number) => {
    if (!isDateInRamadhan(day)) {
      // Tampilkan notifikasi custom
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 3000);
      return;
    }
    
    setSelectedDay(day);
    setSelectedActivities([]);
    setShowEventModal(true);

    const userEmail = session?.user?.email ?? '';
    if (userEmail) {
      const dateKey = getDateKey(currentDate.getFullYear(), currentDate.getMonth(), day);
      const docId = `${userEmail}_${dateKey}`;
      const snap = await getDoc(doc(db, 'users', userEmail, 'daily_logs', docId));
      const data = snap.data() as { activities?: Record<string, { status?: string }> } | undefined;
      if (data?.activities) {
        const completedIds = Object.entries(data.activities)
          .filter(([, value]) => value?.status === 'completed')
          .map(([id]) => id);
        setSelectedActivities(completedIds);
      }
    }
  };

  const handleCloseModal = () => {
    setShowEventModal(false);
    setSelectedDay(null);
    setSelectedActivities([]);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDay) return;

    if (selectedActivities.length === 0) {
      setSaveError('Pilih minimal satu aktivitas sebelum menyimpan.');
      setTimeout(() => setSaveError(null), 3200);
      return;
    }

    try {
      const eventDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        selectedDay
      );

      const dateKey = getDateKey(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());

      await addDoc(collection(db, 'events'), {
        userEmail: session?.user?.email ?? null,
        title: null,
        description: null,
        activities: selectedActivities,
        eventDate,
        createdAt: serverTimestamp(),
      });

      // Simpan status harian ke subcollection daily_logs
      const userEmail = session?.user?.email ?? '';
      if (userEmail) {
        const docId = `${userEmail}_${dateKey}`;
        const now = new Date().toISOString();

        const activityMap = activities.reduce<Record<string, { name: string; category: string; status: 'completed' | 'pending'; time?: string }>>((acc, act) => {
          const isDone = selectedActivities.includes(act.id);
          acc[act.id] = {
            name: act.name,
            category: act.categoryLabel ?? act.category,
            status: isDone ? 'completed' : 'pending',
            ...(isDone ? { time: now } : {}),
          };
          return acc;
        }, {});

        const userId = (session?.user as { id?: string } | undefined)?.id ?? null;

        await setDoc(
          doc(db, 'users', userEmail, 'daily_logs', docId),
          {
            userId,
            date: dateKey,
            activities: activityMap,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      handleCloseModal();
    } catch (error) {
      console.error('Gagal menyimpan event:', error);
      setSaveError('Gagal menyimpan data. Silakan coba lagi.');
      setTimeout(() => setSaveError(null), 3200);
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
    <div className="min-h-screen bg-linear-to-br from-(--ybm-light) via-[#cfe3f7] to-[#6bc6e5]/30 dark:from-gray-900 dark:to-gray-800">
      <div className="absolute -top-20 -left-10 w-64 h-64 bg-[#2f67b2]/20 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-[#6bc6e5]/25 blur-3xl rounded-full pointer-events-none" />

      <div className="container mx-auto px-4 py-8 relative z-10">
        <div className="max-w-6xl mx-auto">
          {notificationRequestStatus && (
            <div
              className={`mb-4 rounded-xl border p-3 text-sm flex items-center gap-2 ${
                notificationRequestStatus.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200'
                  : notificationRequestStatus.type === 'error'
                  ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200'
                  : 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200'
              }`}
            >
              <span className="text-base">🔔</span>
              <span>{notificationRequestStatus.message}</span>
            </div>
          )}

          {/* Install PWA Banner */}
          {!isAppInstalled && showInstallBanner && deferredPrompt && (
            <div className="mb-6">
              <div className="bg-linear-to-r from-[#6bc6e5] to-[#2f67b2] rounded-2xl shadow-xl p-4 flex items-center gap-4">
                <div className="shrink-0">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-semibold text-sm mb-1">
                    📲 Install Aplikasi
                  </h3>
                  <p className="text-white/90 text-xs">
                    Install aplikasi ke homescreen untuk akses lebih cepat dan pengalaman lebih baik
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleInstallClick}
                    className="px-4 py-2 bg-white text-[#2f67b2] rounded-lg font-medium text-sm hover:bg-white/90 transition-colors shadow-lg"
                  >
                    Install
                  </button>
                  <button
                    onClick={handleDismissInstallBanner}
                    className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Notification Permission Banner */}
          {showNotificationBanner && notificationPermission === 'default' && (
            <div className="mb-6">
              <div className="bg-linear-to-r from-[#2f67b2] to-[#6bc6e5] rounded-2xl shadow-xl p-4 flex items-center gap-4">
                <div className="shrink-0">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-semibold text-sm mb-1">
                    🔔 Aktifkan Notifikasi
                  </h3>
                  <p className="text-white/90 text-xs">
                    Dapatkan pengingat untuk sholat, puasa, dan aktivitas ibadah Anda
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRequestNotification}
                    className="px-4 py-2 bg-white text-[#2f67b2] rounded-lg font-medium text-sm hover:bg-white/90 transition-colors shadow-lg"
                  >
                    Aktifkan
                  </button>
                  <button
                    onClick={handleDismissNotificationBanner}
                    className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Notification Denied Warning */}
          {notificationPermission === 'denied' && (
            <div className="mb-6">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center gap-3">
                <div className="shrink-0">
                  <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                    Notifikasi diblokir
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-300 mt-0.5">
                    Aktifkan notifikasi di pengaturan browser untuk mendapat pengingat ibadah
                  </p>
                </div>
                <button
                  onClick={handleRequestNotification}
                  className="px-3 py-2 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors"
                >
                  Coba aktifkan lagi
                </button>
              </div>
            </div>
          )}

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
              <div className="flex items-center gap-3">
                {notificationPermission !== 'granted' && (
                  <button
                    onClick={handleRequestNotification}
                    className="bg-linear-to-r from-[#2f67b2] to-[#6bc6e5] text-white font-semibold py-2 px-4 rounded-lg shadow hover:shadow-md transition-all text-sm"
                  >
                    Aktifkan Notifikasi
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="bg-[#6b6f74] hover:bg-[#55585c] text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 space-y-6">
            {/* Dashboard & Quick Actions */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Dashboard
              </h2>
              {/* <p className="text-gray-600 dark:text-gray-400 mb-6">
                Anda berhasil login! 🎉
              </p> */}

              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                <button
                  onClick={() => setShowView('calendar')}
                  className={`p-4 rounded-xl shadow-lg hover:shadow-xl transition-all text-left ${
                    showView === 'calendar'
                      ? 'bg-linear-to-br from-[#2f67b2] to-[#1f4f91] text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      showView === 'calendar' ? 'bg-white/20' : 'bg-gray-300 dark:bg-gray-600'
                    }`}>
                      <svg
                        className="w-5 h-5"
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
                      <h3 className="font-semibold text-sm">Kalender Ramadhan</h3>
                      <p className={`text-xs ${
                        showView === 'calendar' ? 'text-[#e8f1fb]' : 'text-gray-500 dark:text-gray-400'
                      }`}>Kelola ibadah Anda</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setShowView('statistics')}
                  className={`p-4 rounded-xl shadow-lg hover:shadow-xl transition-all text-left ${
                    showView === 'statistics'
                      ? 'bg-linear-to-br from-[#2f67b2] to-[#1f4f91] text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      showView === 'statistics' ? 'bg-white/20' : 'bg-gray-300 dark:bg-gray-600'
                    }`}>
                      <svg
                        className="w-5 h-5"
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
                      <h3 className="font-semibold text-sm">Statistik</h3>
                      <p className={`text-xs ${
                        showView === 'statistics' ? 'text-[#e8f1fb]' : 'text-gray-500 dark:text-gray-400'
                      }`}>Lihat progress Anda</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Calendar or Statistics View */}
            {showView === 'calendar' ? (
            <div>
              {/* Ramadhan Badge */}
              {hasRamadhanDays && (
                <div className="mb-4 p-3 bg-linear-to-r from-[#2f67b2] to-[#6bc6e5] text-white rounded-lg text-center">
                  <p className="font-semibold">🌙 Bulan Ramadhan 1447 H</p>
                  <p className="text-sm mt-1">
                    {currentMonth === 1 
                      ? "18 Februari - 28 Februari 2026" 
                      : "1 Maret - 19 Maret 2026"}
                    {" • Klik tanggal untuk membuat event ibadah"}
                  </p>
                </div>
              )}

              {/* Calendar Header */}
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={previousMonth}
                  className="p-2 text-[#2f67b2] dark:text-[#6bc6e5] hover:bg-[#e8f1fb] dark:hover:bg-[#1f4f91]/30 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                  </h2>
                  {!isCurrentMonth && (
                    <button
                      onClick={goToToday}
                      className="text-sm text-[#2f67b2] hover:text-[#1f4f91] dark:text-[#6bc6e5] dark:hover:text-[#2f67b2] font-medium"
                    >
                      Hari Ini
                    </button>
                  )}
                </div>
                
                <button
                  onClick={nextMonth}
                  className="p-2 text-[#2f67b2] dark:text-[#6bc6e5] hover:bg-[#e8f1fb] dark:hover:bg-[#1f4f91]/30 rounded-lg transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Day Names */}
              <div className="grid grid-cols-7 gap-2 mb-2">
                {dayNames.map((day) => (
                  <div
                    key={day}
                    className="text-center text-sm font-semibold text-gray-600 dark:text-gray-400 py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-2">
                {days.map((day, index) => {
                  const isToday = 
                    isCurrentMonth && 
                    day === today.getDate();
                  
                  const isRamadhanDay = day ? isDateInRamadhan(day) : false;
                  
                  return (
                    <div
                      key={index}
                      onClick={() => day && handleDayClick(day)}
                      className={`
                        aspect-square flex items-center justify-center rounded-lg
                        ${day ? 'cursor-pointer' : ''}
                        ${day && isRamadhanDay ? 'hover:bg-[#e8f1fb] dark:hover:bg-[#1f4f91]/30 hover:ring-2 hover:ring-[#2f67b2]' : ''}
                        ${day && !isRamadhanDay ? 'hover:bg-gray-100 dark:hover:bg-gray-700' : ''}
                        ${isToday ? 'bg-[#2f67b2] text-white font-bold hover:bg-[#1f4f91]' : ''}
                        ${day && !isToday && isRamadhanDay ? 'text-[#1f4f91] dark:text-[#6bc6e5] font-semibold bg-[#e8f1fb] dark:bg-[#1f4f91]/20' : ''}
                        ${day && !isToday && !isRamadhanDay ? 'text-gray-900 dark:text-gray-100' : ''}
                        transition-all
                      `}
                    >
                      {day && (
                        <span className="text-sm md:text-base">
                          {day}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-[#2f67b2] rounded"></div>
                    <span className="text-gray-600 dark:text-gray-400">Hari Ini</span>
                  </div>
                  {hasRamadhanDays && (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-[#e8f1fb] dark:bg-[#1f4f91]/20 rounded border-2 border-[#2f67b2]"></div>
                      <span className="text-gray-600 dark:text-gray-400">Hari Ramadhan (18 Feb - 19 Mar)</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600"></div>
                    <span className="text-gray-600 dark:text-gray-400">Hari Biasa</span>
                  </div>
                </div>
              </div>
            </div>
            ) : (
              <StatisticsSection />
            )}

            {/* Notification Test */}
            <div>
              {/* <SendNotificationButton /> */}
            </div>
          </div>

          {/* Session Info */}
          {/* <div className="mt-6 p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-xl">
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">
              Session Information:
            </h3>
            <pre className="text-sm text-gray-600 dark:text-gray-300 overflow-x-auto max-h-48">
              {JSON.stringify(session, null, 2)}
            </pre>
          </div> */}
        </div>
      </div>

      {/* Custom Notification Toast */}
      {showNotification && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 animate-slideDown">
          <div className="bg-linear-to-r from-[#2f67b2] to-[#6bc6e5] text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 min-w-[320px] max-w-md">
            <div className="shrink-0">
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
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Tidak Tersedia</p>
              <p className="text-xs mt-0.5 text-white/90">
                Event hanya dapat dibuat pada periode Ramadhan (18 Feb - 19 Mar 2026)
              </p>
            </div>
            <button
              onClick={() => setShowNotification(false)}
              className="shrink-0 hover:bg-white/20 rounded-lg p-1 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          {saveError && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50">
              <div className="bg-red-600 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 min-w-[320px] max-w-md animate-slideDown">
                <div className="shrink-0">
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
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">Gagal menyimpan</p>
                  <p className="text-xs mt-0.5 text-white/90">{saveError}</p>
                </div>
                <button
                  onClick={() => setSaveError(null)}
                  className="shrink-0 hover:bg-white/20 rounded-lg p-1 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Buat Event - {selectedDay} {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h3>
              <button
                onClick={handleCloseModal}
                className="p-2 text-[#2f67b2] dark:text-[#6bc6e5] hover:bg-[#e8f1fb] dark:hover:bg-[#1f4f91]/30 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveEvent} className="space-y-4">
              <div>
                <p className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Checklist Aktivitas
                </p>
                <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2 bg-gray-50 dark:bg-gray-800/60">
                  {loadingActivities && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Memuat aktivitas...</p>
                  )}
                  {activitiesError && (
                    <p className="text-sm text-red-600 dark:text-red-400">{activitiesError}</p>
                  )}
                  {!loadingActivities && !activitiesError && activities.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Belum ada data aktivitas.</p>
                  )}
                  {!loadingActivities && !activitiesError && activities.length > 0 && (
                    <div className="space-y-3">
                      {CATEGORY_ORDER.map((cat) => {
                        const group = activities.filter((a) => a.category === cat.key);
                        if (group.length === 0) return null;
                        return (
                          <div key={cat.key} className="space-y-2">
                            <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 tracking-wide">
                              {cat.label}
                            </p>
                            <div className="space-y-2">
                              {group.map((act) => (
                                <label
                                  key={act.id}
                                  className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-200"
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedActivities.includes(act.id)}
                                    onChange={() => handleToggleActivity(act.id)}
                                    className="h-4 w-4 text-[#2f67b2] border-gray-300 rounded focus:ring-[#2f67b2]"
                                  />
                                  <span className="flex items-center gap-2">
                                    <span>{act.icon ?? '•'}</span>
                                    <span className="font-medium">{act.name}</span>
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-3 border border-[#2f67b2] text-[#2f67b2] rounded-lg hover:bg-[#e8f1fb] dark:border-[#6bc6e5] dark:text-[#6bc6e5] dark:hover:bg-[#1f4f91]/30 transition-colors font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-linear-to-r from-[#2f67b2] to-[#6bc6e5] text-white rounded-lg hover:from-[#1f4f91] hover:to-[#2f67b2] transition-colors font-medium shadow-lg"
                >
                  Simpan Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
