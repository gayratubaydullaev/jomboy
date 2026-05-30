import type { Metadata } from 'next';
import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { CheckoutSuccessContent } from './checkout-success-content';
import { LOCALE_COOKIE, parseLocale } from '@/i18n/config';
import uz from '../../../../messages/uz.json';
import ru from '../../../../messages/ru.json';

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = cookies();
  const locale = parseLocale(cookieStore.get(LOCALE_COOKIE)?.value);
  const dict = locale === 'ru' ? ru : uz;
  return { title: dict.checkoutSuccess.metaTitle };
}

export default function CheckoutSuccessPage() {
  return (
    <div className="w-full max-w-2xl mx-auto px-0 sm:px-4 md:px-6 py-8">
      <Suspense fallback={<div className="animate-pulse h-24 bg-muted rounded-lg" />}>
        <CheckoutSuccessContent />
      </Suspense>
    </div>
  );
}
