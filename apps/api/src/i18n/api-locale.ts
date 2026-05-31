export type ApiLocale = 'uz' | 'ru';

export const DEFAULT_API_LOCALE: ApiLocale = 'uz';

export function parseApiLocale(raw: string | undefined | null): ApiLocale {
  if (raw === 'ru' || raw === 'uz') return raw;
  if (raw === 'en') return DEFAULT_API_LOCALE;
  return DEFAULT_API_LOCALE;
}

/** Parse `Accept-Language` — Russian if listed before Uzbek or alone. */
export function parseAcceptLanguage(header: string | undefined): ApiLocale {
  if (!header) return DEFAULT_API_LOCALE;
  const lower = header.toLowerCase();
  const ru = lower.includes('ru');
  const uz = lower.includes('uz');
  if (ru && !uz) return 'ru';
  if (ru && uz) {
    const ruIdx = lower.indexOf('ru');
    const uzIdx = lower.indexOf('uz');
    return ruIdx < uzIdx ? 'ru' : 'uz';
  }
  return DEFAULT_API_LOCALE;
}
