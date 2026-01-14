'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import StatisticsSection from '@/app/dashboard/StatisticsSection';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface PageProps {
    params: Promise<{ email: string }>;
}

export default function FriendStatisticsPage({ params }: PageProps) {
    const router = useRouter();
    const [decodedEmail, setDecodedEmail] = useState<string>('');
    const [friendName, setFriendName] = useState<string>('');

    // Unwrap params using React.use() or await (Next.js 15+)
    // For safety in client component we can use useEffect to unwrap/decode
    useEffect(() => {
        params.then((resolvedParams) => {
            const email = decodeURIComponent(resolvedParams.email);
            setDecodedEmail(email);

            // Fetch friend name if available (optional enhancement)
            // Since we don't have a central "users" profile collection always populated with names,
            // we might just use the email or try to fetch from where we can.
            // For now, let's just use the email prefix or "Teman"
            setFriendName(email.split('@')[0]);
        });
    }, [params]);

    if (!decodedEmail) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="h-4 w-32 bg-gray-200 rounded mb-2"></div>
                    <div className="h-4 w-24 bg-gray-200 rounded"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 sticky top-0 z-30 shadow-sm px-4 py-4 md:px-6 flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                >
                    <ChevronLeft className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                </button>
                <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                        Statistik Teman
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Progress ibadah {friendName}
                    </p>
                </div>
            </div>

            <div className="p-4 md:p-6">
                <StatisticsSection userEmail={decodedEmail} />
            </div>
        </div>
    );
}
