"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp, collection, getDocs, deleteDoc } from "firebase/firestore";

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
  const { data: session, status } = useSession();
  const router = useRouter();

  const [surahList, setSurahList] = useState<SurahMeta[]>([]);
  const [surahLoading, setSurahLoading] = useState(false);
  const [surahError, setSurahError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [selectedSurah, setSelectedSurah] = useState<SurahDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);
  const [bookmark, setBookmark] = useState<{ surah: number; ayah: number } | null>(null);
  const [completedSurahs, setCompletedSurahs] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  // Force login redirect
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/");
    }
  }, [status, router]);

  // Load saved bookmark from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("quran-bookmark");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as { surah: number; ayah: number };
      if (parsed?.surah && parsed?.ayah) {
        setBookmark(parsed);
      }
    } catch {
      // ignore parse errors
    }
    return () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    };
  }, []);

  // Track scroll position for scroll-to-top button
  useEffect(() => {
    const handleScroll = () => {
      if (contentRef.current) {
        const scrollTop = contentRef.current.scrollTop;
        setShowScrollTop(scrollTop > 300);
      }
    };

    const contentElement = contentRef.current;
    if (contentElement) {
      contentElement.addEventListener('scroll', handleScroll);
      return () => contentElement.removeEventListener('scroll', handleScroll);
    }
  }, [selectedSurah]);

  // Load completed surahs from Firestore
  useEffect(() => {
    const email = session?.user?.email;
    if (!email) return;

    const loadCompleted = async () => {
      try {
        const colRef = collection(db, "users", email, "surah_completed");
        const snapshot = await getDocs(colRef);
        const completed = new Set<number>();
        snapshot.forEach((doc) => {
          const surahNumber = parseInt(doc.id);
          if (!isNaN(surahNumber)) completed.add(surahNumber);
        });
        setCompletedSurahs(completed);
      } catch (error) {
        console.error("Failed to load completed surahs:", error);
      }
    };

    loadCompleted();
  }, [session?.user?.email]);

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

  const showToast = (message: string, type: "success" | "error") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  };

  const saveBookmark = async (surah: number, ayah: number) => {
    const data = { surah, ayah };
    setBookmark(data);
    localStorage.setItem("quran-bookmark", JSON.stringify(data));

    // Persist to Firestore if user is logged in
    const email = session?.user?.email;
    if (email) {
      try {
        const ref = doc(db, "users", email, "last_read", "bookmark");
        await setDoc(ref, {
          surah,
          ayah,
          updatedAt: serverTimestamp(),
        });
        showToast("Tersimpan ke akun Anda", "success");
        return;
      } catch (error) {
        showToast("Gagal menyimpan ke cloud, disimpan lokal", "error");
        return;
      }
    }

    showToast("Tersimpan di perangkat", "success");
  };

  const goToBookmark = async () => {
    if (!bookmark) return;
    await loadSurahDetail(bookmark.surah);
    setVisibleCount(Math.max(20, bookmark.ayah + 5));
    setTimeout(() => {
      const el = document.getElementById(`ayah-${bookmark.ayah}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 200);
  };

  const markSurahCompleted = async (surahNumber: number) => {
    const email = session?.user?.email;
    if (!email) {
      showToast("Silakan login untuk menyimpan", "error");
      return;
    }

    const isCompleted = completedSurahs.has(surahNumber);

    try {
      const ref = doc(db, "users", email, "surah_completed", String(surahNumber));
      
      if (isCompleted) {
        // Remove from database
        await deleteDoc(ref);
        setCompletedSurahs((prev) => {
          const newSet = new Set(prev);
          newSet.delete(surahNumber);
          return newSet;
        });
        showToast("Tanda selesai dibaca dibatalkan", "success");
      } else {
        // Add to database
        await setDoc(ref, {
          surahNumber,
          completedAt: serverTimestamp(),
        });
        setCompletedSurahs((prev) => new Set(prev).add(surahNumber));
        showToast("Surah ditandai selesai dibaca", "success");
      }
    } catch (error) {
      console.error("Failed to toggle surah completion:", error);
      showToast("Gagal menyimpan, coba lagi", "error");
    }
  };

  const scrollToTop = () => {
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
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
            id={`ayah-${v.number.inSurah}`}
            className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white/70 dark:bg-gray-800/60 p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="text-sm font-semibold text-[#1f4f91] dark:text-[#6bc6e5]">{v.number.inSurah}</span>
              <p className="text-right text-2xl md:text-3xl leading-loose text-gray-900 dark:text-white">{v.text.arab}</p>
            </div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 italic">{v.text.transliteration.en}</p>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">{v.translation.id}</p>

            <div className="mt-3 flex justify-end">
              <button
                onClick={() => selectedSurah && saveBookmark(selectedSurah.number, v.number.inSurah)}
                className="text-xs px-3 py-1 rounded-lg border border-[#1f4f91]/30 text-[#1f4f91] dark:text-[#6bc6e5] hover:bg-[#1f4f91]/10 dark:hover:bg-[#1f4f91]/20"
              >
                Tandai terakhir dibaca
              </button>
            </div>
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
                const isCompleted = completedSurahs.has(surah.number);
                return (
                  <button
                    key={surah.number}
                    onClick={() => loadSurahDetail(surah.number)}
                    className={`w-full text-left p-3 rounded-xl transition-colors border relative ${
                      isActive
                        ? "border-[#1f4f91] bg-[#e8f1fb] dark:bg-[#1f4f91]/20 text-[#1f4f91] dark:text-[#6bc6e5]"
                        : "border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 hover:border-[#1f4f91]/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-semibold flex items-center gap-2">
                          {surah.number}. {surah.name.transliteration.id}
                          {isCompleted && (
                            <span className="text-green-600 dark:text-green-400" title="Selesai dibaca">
                              ✓
                            </span>
                          )}
                        </p>
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
          <div 
            ref={contentRef}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 min-h-[60vh] max-h-[85vh] overflow-y-auto relative"
          >
            {/* Toast */}
            {toast && (
              <div
                className={`fixed right-6 top-6 z-50 rounded-lg px-4 py-3 text-sm shadow-lg border backdrop-blur-sm
                ${toast.type === "success" ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/40 dark:border-green-700 dark:text-green-100" : "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/40 dark:border-red-700 dark:text-red-100"}`}
              >
                {toast.message}
              </div>
            )}

            {/* Scroll to Top Button */}
            {showScrollTop && (
              <button
                onClick={scrollToTop}
                className="fixed bottom-8 right-8 z-40 bg-[#1f4f91] hover:bg-[#2f67b2] text-white p-3 rounded-full shadow-lg transition-all duration-300 hover:scale-110 active:scale-95"
                title="Kembali ke atas"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-6 w-6" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M5 10l7-7m0 0l7 7m-7-7v18" 
                  />
                </svg>
              </button>
            )}

            <div className="flex items-center justify-between mb-4">
              <div />
              <div className="flex items-center gap-2">
                {bookmark && (
                  <button
                    onClick={goToBookmark}
                    className="text-sm px-3 py-1 rounded-lg border border-[#1f4f91]/30 text-[#1f4f91] dark:text-[#6bc6e5] hover:bg-[#1f4f91]/10 dark:hover:bg-[#1f4f91]/20"
                  >
                    Lanjutkan terakhir: Surah {bookmark.surah}, Ayat {bookmark.ayah}
                  </button>
                )}
                {selectedSurah && (
                  <button
                    onClick={() => markSurahCompleted(selectedSurah.number)}
                    className={`text-sm px-3 py-1 rounded-lg border transition-colors ${
                      completedSurahs.has(selectedSurah.number)
                        ? "border-green-200 bg-green-50 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300 hover:bg-red-50 hover:border-red-200 dark:hover:bg-red-900/30 dark:hover:border-red-700"
                        : "border-[#1f4f91]/30 text-[#1f4f91] dark:text-[#6bc6e5] hover:bg-[#1f4f91]/10 dark:hover:bg-[#1f4f91]/20"
                    }`}
                  >
                    {completedSurahs.has(selectedSurah.number) ? "✓ Selesai dibaca (klik untuk batal)" : "Tandai selesai dibaca"}
                  </button>
                )}
              </div>
            </div>
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
