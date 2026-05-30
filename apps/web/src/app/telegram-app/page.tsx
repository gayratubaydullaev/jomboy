'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TelegramAppHubPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/telegram-app/catalog');
  }, [router]);
  return <div className="min-h-[100dvh] flex items-center justify-center animate-pulse text-muted-foreground">...</div>;
}
