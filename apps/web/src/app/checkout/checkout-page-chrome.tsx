'use client';

import Link from 'next/link';
import { useTranslation } from '@/contexts/i18n-context';

export function CheckoutPageChrome() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-3 md:gap-4 mb-6">
      <Link href="/cart" className="text-muted-foreground hover:text-foreground">
        {t('checkout.backToCart')}
      </Link>
      <h1 className="text-xl sm:text-2xl font-bold">{t('checkout.title')}</h1>
    </div>
  );
}
