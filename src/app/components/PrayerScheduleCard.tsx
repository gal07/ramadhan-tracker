'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import React from 'react';

interface PrayerTime {
  name: string;
  time: string;
  isNext: boolean;
  countdown: string;
}

interface PrayerScheduleData {
  fajr: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
}

const INDONESIAN_CITIES = [
  { name: 'Jakarta', key: 'Jakarta' },
  { name: 'Bandung', key: 'Bandung' },
  { name: 'Surabaya', key: 'Surabaya' },
  { name: 'Medan', key: 'Medan' },
  { name: 'Makassar', key: 'Makassar' },
  { name: 'Palembang', key: 'Palembang' },
  { name: 'Semarang', key: 'Semarang' },
  { name: 'Yogyakarta', key: 'Yogyakarta' },
  { name: 'Malang', key: 'Malang' },
  { name: 'Bogor', key: 'Bogor' },
  { name: 'Depok', key: 'Depok' },
  { name: 'Bekasi', key: 'Bekasi' },
];

// Performance constants
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
const COUNTDOWN_UPDATE_INTERVAL = 10 * 1000; // 10 seconds (instead of 1 second)
const DEBOUNCE_DELAY = 300; // 300ms debounce for city changes

interface CacheEntry {
  data: PrayerScheduleData;
  timestamp: number;
}

// Cache utilities
const getCacheKey = (city: string) => {
  const today = new Date().toISOString().split('T')[0];
  return `prayer_times_${city}_${today}`;
};

const getFromCache = (city: string): PrayerScheduleData | null => {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(getCacheKey(city));
    if (!cached) return null;
    
    const entry: CacheEntry = JSON.parse(cached);
    const isExpired = Date.now() - entry.timestamp > CACHE_DURATION;
    
    if (isExpired) {
      localStorage.removeItem(getCacheKey(city));
      return null;
    }
    
    return entry.data;
  } catch (err) {
    console.warn('Cache read error:', err);
    return null;
  }
};

const saveToCache = (city: string, data: PrayerScheduleData) => {
  if (typeof window === 'undefined') return;
  try {
    const entry: CacheEntry = { data, timestamp: Date.now() };
    localStorage.setItem(getCacheKey(city), JSON.stringify(entry));
  } catch (err) {
    console.warn('Cache write error:', err);
  }
};

