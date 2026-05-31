'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/contexts/i18n-context';

export function OfflineBanner() {
  const { t } = useTranslation();
  const [online, setOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sync = () => {
      const ok = navigator.onLine;
      setOnline(ok);
      if (!ok) setWasOffline(true);
    };
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  if (online && !wasOffline) return null;

  const message = online ? t('offline.backOnline') : t('offline.banner');

  return (
    <div
      role="status"
      className={`text-center text-sm px-3 py-2 border-b ${
        online ? 'bg-emerald-600/90 text-white border-emerald-700' : 'bg-amber-500/95 text-amber-950 border-amber-600'
      }`}
    >
      {message}
    </div>
  );
}
