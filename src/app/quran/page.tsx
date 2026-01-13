"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
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

const QARI_OPTIONS = [
  { id: "Abdul_Basit_Murattal_192kbps", name: "Abdul Basit" },
  { id: "Alafasy_128kbps", name: "Mishary Alafasy" },
  { id: "Husary_128kbps", name: "Mahmoud Husary" },
  { id: "Minshawi_Murattal_128kbps", name: "Mohamed Minshawi" },
  { id: "muhammed_jibreel_128kbps", name: "Muhammad Jibreel" },
];

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
  const [currentPlayingAyah, setCurrentPlayingAyah] = useState<{ surah: number; ayah: number } | null>(null);
  const [selectedQari, setSelectedQari] = useState("Abdul_Basit_Murattal_192kbps");
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioSpeed, setAudioSpeed] = useState(1);
  const [autoPlayNext, setAutoPlayNext] = useState(false);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCleanupRef = useRef<(() => void) | null>(null);

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

  // Cleanup audio on unmount or surah change
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current.load();
      }
      if (audioCleanupRef.current) {
        audioCleanupRef.current();
      }
    };
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

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current.load();
      audioRef.current = null;
    }
    if (audioCleanupRef.current) {
      audioCleanupRef.current();
      audioCleanupRef.current = null;
    }
    setIsPlaying(false);
    setCurrentPlayingAyah(null);
  }, []);

  const playAyah = useCallback((surahNumber: number, ayahNumber: number) => {
    if (!selectedSurah) return;

    // Cleanup previous audio completely
    cleanupAudio();

    // Format: surah 001-114, ayah 001-286
    const surahPadded = String(surahNumber).padStart(3, '0');
    const ayahPadded = String(ayahNumber).padStart(3, '0');
    const audioUrl = `https://everyayah.com/data/${selectedQari}/${surahPadded}${ayahPadded}.mp3`;

    // Reuse or create audio element
    const audio = audioRef.current || new Audio();
    audio.src = audioUrl;
    audio.playbackRate = audioSpeed;
    audio.preload = 'auto';
    audioRef.current = audio;
    
    setCurrentPlayingAyah({ surah: surahNumber, ayah: ayahNumber });
    setIsPlaying(true);

    // Auto-scroll to playing ayah
    setTimeout(() => {
      const el = document.getElementById(`ayah-${ayahNumber}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);

    // Event handlers
    const handleEnded = () => {
      setIsPlaying(false);
      
      // Auto-play next ayah if enabled
      if (!autoPlayNext) {
        setCurrentPlayingAyah(null);
        return;
      }

      const nextAyah = ayahNumber + 1;
      if (nextAyah <= selectedSurah.numberOfVerses && nextAyah <= visibleCount) {
        setTimeout(() => playAyah(surahNumber, nextAyah), 500);
      } else if (nextAyah > selectedSurah.numberOfVerses && surahNumber < 114) {
        setCurrentPlayingAyah(null);
        showToast('Surah selesai. Lanjut ke surah berikutnya?', 'success');
      } else {
        setCurrentPlayingAyah(null);
      }
    };

    const handleError = () => {
      showToast('Audio tidak tersedia', 'error');
      cleanupAudio();
    };

    // Attach event listeners
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    // Store cleanup function
    audioCleanupRef.current = () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };

    // Play audio
    audio.play().catch((err) => {
      console.error('Audio play failed:', err);
      showToast('Gagal memutar audio', 'error');
      cleanupAudio();
    });
  }, [selectedSurah, selectedQari, audioSpeed, visibleCount, autoPlayNext, cleanupAudio]);

  const pauseAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const resumeAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, []);

  const stopAudio = useCallback(() => {
    cleanupAudio();
  }, [cleanupAudio]);

  const changeSpeed = useCallback((speed: number) => {
    setAudioSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, []);

  const loadNextSurah = useCallback(async () => {
    if (!selectedSurah || selectedSurah.number >= 114) return;
    const nextSurahNumber = selectedSurah.number + 1;
    await loadSurahDetail(nextSurahNumber);
    showToast(`Lanjut ke Surah ${nextSurahNumber}`, 'success');
    // Scroll to top
    setTimeout(() => {
      if (contentRef.current) {
        contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 300);
  }, [selectedSurah]);

  const renderVerses = () => {
    if (!selectedSurah) return null;
    const verses = selectedSurah.verses.slice(0, visibleCount);

    return (
      <div className="space-y-4">
        {verses.map((v) => {
          const isCurrentlyPlaying = currentPlayingAyah?.surah === selectedSurah.number && currentPlayingAyah?.ayah === v.number.inSurah;
          return (
          <div
            key={v.number.inSurah}
            id={`ayah-${v.number.inSurah}`}
            className={`rounded-xl border p-4 shadow-sm transition-all duration-300 ${
              isCurrentlyPlaying 
                ? 'border-green-400 bg-green-50/80 dark:bg-green-900/30 ring-2 ring-green-400/50' 
                : 'border-gray-100 dark:border-gray-700 bg-white/70 dark:bg-gray-800/60'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="text-sm font-semibold text-[#1f4f91] dark:text-[#6bc6e5]">{v.number.inSurah}</span>
              <p className="text-right text-2xl md:text-3xl leading-loose text-gray-900 dark:text-white">{v.text.arab}</p>
            </div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 italic">{v.text.transliteration.en}</p>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">{v.translation.id}</p>

            <div className="mt-3 flex justify-between items-center">
              <div className="flex items-center gap-2">
                {isCurrentlyPlaying ? (
                  <>
                    {isPlaying ? (
                      <button
                        onClick={pauseAudio}
                        className="text-xs px-3 py-1 rounded-lg bg-green-500 text-white hover:bg-green-600 flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                        </svg>
                        Jeda
                      </button>
                    ) : (
                      <button
                        onClick={resumeAudio}
                        className="text-xs px-3 py-1 rounded-lg bg-green-500 text-white hover:bg-green-600 flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                        Lanjut
                      </button>
                    )}
                    <button
                      onClick={stopAudio}
                      className="text-xs px-3 py-1 rounded-lg bg-red-500 text-white hover:bg-red-600 flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="6" y="6" width="12" height="12"/>
                      </svg>
                      Stop
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => selectedSurah && playAyah(selectedSurah.number, v.number.inSurah)}
                    disabled={isPlaying && !isCurrentlyPlaying}
                    className="text-xs px-3 py-1 rounded-lg border border-green-500/30 text-green-600 dark:text-green-400 hover:bg-green-500/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                    Putar Audio
                  </button>
                )}
              </div>
              <button
                onClick={() => selectedSurah && saveBookmark(selectedSurah.number, v.number.inSurah)}
                className="text-xs px-3 py-1 rounded-lg border border-[#1f4f91]/30 text-[#1f4f91] dark:text-[#6bc6e5] hover:bg-[#1f4f91]/10 dark:hover:bg-[#1f4f91]/20"
              >
                Tandai terakhir dibaca
              </button>
            </div>
          </div>
        );})}

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

        {/* Next Surah Button - shown when all verses are visible */}
        {visibleCount >= (selectedSurah?.verses.length || 0) && selectedSurah && selectedSurah.number < 114 && (
          <div className="mt-6 p-6 bg-gradient-to-r from-[#2f67b2]/10 to-[#6bc6e5]/10 dark:from-[#2f67b2]/20 dark:to-[#6bc6e5]/20 rounded-xl border-2 border-dashed border-[#2f67b2]/30 dark:border-[#6bc6e5]/30">
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5 text-[#2f67b2] dark:text-[#6bc6e5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Alhamdulillah, Anda telah menyelesaikan surah ini!
                </p>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {surahList.find(s => s.number === selectedSurah.number + 1)?.name.transliteration.id || 'Surah berikutnya'} menanti Anda
              </p>
              <button
                onClick={loadNextSurah}
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-[#2f67b2] to-[#1f4f91] hover:from-[#1f4f91] hover:to-[#2f67b2] rounded-lg shadow-lg transition-all duration-300 hover:scale-105 active:scale-95"
              >
                <span>Lanjut ke Surah {selectedSurah.number + 1}</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* End of Quran message */}
        {selectedSurah && selectedSurah.number === 114 && visibleCount >= (selectedSurah?.verses.length || 0) && (
          <div className="mt-6 p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border-2 border-green-500">
            <div className="text-center space-y-2">
              <div className="text-4xl">🎉</div>
              <p className="text-lg font-bold text-green-700 dark:text-green-300">
                Alhamdulillah, Khatam Al-Qur'an!
              </p>
              <p className="text-sm text-green-600 dark:text-green-400">
                Barakallahu fiik. Semoga Allah menerima bacaan Anda.
              </p>
            </div>
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

            {/* Audio Controls Panel */}
            {selectedSurah && (
              <div className="mb-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-4 border border-green-200 dark:border-green-700">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    </svg>
                    <div>
                      <label className="text-xs font-medium text-green-700 dark:text-green-300 block mb-1">Pilih Qari:</label>
                      <select
                        value={selectedQari}
                        onChange={(e) => setSelectedQari(e.target.value)}
                        className="text-xs px-2 py-1 rounded-lg border border-green-300 dark:border-green-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
                      >
                        {QARI_OPTIONS.map((qari) => (
                          <option key={qari.id} value={qari.id}>{qari.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div>
                      <label className="text-xs font-medium text-green-700 dark:text-green-300 block mb-1">Kecepatan:</label>
                      <div className="flex gap-1">
                        {[0.75, 1, 1.25, 1.5].map((speed) => (
                          <button
                            key={speed}
                            onClick={() => changeSpeed(speed)}
                            className={`text-xs px-2 py-1 rounded-lg transition-colors ${
                              audioSpeed === speed
                                ? 'bg-green-500 text-white'
                                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-green-300 dark:border-green-600 hover:bg-green-100 dark:hover:bg-green-900/30'
                            }`}
                          >
                            {speed}x
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-green-700 dark:text-green-300 flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoPlayNext}
                        onChange={(e) => setAutoPlayNext(e.target.checked)}
                        className="rounded border-green-300 text-green-600 focus:ring-green-500"
                      />
                      Auto-play ayat berikutnya
                    </label>
                  </div>
                  {currentPlayingAyah && (
                    <div className="flex items-center gap-2 bg-white/60 dark:bg-gray-800/60 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-xs text-green-700 dark:text-green-300 font-medium">
                          Memutar Ayat {currentPlayingAyah.ayah}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
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
