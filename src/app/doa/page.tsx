'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

interface Doa {
  id: string;
  title: string;
  arabic: string;
  latin: string;
  translation: string;
  category: string;
}

export default function DoaPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [duas, setDuas] = useState<Doa[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('semua');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Redirect jika belum login
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  // Fetch doa-doa
  useEffect(() => {
    const fetchDuas = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/doa');
        const data = await response.json();
        setDuas(data);
      } catch (error) {
        console.error('Error fetching duas:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDuas();
  }, []);

  const filteredDuas = duas.filter((doa) => {
    const matchCategory = selectedCategory === 'semua' || doa.category === selectedCategory;
    const matchSearch = doa.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       doa.latin.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  const categories = ['semua', ...new Set(duas.map((d) => d.category))];

  if (status === 'loading') {
    return (
      <div className="flex justify-center items-center min-h-screen bg-[#f5f7fb] dark:bg-gray-900">
        <div className="text-gray-600 dark:text-gray-400">Memuat...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb] dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-[#1f4f91] dark:text-[#6bc6e5] hover:underline mb-4"
          >
            <ChevronLeft className="w-5 h-5" />
            Kembali ke Dashboard
          </Link>
          
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-2">
              🤲 Doa-Doa Harian
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Kumpulan doa sehari-hari lengkap dengan transliterasi dan terjemahan
            </p>
          </div>
        </div>

        {/* Filter & Search */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                🔍 Cari Doa
              </label>
              <input
                type="text"
                placeholder="Cari berdasarkan judul atau latin..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-[#3d3d3d] text-gray-800 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#2f67b2] transition-all"
              />
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                📂 Kategori
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-[#3d3d3d] text-gray-800 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#2f67b2] transition-all"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Result Count */}
          <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            Menampilkan <span className="font-bold text-[#1f4f91] dark:text-[#6bc6e5]">{filteredDuas.length}</span> doa
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin text-4xl">⏳</div>
            <p className="text-gray-600 dark:text-gray-400 mt-4">Memuat doa-doa...</p>
          </div>
        )}

        {/* Duas Grid */}
        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredDuas.map((doa, index) => (
              <div
                key={doa.id}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 animate-fade-in-up"
                style={{
                  animationDelay: `${index * 0.05}s`,
                }}
              >
                {/* Header */}
                <div className="mb-4 pb-4 border-b-2 border-[#2f67b2] dark:border-[#6bc6e5]">
                  <h3 className="text-xl font-bold text-[#2f67b2] dark:text-[#6bc6e5] mb-2">
                    {doa.title}
                  </h3>
                  <span className="inline-block bg-gradient-to-r from-[#2f67b2] to-[#6bc6e5] text-white px-3 py-1 rounded-full text-xs font-semibold">
                    {doa.category}
                  </span>
                </div>

                {/* Arabic Text */}
                <div className="mb-4 p-4 bg-[#eef3fb] dark:bg-[#1f4f91]/15 rounded-xl">
                  <p className="text-right text-xl md:text-2xl leading-loose text-[#1f4f91] dark:text-[#6bc6e5] font-semibold">
                    {doa.arabic}
                  </p>
                </div>

                {/* Latin/Transliterasi */}
                <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <p className="text-xs font-bold text-[#2f67b2] dark:text-[#6bc6e5] mb-2 uppercase tracking-wide">
                    Transliterasi:
                  </p>
                  <p className="text-sm italic text-gray-700 dark:text-gray-300 leading-relaxed">
                    {doa.latin}
                  </p>
                </div>

                {/* Translation */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs font-bold text-[#2f67b2] dark:text-[#6bc6e5] mb-2 uppercase tracking-wide">
                    Artinya:
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    "{doa.translation}"
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredDuas.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">
              Doa tidak ditemukan
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Coba kata kunci atau kategori lain
            </p>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation-name: fadeInUp;
          animation-duration: 0.5s;
          animation-timing-function: ease-out;
          animation-fill-mode: forwards;
        }
      `}</style>
    </div>
  );
}
