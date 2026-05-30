'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { API_URL } from '@/lib/utils';
import { DEFAULT_SITE_NAME } from '@/lib/site-name';

function normalizeSiteName(value?: string | null): string | null {
  const name = value?.trim();
  if (!name || name.includes('{{')) return null;
  return name;
}

type PublicSettings = { siteName: string };

const PublicSettingsContext = createContext<PublicSettings>({ siteName: DEFAULT_SITE_NAME });

export function PublicSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<PublicSettings>({ siteName: DEFAULT_SITE_NAME });

  useEffect(() => {
    if (!API_URL) return;
    fetch(`${API_URL}/settings/public`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((data: { siteName?: string } | null) => {
        const name = normalizeSiteName(data?.siteName);
        if (name) setSettings({ siteName: name });
      })
      .catch(() => {});
  }, []);

  return (
    <PublicSettingsContext.Provider value={settings}>
      {children}
    </PublicSettingsContext.Provider>
  );
}

export function usePublicSettings(): PublicSettings {
  return useContext(PublicSettingsContext);
}
