'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ChevronLeft, QrCode, Scan, Users, X, Share2, Copy, Trash2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import QRScanner from '@/app/components/QRScanner';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp, query, orderBy, getDoc } from 'firebase/firestore';

interface Friend {
    id: string; // Document ID (usually email)
    email: string;
    name?: string; // Optional if we can fetch it, otherwise fallback
    addedAt?: any;
}

export default function FriendsPage() {
    const router = useRouter();
    const { data: session } = useSession();
    const [activeTab, setActiveTab] = useState<'list' | 'scan' | 'my-qr'>('my-qr');
    const [showQRScanner, setShowQRScanner] = useState(false);
    const [friends, setFriends] = useState<Friend[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

    const userEmail = session?.user?.email || '';

    // Load friends from Firestore
    useEffect(() => {
        if (!userEmail) return;

        setLoading(true);
        const friendsRef = collection(db, 'users', userEmail, 'friends');
        const q = query(friendsRef, orderBy('addedAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Friend[];
            setFriends(items);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching friends:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userEmail]);

    const handleScanSuccess = async (decodedText: string) => {
        setShowQRScanner(false);

        // Simple validation (check if email-like)
        if (!decodedText.includes('@')) {
            alert('QR Code tidak valid. Pastikan yang discan adalah QR Email teman.');
            return;
        }

        if (decodedText === userEmail) {
            alert('Anda tidak bisa menambahkan diri sendiri.');
            return;
        }

        const confirmAdd = window.confirm(`Tambahkan ${decodedText} sebagai teman?`);
        if (!confirmAdd) return;

        setProcessing(true);
        try {
            // 1. Add Friend to Current User's list
            await setDoc(doc(db, 'users', userEmail, 'friends', decodedText), {
                email: decodedText,
                name: decodedText.split('@')[0],
                addedAt: serverTimestamp(),
            });

            // 2. Add Current User to Friend's list (Mutual)
            await setDoc(doc(db, 'users', decodedText, 'friends', userEmail), {
                email: userEmail,
                name: session?.user?.name || userEmail.split('@')[0],
                addedAt: serverTimestamp(),
            });

            alert(`Berhasil menambahkan ${decodedText} dan Anda juga ditambahkan ke daftar teman mereka!`);
            setActiveTab('list');
        } catch (error) {
            console.error('Error adding friend:', error);
            alert('Gagal menambahkan teman. Coba lagi.');
        } finally {
            setProcessing(false);
        }
    };

    const handleDeleteFriend = async (friendEmail: string) => {
        if (!confirm(`Hapus ${friendEmail} dari teman?`)) return;

        try {
            await deleteDoc(doc(db, 'users', userEmail, 'friends', friendEmail));
        } catch (error) {
            console.error('Error deleting friend:', error);
            alert('Gagal menghapus teman.');
        }
    };

    const handleCopyEmail = () => {
        if (userEmail) {
            navigator.clipboard.writeText(userEmail);
            alert('Email berhasil disalin!');
        }
    };

    return (
        <div className="min-h-screen bg-linear-to-br from-[#eff6ff] via-[#eeddf7] to-[#e4f5fc] dark:from-gray-900 dark:to-gray-800 flex flex-col">
            <div className="absolute top-0 left-0 w-full h-64 bg-linear-to-b from-[#2f67b2]/10 to-transparent pointer-events-none" />

            {/* Header */}
            <div className="bg-transparent p-6 flex items-center gap-3 relative z-10">
                <button
                    onClick={() => router.back()}
                    className="p-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-full shadow-xs hover:bg-white dark:hover:bg-gray-700 transition-colors"
                >
                    <ChevronLeft className="w-6 h-6 text-[#2f67b2] dark:text-[#6bc6e5]" />
                </button>
                <h1 className="text-xl font-bold text-gray-800 dark:text-white">Teman Ibadah</h1>
            </div>

            <div className="flex-1 flex flex-col p-6 relative z-10 max-w-md mx-auto w-full">

                {/* Navigation Tabs */}
                <div className="flex p-1 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl mb-6 shadow-sm">
                    <button
                        onClick={() => setActiveTab('my-qr')}
                        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'my-qr' ? 'bg-white dark:bg-gray-700 text-[#2f67b2] dark:text-[#6bc6e5] shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                            }`}
                    >
                        QR Saya
                    </button>
                    <button
                        onClick={() => setActiveTab('scan')}
                        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'scan' ? 'bg-white dark:bg-gray-700 text-[#2f67b2] dark:text-[#6bc6e5] shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                            }`}
                    >
                        Scan
                    </button>
                    <button
                        onClick={() => setActiveTab('list')}
                        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'list' ? 'bg-white dark:bg-gray-700 text-[#2f67b2] dark:text-[#6bc6e5] shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                            }`}
                    >
                        Daftar Teman
                    </button>
                </div>

                {/* Content */}
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 dark:border-gray-700 overflow-hidden flex-1 relative">

                    {/* My QR Tab */}
                    {activeTab === 'my-qr' && (
                        <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="mb-6 relative">
                                <div className="absolute -inset-4 bg-linear-to-br from-[#2f67b2]/20 to-[#6bc6e5]/20 rounded-full blur-xl animate-pulse"></div>
                                <div className="relative p-6 bg-white rounded-3xl shadow-lg border border-gray-100">
                                    {userEmail ? (
                                        <QRCodeSVG
                                            value={userEmail}
                                            size={200}
                                            level="H"
                                            includeMargin={true}
                                            className="rounded-lg"
                                        />
                                    ) : (
                                        <div className="w-[200px] h-[200px] bg-gray-200 rounded-lg flex items-center justify-center text-gray-400">
                                            Login Required
                                        </div>
                                    )}
                                </div>
                            </div>

                            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-1">
                                {session?.user?.name || 'Pengguna'}
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 flex items-center gap-2 justify-center">
                                {userEmail || 'email@example.com'}
                                <button onClick={handleCopyEmail} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors text-gray-400 hover:text-gray-600">
                                    <Copy className="w-3 h-3" />
                                </button>
                            </p>

                            <div className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-900/50 px-4 py-2 rounded-full">
                                Minta teman scan kode ini untuk berteman
                            </div>
                        </div>
                    )}

                    {/* Scan Tab */}
                    {activeTab === 'scan' && (
                        <div className="h-full flex flex-col p-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="flex-1 flex flex-col items-center justify-center text-center">
                                {!showQRScanner ? (
                                    <div className="space-y-6">
                                        <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Scan className="w-10 h-10 text-gray-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                                Scan QR Teman
                                            </h3>
                                            <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs mx-auto">
                                                Scan QR code yang ditampilkan di HP teman Anda untuk menambahkannya.
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setShowQRScanner(true)}
                                            className="px-8 py-3 bg-linear-to-r from-[#2f67b2] to-[#6bc6e5] text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                                        >
                                            Buka Kamera
                                        </button>
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex flex-col">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="font-semibold text-gray-900 dark:text-white">Scanning...</h3>
                                            <button onClick={() => setShowQRScanner(false)} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="flex-1 bg-black rounded-2xl overflow-hidden relative">
                                            <QRScanner onScanSuccess={handleScanSuccess} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Friend List Tab */}
                    {activeTab === 'list' && (
                        <div className="h-full flex flex-col p-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 px-2">
                                Daftar Teman ({friends.length})
                            </h3>

                            <div className="overflow-y-auto flex-1 space-y-3 px-2 pb-4 scrollbar-hide">
                                {loading && <p className="text-center text-gray-500">Memuat...</p>}

                                {!loading && friends.map(friend => (
                                    <div
                                        key={friend.id}
                                        onClick={() => router.push(`/friends/${encodeURIComponent(friend.email)}`)}
                                        className="flex items-center gap-3 p-3 bg-white dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm group cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-linear-to-br from-[#2f67b2] to-[#6bc6e5] flex items-center justify-center text-white font-bold">
                                            {friend.name?.charAt(0).toUpperCase() || '?'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">{friend.name || friend.email}</h4>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{friend.email}</p>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteFriend(friend.id);
                                            }}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}

                                {!loading && friends.length === 0 && (
                                    <div className="text-center py-10">
                                        <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                        <p className="text-gray-500 dark:text-gray-400">Belum ada teman.</p>
                                        <button
                                            onClick={() => setActiveTab('scan')}
                                            className="text-[#2f67b2] dark:text-[#6bc6e5] text-sm font-medium mt-2 hover:underline"
                                        >
                                            Tambah Teman
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
