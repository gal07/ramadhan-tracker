'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CalendarPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect ke dashboard karena kalender sudah dipindahkan ke sana
    router.replace('/dashboard');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-lg">Mengalihkan ke Dashboard...</div>
    </div>
  );
}

