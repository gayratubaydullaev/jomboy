'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import { DEFAULT_LOCALE, LOCALE_COOKIE, htmlLang, intlLocaleTag, parseLocale } from '@/i18n/config';
import type { Messages } from '@/i18n/dictionaries';
import { messagesByLocale as dictionaries } from '@/i18n/dictionaries';
import { getMessageString, interpolate } from '@/i18n/resolve';

export type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

type I18nContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: TranslateFn;
  intlLocale: string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function readLocaleCookie(): Locale | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`));
  if (!match?.[1]) return null;
  const raw = decodeURIComponent(match[1]);
  return isLocale(raw) ? raw : null;
}

function isLocale(value: string): value is Locale {
  return value === 'uz' || value === 'ru';
}

function setLocaleCookie(next: Locale) {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=${maxAge};SameSite=Lax`;
}

function translateFrom(
  dict: Messages,
  fallback: Messages,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const raw = getMessageString(dict as unknown as Record<string, unknown>, key);
  const fb = getMessageString(fallback as unknown as Record<string, unknown>, key);
  const template = raw ?? fb ?? key;
  return interpolate(template, vars);
}

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale: Locale;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(() => parseLocale(initialLocale));

  useEffect(() => {
    const fromCookie = readLocaleCookie();
    if (fromCookie) {
      setLocaleState(fromCookie);
      document.documentElement.lang = htmlLang(fromCookie);
    }
  }, []);

  const fallback = dictionaries[DEFAULT_LOCALE];

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const dict = dictionaries[locale] ?? fallback;
      return translateFrom(dict, fallback, key, vars);
    },
    [locale, fallback],
  );

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next);
      setLocaleCookie(next);
      document.documentElement.lang = htmlLang(next);
      router.refresh();
    },
    [router],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      intlLocale: intlLocaleTag(locale),
    }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

/** Shorthand for `useI18n().t` */
export function useTranslation(): { t: TranslateFn; locale: Locale; intlLocale: string; setLocale: (l: Locale) => void } {
  const { t, locale, intlLocale, setLocale } = useI18n();
  return { t, locale, intlLocale, setLocale };
}
