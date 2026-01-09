'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { db } from '@/lib/firebase';
import { addDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';

export default function CalendarPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [activities, setActivities] = useState<Array<{ id: string; name: string; category: string; categoryLabel: string; icon?: string; order?: number }>>([]);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [activitiesError, setActivitiesError] = useState('');

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

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Memuat...</div>
      </div>
    );
  }

  if (!session) {
    router.push('/');
    return null;
  }

  // Helper functions untuk kalender
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

  const handleDayClick = (day: number) => {
    if (!isDateInRamadhan(day)) {
      // Tampilkan notifikasi custom
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 3000);
      return;
    }
    
    setSelectedDay(day);
    setSelectedActivities([]);
    setShowEventModal(true);
  };

  const handleCloseModal = () => {
    setShowEventModal(false);
    setSelectedDay(null);
    setSelectedActivities([]);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDay) return;

    try {
      const eventDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        selectedDay
      );

      await addDoc(collection(db, 'events'), {
        userEmail: session.user?.email ?? null,
        title: null,
        description: null,
        activities: selectedActivities,
        eventDate,
        createdAt: serverTimestamp(),
      });

      handleCloseModal();
    } catch (error) {
      console.error('Gagal menyimpan event:', error);
      // Optional: tampilkan notifikasi gagal
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--ybm-light)] via-[#cfe3f7] to-[#6bc6e5]/25 dark:from-gray-900 dark:to-gray-800 relative overflow-hidden">
      <div className="absolute -top-20 -left-10 w-64 h-64 bg-[#2f67b2]/20 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-[#6bc6e5]/25 blur-3xl rounded-full pointer-events-none" />

      <div className="container mx-auto px-4 py-8 relative z-10">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-[#2f67b2] hover:text-[#1f4f91] dark:text-[#6bc6e5] dark:hover:text-[#2f67b2] font-medium"
            >
              ← Kembali ke Dashboard
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Kalender
            </h1>
            <div className="w-40"></div>
          </div>

          {/* Calendar Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
            {/* Ramadhan Badge */}
            {hasRamadhanDays && (
              <div className="mb-4 p-3 bg-gradient-to-r from-[#2f67b2] to-[#6bc6e5] text-white rounded-lg text-center">
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
        </div>
      </div>

      {/* Custom Notification Toast */}
      {showNotification && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 animate-slideDown">
          <div className="bg-gradient-to-r from-[#2f67b2] to-[#6bc6e5] text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 min-w-[320px] max-w-md">
            <div className="flex-shrink-0">
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
              className="flex-shrink-0 hover:bg-white/20 rounded-lg p-1 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
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
                  Checklist Aktivitas (ambil dari Firestore)
                </p>
                <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2 bg-gray-50 dark:bg-gray-800/60">
                  {loadingActivities && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Memuat aktivitas...</p>
                  )}
                  {activitiesError && (
                    <p className="text-sm text-red-600 dark:text-red-400">{activitiesError}</p>
                  )}
                  {!loadingActivities && !activitiesError && activities.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Belum ada data aktivitas di Firestore.</p>
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
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-[#2f67b2] to-[#6bc6e5] text-white rounded-lg hover:from-[#1f4f91] hover:to-[#2f67b2] transition-colors font-medium shadow-lg"
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

