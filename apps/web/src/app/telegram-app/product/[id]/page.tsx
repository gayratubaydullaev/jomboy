'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { API_URL } from '@/lib/utils';
import { swrFetcher } from '@/lib/swr-fetcher';
import { ProductCard } from '@/components/product/product-card';
import { type ApiProduct, apiProductToCardProduct } from '@/types/api';
import { TwaNav } from '@/components/telegram/twa-nav';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/contexts/i18n-context';

export default function TelegramProductPage() {
  const { t } = useTranslation();
  const params = useParams();
  const id = String(params.id ?? '');
  const { data, isLoading } = useSWR<ApiProduct>(id ? `${API_URL}/products/${id}` : null, swrFetcher);

  if (isLoading) {
    return <div className="p-4 pb-24 animate-pulse h-64 bg-muted rounded-lg" />;
  }
  if (!data) {
    return (
      <div className="p-4 pb-24 text-center">
        <p>{t('admin.common.notFound')}</p>
        <Button asChild className="mt-4">
          <Link href="/telegram-app/catalog">{t('telegramApp.catalog')}</Link>
        </Button>
      </div>
    );
  }

  const product = apiProductToCardProduct(data);

  return (
    <div className="p-4 pb-24 space-y-4">
      <ProductCard product={product} linkPrefix="/telegram-app" />
      <Button asChild className="w-full">
        <Link href="/telegram-app/cart">{t('nav.cart')}</Link>
      </Button>
      <TwaNav />
    </div>
  );
}