function PrayerScheduleCardContent() {
  const [selectedCity, setSelectedCity] = useState('Jakarta');
  const [prayerTimes, setPrayerTimes] = useState<PrayerTime[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Update prayer times and start countdown
  const updatePrayerTimes = useCallback((schedule: PrayerScheduleData) => {
    const prayers = [
      { name: 'Subuh', time: schedule.fajr },
      { name: 'Dzuhur', time: schedule.dhuhr },
      { name: 'Ashar', time: schedule.asr },
      { name: 'Maghrib', time: schedule.maghrib },
      { name: 'Isya', time: schedule.isha },
    ];

    const now = new Date();
    const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();

    let nextPrayerIndex = -1;
    let closestTime = Infinity;

    const updatedPrayers = prayers.map((prayer, index) => {
      const [hours, minutes] = prayer.time.split(':').map(Number);
      const prayerTimeInMinutes = hours * 60 + minutes;
      const timeDiff = prayerTimeInMinutes - currentTimeInMinutes;

      if (timeDiff > 0 && timeDiff < closestTime) {
        closestTime = timeDiff;
        nextPrayerIndex = index;
      }

      return {
        ...prayer,
        isNext: false,
        countdown: '',
      };
    });

    if (nextPrayerIndex !== -1) {
      updatedPrayers[nextPrayerIndex].isNext = true;
    }

    setPrayerTimes(updatedPrayers);
    startCountdown(updatedPrayers);
  }, []);

  // Optimized countdown - update every 10 seconds instead of 1 second
  const startCountdown = useCallback((prayers: PrayerTime[]) => {
    const updateCountdownDisplay = () => {
      const now = new Date();
      const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();

      const updated = prayers.map((prayer) => {
        const [hours, minutes] = prayer.time.split(':').map(Number);
        const prayerTimeInMinutes = hours * 60 + minutes;
        const timeDiff = prayerTimeInMinutes - currentTimeInMinutes;

        if (timeDiff > 0) {
          const h = Math.floor(timeDiff / 60);
          const m = timeDiff % 60;
          return {
            ...prayer,
            countdown: `${h > 0 ? h + 'j ' : ''}${m}m`,
          };
        }

        return {
          ...prayer,
          countdown: 'Berlalu',
        };
      });

      setPrayerTimes(updated);
    };

    // Initial update
    updateCountdownDisplay();
    
    // Clear existing interval
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }
    
    // Update every 10 seconds (significantly reduces CPU usage)
    countdownRef.current = setInterval(updateCountdownDisplay, COUNTDOWN_UPDATE_INTERVAL);
  }, []);

  // Fetch with cache and debounce
  const fetchPrayerTimes = useCallback(async (city: string) => {
    // Check cache first
    const cached = getFromCache(city);
    if (cached) {
      updatePrayerTimes(cached);
      return;
    }

    // Cancel previous request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);
    
    try {
      const today = new Date();
      const date = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;
      
      const response = await fetch(
        `https://api.aladhan.com/v1/timingsByCity/${date}?city=${city}&country=Indonesia&method=2`,
        { signal: abortControllerRef.current.signal }
      );
      
      if (!response.ok) throw new Error('Gagal mengambil data jadwal sholat');
      
      const data = await response.json();
      const timings = data.data.timings;
      
      const scheduleData: PrayerScheduleData = {
        fajr: timings.Fajr,
        dhuhr: timings.Dhuhr,
        asr: timings.Asr,
        maghrib: timings.Maghrib,
        isha: timings.Isha,
      };
      
      // Save to cache
      saveToCache(city, scheduleData);
      updatePrayerTimes(scheduleData);
    } catch (err: any) {
      if (err.name === 'AbortError') return; // Ignore aborted requests
      console.error('Error fetching prayer times:', err);
      setError('Gagal memuat jadwal sholat');
      setPrayerTimes([]);
    } finally {
      setLoading(false);
    }
  }, [updatePrayerTimes]);

  // Debounced city change handler
  const handleCityChange = useCallback((city: string) => {
    setSelectedCity(city);
    setShowCityPicker(false);
    
    // Clear previous debounce
    if (debounceRef.current) clearTimeout(debounceRef.current);
    
    // Debounce fetch by 300ms to avoid multiple rapid API calls
    debounceRef.current = setTimeout(() => {
      fetchPrayerTimes(city);
    }, DEBOUNCE_DELAY);
  }, [fetchPrayerTimes]);

  // Initial fetch on mount
  useEffect(() => {
    fetchPrayerTimes(selectedCity);
  }, [selectedCity, fetchPrayerTimes]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  // Memoized city picker to prevent unnecessary re-renders
  const CityPicker = useMemo(
    () => (
      <div className="relative">
        <button
          onClick={() => setShowCityPicker(!showCityPicker)}
          className="px-3 py-1.5 text-xs font-medium text-[#2f67b2] dark:text-[#6bc6e5] bg-[#2f67b2]/10 dark:bg-[#6bc6e5]/10 border border-[#2f67b2]/30 dark:border-[#6bc6e5]/30 rounded-lg hover:bg-[#2f67b2]/20 dark:hover:bg-[#6bc6e5]/20 transition-colors"
        >
          Ubah Kota
        </button>

        {showCityPicker && (
          <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
            {INDONESIAN_CITIES.map((city) => (
              <button
                key={city.key}
                onClick={() => handleCityChange(city.name)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                  selectedCity === city.name
                    ? 'bg-[#2f67b2]/10 dark:bg-[#6bc6e5]/20 text-[#2f67b2] dark:text-[#6bc6e5] font-medium'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {city.name}
              </button>
            ))}
          </div>
        )}
      </div>
    ),
    [showCityPicker, selectedCity, handleCityChange]
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-lg border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#2f67b2]/10 dark:bg-[#6bc6e5]/20 rounded-lg flex items-center justify-center">
            <svg
              className="w-5 h-5 text-[#2f67b2] dark:text-[#6bc6e5]"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
              🕌 Jadwal Sholat Selanjutnya
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {selectedCity}
            </p>
          </div>
        </div>

        {/* City Picker - Memoized */}
        {CityPicker}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-6">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#2f67b2] border-t-[#6bc6e5]"></div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Prayer Times Grid */}
      {!loading && prayerTimes.length > 0 && (
        <div className="space-y-2">
          {prayerTimes.map((prayer, index) => (
            <div
              key={index}
              className={`flex items-center justify-between p-3 rounded-lg transition-all duration-300 border ${
                prayer.isNext
                  ? 'bg-linear-to-r from-[#2f67b2] to-[#6bc6e5] border-[#2f67b2] shadow-md ring-2 ring-[#2f67b2]/50'
                  : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50'
              }`}
            >
              <div className="flex items-center gap-3 flex-1">
                {prayer.isNext && (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  </div>
                )}
                <span
                  className={`font-medium text-sm ${
                    prayer.isNext
                      ? 'text-white'
                      : 'text-gray-900 dark:text-gray-100'
                  }`}
                >
                  {prayer.name}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`font-semibold text-sm ${
                    prayer.isNext
                      ? 'text-white'
                      : 'text-gray-800 dark:text-gray-100'
                  }`}
                >
                  {prayer.time}
                </span>

                <div
                  className={`text-xs font-medium px-2.5 py-1 rounded-full min-w-fit border ${
                    prayer.isNext
                      ? 'bg-white/20 border-white/30 text-white'
                      : prayer.countdown === 'Berlalu'
                      ? 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                      : 'bg-[#2f67b2]/10 dark:bg-[#6bc6e5]/10 border-[#2f67b2]/30 dark:border-[#6bc6e5]/30 text-[#2f67b2] dark:text-[#6bc6e5]'
                  }`}
                >
                  {prayer.isNext ? (
                    <span className="flex items-center gap-1.5">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5z" />
                      </svg>
                      {prayer.countdown}
                    </span>
                  ) : (
                    prayer.countdown
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Data State */}
      {!loading && prayerTimes.length === 0 && !error && (
        <div className="text-center py-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Silakan tunggu data dimuat...
          </p>
        </div>
      )}
    </div>
  );
}

// Export with React.memo to prevent unnecessary re-renders from parent component changes
export default React.memo(PrayerScheduleCardContent);
