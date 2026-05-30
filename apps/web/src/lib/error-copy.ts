import uz from '../../messages/uz.json';
import ru from '../../messages/ru.json';
import { LOCALE_COOKIE, parseLocale, type Locale } from '@/i18n/config';

type ErrorMessages = {
  title: string;
  tryAgain: string;
  checkoutTitle?: string;
  catalogTitle?: string;
  productTitle?: string;
  accountTitle?: string;
  adminTitle?: string;
  sellerTitle?: string;
};

function getLocaleFromCookie(): Locale {
  if (typeof document === 'undefined') return 'uz';
  const match = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${LOCALE_COOKIE}=`));
  const value = match?.slice(LOCALE_COOKIE.length + 1);
  return parseLocale(decodeURIComponent(value ?? ''));
}

export function getErrorMessages(locale?: Locale): ErrorMessages {
  const loc = locale ?? getLocaleFromCookie();
  const dict = (loc === 'ru' ? ru : uz) as { errors: ErrorMessages };
  return dict.errors;
}
