import { AsyncLocalStorage } from 'async_hooks';
import type { ApiLocale } from './api-locale';
import { DEFAULT_API_LOCALE } from './api-locale';

export const apiLocaleStorage = new AsyncLocalStorage<ApiLocale>();

export function getApiLocale(): ApiLocale {
  return apiLocaleStorage.getStore() ?? DEFAULT_API_LOCALE;
}

export function runWithApiLocale<T>(locale: ApiLocale, fn: () => T): T {
  return apiLocaleStorage.run(locale, fn);
}
