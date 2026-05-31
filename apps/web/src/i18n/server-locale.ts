import { cookies } from 'next/headers';
import uz from '../../messages/uz.json';
import ru from '../../messages/ru.json';
import enPartial from '../../messages/en.json';
import { LOCALE_COOKIE, parseLocale, type Locale } from './config';
import { getMessageString, interpolate } from './resolve';
import { deepMergeMessages } from './deep-merge';

const enMessages = deepMergeMessages(uz, enPartial as Record<string, unknown>);

export function getMessagesForLocale(locale: Locale): typeof uz {
  if (locale === 'ru') return ru;
  if (locale === 'en') return enMessages;
  return uz;
}

export function getServerLocale(): Locale {
  const cookieStore = cookies();
  return parseLocale(cookieStore.get(LOCALE_COOKIE)?.value);
}

/** Server-side translation using the same keys as the client `t()`. */
export function serverT(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const dict = getMessagesForLocale(locale) as unknown as Record<string, unknown>;
  const fallback = uz as unknown as Record<string, unknown>;
  const raw = getMessageString(dict, key);
  const fb = getMessageString(fallback, key);
  const template = raw ?? fb ?? key;
  return interpolate(template, vars);
}
