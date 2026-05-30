import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { CheckoutForm } from './checkout-form';
import { CheckoutPageChrome } from './checkout-page-chrome';
import { LOCALE_COOKIE, parseLocale } from '@/i18n/config';
import uz from '../../../messages/uz.json';
import ru from '../../../messages/ru.json';

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = cookies();
  const locale = parseLocale(cookieStore.get(LOCALE_COOKIE)?.value);
  const dict = locale === 'ru' ? ru : uz;
  return { title: dict.checkout.metaTitle };
}

export default function CheckoutPage() {
  return (
    <div className="w-full max-w-lg mx-auto px-0 sm:px-4 md:px-6 pb-8">
      <CheckoutPageChrome />
      <CheckoutForm />
    </div>
  );
}
