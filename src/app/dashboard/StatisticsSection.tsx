'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ResponsiveBar } from '@nivo/bar';
import { ResponsivePie } from '@nivo/pie';

interface DailyLog {
  date: string;
  activities: Record<string, {
    name: string;
    category: string;
    status: 'completed' | 'pending';
    time?: string;
  }>;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Bangun Tidur': '#2f67b2',
  'Waktu Subuh': '#3f7fca',
  'Pagi Hari': '#4a8ed8',
  'Waktu Dzuhur': '#5a9ee6',
  'Waktu Ashar': '#6bc6e5',
  'Waktu Maghrib': '#7bcde8',
  'Waktu Isya': '#8bd5eb',
  'Waktu Tidur': '#9bddef',
};

const WEEKDAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export default function StatisticsSection() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [categoryStats, setCategoryStats] = useState<Array<{ name: string; completed: number; pending: number }>>([]);
  const [overallStats, setOverallStats] = useState({ total: 0, completed: 0, pending: 0 });
  const [topActivities, setTopActivities] = useState<Array<{ name: string; count: number; category: string }>>([]);
  const [bestCategory, setBestCategory] = useState<{ name: string; rate: number } | null>(null);
  const [weakestCategory, setWeakestCategory] = useState<{ name: string; rate: number } | null>(null);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [perfectDays, setPerfectDays] = useState(0);
  const [bestDayOfWeek, setBestDayOfWeek] = useState<{ name: string; rate: number; total: number } | null>(null);
  const [recentCompletionRate, setRecentCompletionRate] = useState(0);
  const [momentumChange, setMomentumChange] = useState(0);

  useEffect(() => {
    const loadStatistics = async () => {
      if (!session?.user?.email) return;

      setLoading(true);
      try {
        const logsRef = collection(db, 'users', session.user.email, 'daily_logs');
        const snapshot = await getDocs(logsRef);
        
        const logs: DailyLog[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data() as DailyLog;
          logs.push(data);
        });

        setDailyLogs(logs);

        // Hitung statistik per kategori
        const categoryMap = new Map<string, { completed: number; pending: number }>();
        const activityMap = new Map<string, { count: number; category: string }>();
        let totalCompleted = 0;
        let totalPending = 0;

        logs.forEach((log) => {
          Object.values(log.activities).forEach((activity) => {
            const category = activity.category;
            
            // Category stats
            if (!categoryMap.has(category)) {
              categoryMap.set(category, { completed: 0, pending: 0 });
            }
            const stats = categoryMap.get(category)!;
            if (activity.status === 'completed') {
              stats.completed++;
              totalCompleted++;
              
              // Top activities (hanya yang completed)
              const actKey = activity.name;
              if (!activityMap.has(actKey)) {
                activityMap.set(actKey, { count: 0, category });
              }
              activityMap.get(actKey)!.count++;
            } else {
              stats.pending++;
              totalPending++;
            }
          });
        });

        const categoryData = Array.from(categoryMap.entries()).map(([name, stats]) => ({
          name,
          completed: stats.completed,
          pending: stats.pending,
        }));

        // Top 5 aktivitas paling sering diselesaikan
        const topActs = Array.from(activityMap.entries())
          .map(([name, data]) => ({ name, ...data }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
        setTopActivities(topActs);

        // Kategori dengan completion rate tertinggi
        const categoryRates = categoryData
          .map(cat => ({
            name: cat.name,
            rate: cat.completed + cat.pending > 0 
              ? Math.round((cat.completed / (cat.completed + cat.pending)) * 100)
              : 0
          }))
          .sort((a, b) => b.rate - a.rate);
        setBestCategory(categoryRates[0] || null);
        setWeakestCategory(categoryRates[categoryRates.length - 1] || null);

        // Hitung hari paling produktif (berdasarkan completion rate per hari dalam seminggu)
        const weekdayStats = Array.from({ length: 7 }, () => ({ completed: 0, total: 0 }));
        logs.forEach((log) => {
          const dayIdx = new Date(log.date).getDay();
          Object.values(log.activities).forEach((activity) => {
            weekdayStats[dayIdx].total += 1;
            if (activity.status === 'completed') {
              weekdayStats[dayIdx].completed += 1;
            }
          });
        });
        const weekdayRates = weekdayStats.map((stat, idx) => ({
          name: WEEKDAY_NAMES[idx],
          total: stat.total,
          rate: stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0,
        }));
        const productiveDay = weekdayRates
          .filter((w) => w.total > 0)
          .sort((a, b) => b.rate - a.rate)[0] || null;
        setBestDayOfWeek(productiveDay);

        // Momentum 7 hari terakhir vs 7 hari sebelumnya
        const sortedLogsFull = logs.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const computeRate = (items: DailyLog[]) => {
          let completed = 0;
          let total = 0;
          items.forEach((log) => {
            Object.values(log.activities).forEach((act) => {
              total++;
              if (act.status === 'completed') completed++;
            });
          });
          return total > 0 ? Math.round((completed / total) * 100) : 0;
        };
        const recentLogs = sortedLogsFull.slice(0, 7);
        const previousLogs = sortedLogsFull.slice(7, 14);
        const recentRate = computeRate(recentLogs);
        const previousRate = computeRate(previousLogs);
        setRecentCompletionRate(recentRate);
        setMomentumChange(recentRate - previousRate);

        // Hitung streak (hari berturut-turut dengan aktivitas completed)
        const sortedLogs = logs
          .map(log => ({
            date: new Date(log.date),
            hasCompleted: Object.values(log.activities).some(act => act.status === 'completed')
          }))
          .sort((a, b) => b.date.getTime() - a.date.getTime());

        let streak = 0;
        for (let i = 0; i < sortedLogs.length; i++) {
          if (sortedLogs[i].hasCompleted) {
            streak++;
            // Check if next day is consecutive
            if (i < sortedLogs.length - 1) {
              const currentDate = sortedLogs[i].date;
              const nextDate = sortedLogs[i + 1].date;
              const diffDays = Math.floor((currentDate.getTime() - nextDate.getTime()) / (1000 * 60 * 60 * 24));
              if (diffDays > 1) break; // Gap ditemukan
            }
          } else {
            break;
          }
        }
        setCurrentStreak(streak);

        // Hitung Perfect Days (hari dengan 100% completion)
        let perfectDaysCount = 0;
        logs.forEach((log) => {
          const activities = Object.values(log.activities);
          if (activities.length > 0) {
            const allCompleted = activities.every(act => act.status === 'completed');
            if (allCompleted) {
              perfectDaysCount++;
            }
          }
        });
        setPerfectDays(perfectDaysCount);

        setCategoryStats(categoryData);
        setOverallStats({
          total: totalCompleted + totalPending,
          completed: totalCompleted,
          pending: totalPending,
        });
      } catch (error) {
        console.error('Gagal memuat statistik:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStatistics();
  }, [session]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600 dark:text-gray-400">Memuat statistik...</div>
      </div>
    );
  }

  if (dailyLogs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <svg
          className="w-16 h-16 text-gray-400 mb-4"
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
        <p className="text-gray-600 dark:text-gray-400 text-center">
          Belum ada data aktivitas.
          <br />
          Mulai isi checklist harian untuk melihat statistik Anda.
        </p>
      </div>
    );
  }

  const completionRate = overallStats.total > 0 
    ? Math.round((overallStats.completed / overallStats.total) * 100) 
    : 0;

  const pieData = [
    { id: 'completed', label: 'Selesai', value: overallStats.completed, color: '#10b981' },
    { id: 'pending', label: 'Belum', value: overallStats.pending, color: '#ef4444' },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Overall Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-linear-to-br from-[#2f67b2] to-[#1f4f91] text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Total Aktivitas</p>
              <p className="text-3xl font-bold mt-1">{overallStats.total}</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-linear-to-br from-green-500 to-green-600 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Diselesaikan</p>
              <p className="text-3xl font-bold mt-1">{overallStats.completed}</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-linear-to-br from-[#6bc6e5] to-[#4a8ed8] text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Tingkat Penyelesaian</p>
              <p className="text-3xl font-bold mt-1">{completionRate}%</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown Bar Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border-t-4 border-[#2f67b2]">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-[#2f67b2]/10 dark:bg-[#2f67b2]/20 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-[#2f67b2] dark:text-[#6bc6e5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Aktivitas per Kategori
            </h3>
          </div>
          <div style={{ height: '300px' }}>
            <ResponsiveBar
              data={categoryStats}
              keys={['completed', 'pending']}
              indexBy="name"
              margin={{ top: 20, right: 20, bottom: 80, left: 60 }}
              padding={0.3}
              valueScale={{ type: 'linear' }}
              indexScale={{ type: 'band', round: true }}
              colors={['#10b981', '#f43f5e']}
              borderColor={{
                from: 'color',
                modifiers: [['darker', 1.6]]
              }}
              axisTop={null}
              axisRight={null}
              axisBottom={{
                tickSize: 5,
                tickPadding: 5,
                tickRotation: -45,
                legend: '',
                legendPosition: 'middle',
                legendOffset: 32
              }}
              axisLeft={{
                tickSize: 5,
                tickPadding: 5,
                tickRotation: 0,
                legend: 'Jumlah',
                legendPosition: 'middle',
                legendOffset: -45
              }}
              labelSkipWidth={12}
              labelSkipHeight={12}
              labelTextColor={{
                from: 'color',
                modifiers: [['darker', 1.6]]
              }}
              legends={[
                {
                  dataFrom: 'keys',
                  anchor: 'bottom-right',
                  direction: 'column',
                  justify: false,
                  translateX: 0,
                  translateY: -70,
                  itemsSpacing: 2,
                  itemWidth: 100,
                  itemHeight: 20,
                  itemDirection: 'left-to-right',
                  itemOpacity: 0.85,
                  symbolSize: 20,
                  effects: [
                    {
                      on: 'hover',
                      style: {
                        itemOpacity: 1
                      }
                    }
                  ],
                  data: [
                    { id: 'completed', label: 'Selesai', color: '#10b981' },
                    { id: 'pending', label: 'Belum', color: '#f43f5e' }
                  ]
                }
              ]}
              role="application"
              ariaLabel="Grafik aktivitas per kategori"
              animate={true}
              motionConfig="gentle"
              theme={{
                axis: {
                  ticks: {
                    text: {
                      fontSize: 11,
                      fill: '#6b7280'
                    }
                  },
                  legend: {
                    text: {
                      fontSize: 12,
                      fill: '#374151',
                      fontWeight: 600
                    }
                  }
                },
                tooltip: {
                  container: {
                    background: '#1f2937',
                    color: '#fff',
                    fontSize: '12px',
                    borderRadius: '8px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                  }
                }
              }}
            />
          </div>
        </div>

        {/* Overall Completion Pie Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border-t-4 border-[#6bc6e5]">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-[#6bc6e5]/10 dark:bg-[#6bc6e5]/20 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-[#6bc6e5] dark:text-[#6bc6e5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Status Keseluruhan
            </h3>
          </div>
          <div style={{ height: '300px' }}>
            <ResponsivePie
              data={pieData}
              margin={{ top: 20, right: 80, bottom: 20, left: 80 }}
              innerRadius={0.5}
              padAngle={0.7}
              cornerRadius={3}
              activeOuterRadiusOffset={8}
              colors={['#10b981', '#f43f5e']}
              borderWidth={1}
              borderColor={{
                from: 'color',
                modifiers: [['darker', 0.2]]
              }}
              arcLinkLabelsSkipAngle={10}
              arcLinkLabelsTextColor="#6b7280"
              arcLinkLabelsThickness={2}
              arcLinkLabelsColor={{ from: 'color' }}
              arcLabelsSkipAngle={10}
              arcLabelsTextColor={{
                from: 'color',
                modifiers: [['darker', 2]]
              }}
              arcLabel={(d) => `${d.value}`}
              tooltip={({ datum }) => (
                <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-xl text-xs font-medium">
                  <strong>{datum.label}</strong>: {datum.value} ({Math.round((datum.value / overallStats.total) * 100)}%)
                </div>
              )}
              legends={[
                {
                  anchor: 'bottom',
                  direction: 'row',
                  justify: false,
                  translateX: 0,
                  translateY: 20,
                  itemsSpacing: 10,
                  itemWidth: 100,
                  itemHeight: 18,
                  itemTextColor: '#6b7280',
                  itemDirection: 'left-to-right',
                  itemOpacity: 1,
                  symbolSize: 18,
                  symbolShape: 'circle',
                  effects: [
                    {
                      on: 'hover',
                      style: {
                        itemTextColor: '#374151'
                      }
                    }
                  ]
                }
              ]}
              animate={true}
              motionConfig="gentle"
            />
          </div>
        </div>
      </div>

      {/* Summary Info */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border-t-4 border-[#2f67b2]">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 bg-[#2f67b2]/10 dark:bg-[#2f67b2]/20 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-[#2f67b2] dark:text-[#6bc6e5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Ringkasan
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-linear-to-br from-[#2f67b2]/10 to-[#2f67b2]/20 dark:from-[#2f67b2]/20 dark:to-[#2f67b2]/30 rounded-lg p-4 border border-[#2f67b2]/30 dark:border-[#2f67b2]/50">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-4 h-4 text-[#2f67b2] dark:text-[#6bc6e5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-xs text-[#2f67b2] dark:text-[#6bc6e5] font-medium">Total Hari Tercatat</p>
            </div>
            <p className="text-2xl font-bold text-[#2f67b2] dark:text-[#6bc6e5]">{dailyLogs.length}</p>
            <p className="text-xs text-[#2f67b2]/70 dark:text-[#6bc6e5]/70 mt-1">hari aktivitas</p>
          </div>
          <div className="bg-linear-to-br from-[#1f4f91]/10 to-[#1f4f91]/20 dark:from-[#2f67b2]/20 dark:to-[#2f67b2]/30 rounded-lg p-4 border border-[#1f4f91]/30 dark:border-[#2f67b2]/50">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-4 h-4 text-[#1f4f91] dark:text-[#2f67b2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-[#1f4f91] dark:text-[#2f67b2] font-medium">Diselesaikan</p>
            </div>
            <p className="text-2xl font-bold text-[#1f4f91] dark:text-[#2f67b2]">{overallStats.completed}</p>
            <p className="text-xs text-[#1f4f91]/70 dark:text-[#2f67b2]/70 mt-1">aktivitas</p>
          </div>
          <div className="bg-linear-to-br from-[#6bc6e5]/10 to-[#6bc6e5]/20 dark:from-[#6bc6e5]/20 dark:to-[#6bc6e5]/30 rounded-lg p-4 border border-[#6bc6e5]/30 dark:border-[#6bc6e5]/50">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-4 h-4 text-[#6bc6e5] dark:text-[#6bc6e5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-[#6bc6e5] dark:text-[#6bc6e5] font-medium">Tertunda</p>
            </div>
            <p className="text-2xl font-bold text-[#6bc6e5] dark:text-[#6bc6e5]">{overallStats.pending}</p>
            <p className="text-xs text-[#6bc6e5]/70 dark:text-[#6bc6e5]/70 mt-1">aktivitas</p>
          </div>
          <div className="bg-linear-to-br from-[#4a8ed8]/10 to-[#4a8ed8]/20 dark:from-[#4a8ed8]/20 dark:to-[#4a8ed8]/30 rounded-lg p-4 border border-[#4a8ed8]/30 dark:border-[#4a8ed8]/50">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-4 h-4 text-[#4a8ed8] dark:text-[#4a8ed8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <p className="text-xs text-[#4a8ed8] dark:text-[#4a8ed8] font-medium">Rata-rata per Hari</p>
            </div>
            <p className="text-2xl font-bold text-[#4a8ed8] dark:text-[#4a8ed8]">{dailyLogs.length > 0 ? Math.round(overallStats.completed / dailyLogs.length) : 0}</p>
            <p className="text-xs text-[#4a8ed8]/70 dark:text-[#4a8ed8]/70 mt-1">aktivitas</p>
          </div>
        </div>
      </div>

      {/* New Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Aktivitas */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border-t-4 border-[#2f67b2]">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-[#2f67b2]/10 dark:bg-[#2f67b2]/20 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-[#2f67b2] dark:text-[#6bc6e5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Top 5 Aktivitas Favorit
            </h3>
          </div>
          <div className="space-y-3">
            {topActivities.length > 0 ? (
              topActivities.map((activity, index) => (
                <div key={activity.name} className="flex items-center justify-between p-3 bg-linear-to-br from-[#2f67b2]/5 to-[#6bc6e5]/10 dark:from-[#2f67b2]/10 dark:to-[#6bc6e5]/20 rounded-lg border border-[#2f67b2]/20 dark:border-[#2f67b2]/30 hover:from-[#2f67b2]/10 hover:to-[#6bc6e5]/20 transition-all duration-200">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-lg ${
                      index === 0 ? 'bg-linear-to-br from-[#2f67b2] to-[#1f4f91] text-white' :
                      index === 1 ? 'bg-linear-to-br from-[#4a8ed8] to-[#3f7fca] text-white' :
                      index === 2 ? 'bg-linear-to-br from-[#6bc6e5] to-[#4a8ed8] text-white' :
                      'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">{activity.name}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{activity.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-[#2f67b2]/10 dark:bg-[#2f67b2]/20 px-2 py-1 rounded-full">
                    <svg className="w-4 h-4 text-[#2f67b2] dark:text-[#6bc6e5]" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span className="font-bold text-sm text-[#2f67b2] dark:text-[#6bc6e5]">{activity.count}x</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">Belum ada data aktivitas</p>
            )}
          </div>
        </div>

        {/* Achievement Cards */}
        <div className="space-y-4">
          {/* Best Category */}
          <div className="bg-linear-to-br from-[#2f67b2] to-[#1f4f91] text-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-white/90">Kategori Terbaik</p>
                <p className="text-2xl font-bold text-white">{bestCategory?.name || '-'}</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-white/20">
              <p className="text-sm font-semibold text-white/90">
                Tingkat penyelesaian: <span className="font-bold text-lg text-white">{bestCategory?.rate || 0}%</span>
              </p>
            </div>
          </div>

          {/* Current Streak */}
          <div className="bg-linear-to-br from-[#6bc6e5] to-[#4a8ed8] text-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-white/90">Konsistensi</p>
                <p className="text-2xl font-bold text-white">{currentStreak} Hari</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-white/20">
              <p className="text-sm font-semibold text-white/90">
                {currentStreak > 0 ? '🔥 Pertahankan semangat Anda!' : '💪 Mulai konsistensi hari ini!'}
              </p>
            </div>
          </div>

          {/* Perfect Days */}
          <div className="bg-linear-to-br from-[#3f7fca] to-[#2f67b2] text-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-white/90">Hari Sempurna</p>
                <p className="text-2xl font-bold text-white">{perfectDays} Hari</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-white/20">
              <p className="text-sm font-semibold text-white/90">
                {perfectDays > 0 ? '⭐ 100% aktivitas diselesaikan!' : '🎯 Capai hari sempurna pertama!'}
              </p>
            </div>
          </div>
        </div>

        {/* Insight Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-linear-to-br from-[#2f67b2] to-[#1f4f91] text-white rounded-xl p-5 shadow-lg">
            <p className="text-xs font-semibold text-white/80">Hari Paling Produktif</p>
            <p className="text-2xl font-bold mt-1">{bestDayOfWeek?.name || '-'}</p>
            <p className="text-sm text-white/80">{bestDayOfWeek ? `${bestDayOfWeek.rate}% completion (${bestDayOfWeek.total} aktivitas)` : 'Belum ada data'}</p>
          </div>

          <div className="bg-linear-to-br from-green-500 to-emerald-600 text-white rounded-xl p-5 shadow-lg">
            <p className="text-xs font-semibold text-white/80">Momentum 7 Hari</p>
            <p className="text-2xl font-bold mt-1 flex items-center gap-2">
              <span className={`${momentumChange >= 0 ? 'text-white' : 'text-white'}`}>{momentumChange >= 0 ? '▲' : '▼'}</span>
              {Math.abs(momentumChange)}%
            </p>
            <p className="text-sm text-white/80">vs minggu lalu · completion {recentCompletionRate}%</p>
          </div>

          <div className="bg-linear-to-br from-[#2f67b2] to-[#1f4f91] text-white rounded-xl p-5 shadow-lg">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 bg-white/15 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold text-white/80">Perlu Perhatian</p>
                <p className="text-2xl font-bold">{weakestCategory?.name || '-'}</p>
              </div>
            </div>
            <p className="text-sm text-white/80">Completion rate: {weakestCategory ? `${weakestCategory.rate}%` : 'Belum ada data'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
