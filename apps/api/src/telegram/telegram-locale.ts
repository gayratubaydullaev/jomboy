export type TelegramLocale = 'uz' | 'ru';

const chatLocale = new Map<string, TelegramLocale>();
/** Язык, выбранный вручную через /lang — не перезаписывается language_code Telegram. */
const manualLocale = new Map<string, TelegramLocale>();

/** Telegram `language_code`: ru, ru-RU → ru; everything else → uz */
export function parseTelegramLanguageCode(code?: string | null): TelegramLocale {
  const c = (code ?? '').toLowerCase().trim();
  if (c === 'ru' || c.startsWith('ru-')) return 'ru';
  return 'uz';
}

export function setTelegramLocaleForChat(chatId: string, locale: TelegramLocale): void {
  const sid = String(chatId);
  chatLocale.set(sid, locale);
  manualLocale.set(sid, locale);
}

export function rememberTelegramLocale(chatId: string, languageCode?: string | null): TelegramLocale {
  const sid = String(chatId);
  if (manualLocale.has(sid)) return manualLocale.get(sid)!;
  const loc = parseTelegramLanguageCode(languageCode);
  chatLocale.set(sid, loc);
  return loc;
}

export function getTelegramLocaleForChat(chatId: string): TelegramLocale {
  return chatLocale.get(String(chatId)) ?? 'uz';
}

export function intlTagForTelegram(locale: TelegramLocale): string {
  return locale === 'ru' ? 'ru-RU' : 'uz-UZ';
}
