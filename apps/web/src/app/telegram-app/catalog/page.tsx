'use client';

import { Suspense } from 'react';
import { ProductGrid } from '@/app/catalog/product-grid';
import { TwaNav } from '@/components/telegram/twa-nav';
import { useTranslation } from '@/contexts/i18n-context';

export default function TelegramCatalogPage() {
  const { t } = useTranslation();
  return (
    <div className="pb-24 px-3 pt-4 min-h-[100dvh]">
      <h1 className="text-lg font-semibold mb-4">{t('telegramApp.catalog')}</h1>
      <Suspense fallback={<div className="h-40 animate-pulse bg-muted rounded-lg" />}>
        <ProductGrid linkPrefix="/telegram-app" />
      </Suspense>
      <TwaNav />
    </div>
  );
}
