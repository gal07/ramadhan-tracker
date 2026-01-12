"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface SurahMeta {
  number: number;
  name: { short: string; transliteration: { id: string }; translation: { id: string } };
  revelation: { id: string };
  numberOfVerses: number;
}

interface Ayah {
  number: { inSurah: number };
  text: { arab: string; transliteration: { en: string } };
  translation: { id: string };
}

interface SurahDetail {
  number: number;
  name: { short: string; transliteration: { id: string }; translation: { id: string } };
  revelation: { id: string };
  numberOfVerses: number;
  verses: Ayah[];
}

export default function QuranPage() {
  const { status } = useSession();
  const router = useRouter();

  const [surahList, setSurahList] = useState<SurahMeta[]>([]);
  const [surahLoading, setSurahLoading] = useState(false);
  const [surahError, setSurahError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [selectedSurah, setSelectedSurah] = useState<SurahDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);

  // Force login redirect
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/");
    }
  }, [status, router]);

  // Fetch surah metadata once (lightweight)
  useEffect(() => {
    const controller = new AbortController();
    async function fetchSurahList() {
      setSurahLoading(true);
      setSurahError(null);
      try {
        const res = await fetch("https://api.quran.gading.dev/surah", {
          signal: controller.signal,
          cache: "force-cache",
        });
        if (!res.ok) throw new Error("Gagal memuat daftar surah");
        const json = await res.json();
        setSurahList(json.data as SurahMeta[]);
      } catch (err: any) {
        if (err.name === "AbortError") return;
        setSurahError(err.message || "Terjadi kesalahan saat memuat surah");
      } finally {
        setSurahLoading(false);
      }
    }

    fetchSurahList();
    return () => controller.abort();
  }, []);

  // Filtered list
  const filteredSurah = useMemo(() => {
    if (!search.trim()) return surahList;
    const q = search.toLowerCase();
    return surahList.filter((s) =>
      s.name.transliteration.id.toLowerCase().includes(q) ||
      s.name.short.toLowerCase().includes(q) ||
      String(s.number).includes(q)
    );
  }, [search, surahList]);

  const loadSurahDetail = async (number: number) => {
    const controller = new AbortController();
    setDetailLoading(true);
    setDetailError(null);
    setVisibleCount(20);
    setSelectedSurah(null);

    try {
      const res = await fetch(`https://api.quran.gading.dev/surah/${number}`, {
        signal: controller.signal,
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Gagal memuat surah");
      const json = await res.json();
      setSelectedSurah(json.data as SurahDetail);
    } catch (err: any) {
      if (err.name === "AbortError") return;
      setDetailError(err.message || "Terjadi kesalahan saat memuat surah");
    } finally {
      setDetailLoading(false);
    }
  };

  const renderVerses = () => {
    if (!selectedSurah) return null;
    const verses = selectedSurah.verses.slice(0, visibleCount);

    return (
      <div className="space-y-4">
        {verses.map((v) => (
          <div
            key={v.number.inSurah}
            className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white/70 dark:bg-gray-800/60 p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="text-sm font-semibold text-[#1f4f91] dark:text-[#6bc6e5]">{v.number.inSurah}</span>
              <p className="text-right text-2xl md:text-3xl leading-loose text-gray-900 dark:text-white">{v.text.arab}</p>
            </div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 italic">{v.text.transliteration.en}</p>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">{v.translation.id}</p>
          </div>
        ))}

        {visibleCount < (selectedSurah?.verses.length || 0) && (
          <div className="flex justify-center">
            <button
              onClick={() => setVisibleCount((c) => c + 20)}
              className="px-4 py-2 text-sm font-semibold text-white bg-[#1f4f91] hover:bg-[#2f67b2] rounded-lg shadow"
            >
              Muat 20 ayat berikutnya
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Al-Qur'an</h1>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="text-sm text-[#1f4f91] dark:text-[#6bc6e5] hover:underline"
          >
            ← Kembali ke dashboard
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px,1fr] gap-6">
          {/* Sidebar */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 h-fit">
            <div className="relative mb-4">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari surah (nama/nomor)"
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#2f67b2]"
              />
            </div>

            {surahLoading && (
              <p className="text-sm text-gray-500 dark:text-gray-400">Memuat daftar surah...</p>
            )}
            {surahError && (
              <p className="text-sm text-red-600">{surahError}</p>
            )}

            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
              {filteredSurah.map((surah) => {
                const isActive = surah.number === selectedSurah?.number;
                return (
                  <button
                    key={surah.number}
                    onClick={() => loadSurahDetail(surah.number)}
                    className={`w-full text-left p-3 rounded-xl transition-colors border ${
                      isActive
                        ? "border-[#1f4f91] bg-[#e8f1fb] dark:bg-[#1f4f91]/20 text-[#1f4f91] dark:text-[#6bc6e5]"
                        : "border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 hover:border-[#1f4f91]/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">{surah.number}. {surah.name.transliteration.id}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{surah.name.translation.id} • {surah.revelation.id}</p>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{surah.numberOfVerses} ayat</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 min-h-[60vh]">
            {!selectedSurah && !detailLoading && (
              <div className="text-center text-gray-600 dark:text-gray-400">
                Pilih surah untuk mulai membaca.
              </div>
            )}

            {detailLoading && (
              <div className="text-center text-gray-600 dark:text-gray-400">Memuat surah...</div>
            )}

            {detailError && (
              <div className="text-center text-red-600">{detailError}</div>
            )}

            {selectedSurah && !detailLoading && (
              <div className="space-y-4">
                <div className="border-b border-gray-100 dark:border-gray-700 pb-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{selectedSurah.revelation.id} • {selectedSurah.numberOfVerses} ayat</p>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedSurah.number}. {selectedSurah.name.transliteration.id}</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{selectedSurah.name.translation.id}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl text-[#1f4f91] dark:text-[#6bc6e5]">{selectedSurah.name.short}</p>
                  </div>
                </div>

                {renderVerses()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
