export const LOCALE_COOKIE = 'myshop_locale';

export const SUPPORTED_LOCALES = ['uz', 'ru'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'uz';

export function isLocale(value: string | undefined | null): value is Locale {
  return value === 'uz' || value === 'ru';
}

export function parseLocale(raw: string | undefined | null): Locale {
  return isLocale(raw) ? raw : DEFAULT_LOCALE;
}

/** `lang` on `<html>` */
export function htmlLang(locale: Locale): string {
  return locale === 'ru' ? 'ru' : 'uz';
}

/** BCP 47 tag for `Intl` / `toLocaleString` */
export function intlLocaleTag(locale: Locale): string {
  return locale === 'ru' ? 'ru-RU' : 'uz-UZ';
}
