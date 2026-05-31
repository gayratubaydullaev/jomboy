export const LOCALE_COOKIE = 'myshop_locale';

export const SUPPORTED_LOCALES = ['uz', 'ru', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'uz';

export function isLocale(value: string | undefined | null): value is Locale {
  return value === 'uz' || value === 'ru' || value === 'en';
}

export function parseLocale(raw: string | undefined | null): Locale {
  return isLocale(raw) ? raw : DEFAULT_LOCALE;
}

export function htmlLang(locale: Locale): string {
  if (locale === 'ru') return 'ru';
  if (locale === 'en') return 'en';
  return 'uz';
}

/** BCP 47 tag for `Intl` / `toLocaleString` */
export function intlLocaleTag(locale: Locale): string {
  if (locale === 'ru') return 'ru-RU';
  if (locale === 'en') return 'en-US';
  return 'uz-UZ';
}
