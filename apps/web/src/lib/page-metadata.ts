import type { Metadata } from 'next';
import { DEFAULT_LOCALE } from '@/i18n/config';
import { getMessagesForLocale } from '@/i18n/server-locale';
import { buildPageMetadata } from '@/lib/metadata';

/** Static-friendly metadata using default locale (client I18nProvider handles user locale). */
export function metadataFromKeys(titleKey: string, descriptionKey?: string): Metadata {
  const dict = getMessagesForLocale(DEFAULT_LOCALE) as unknown as Record<string, unknown>;
  return buildPageMetadata(dict, titleKey, descriptionKey);
}
