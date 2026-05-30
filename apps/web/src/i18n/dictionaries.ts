import uz from '../../messages/uz.json';
import ru from '../../messages/ru.json';
import type { Locale } from './config';

export const messagesByLocale: Record<Locale, typeof uz> = {
  uz,
  ru,
};

export type Messages = typeof uz;
