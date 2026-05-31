import uz from '../../messages/uz.json';
import ru from '../../messages/ru.json';
import enPartial from '../../messages/en.json';
import type { Locale } from './config';
import { deepMergeMessages } from './deep-merge';

export const messagesByLocale: Record<Locale, typeof uz> = {
  uz,
  ru,
  en: deepMergeMessages(uz, enPartial as Record<string, unknown>),
};

export type Messages = typeof uz;
