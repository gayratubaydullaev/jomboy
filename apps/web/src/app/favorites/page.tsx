'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { ProductCard } from '@/components/product/product-card';
import { API_URL } from '@/lib/utils';
import { apiFetch, apiGetJson } from '@/lib/api';
import { getGuestFavoriteIds, removeGuestFavorite } from '@/lib/guest-favorites';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from '@/contexts/i18n-context';
import { type ApiProduct, apiProductToCardProduct } from '@/types/api';

interface FavItem {
  id: string;
  product: ApiProduct;
}

async function fetchProductOrNull(id: string): Promise<ApiProduct | null> {
  try {
    const r = await apiFetch(`${API_URL}/products/${id}`);
    if (!r.ok) {
      removeGuestFavorite(id);
      return null;
    }
    const p = (await r.json()) as ApiProduct;
    return p?.id ? p : null;
  } catch {
    removeGuestFavorite(id);
    return null;
  }
}

async function loadGuestFavorites(): Promise<FavItem[]> {
  const ids = getGuestFavoriteIds();
  if (ids.length === 0) return [];
  const products = await Promise.all(ids.map((id) => fetchProductOrNull(id)));
  return products.filter((p): p is ApiProduct => p != null).map((p) => ({ id: p.id, product: p }));
}

const FavoritesSkeleton = () => (
  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1 md:gap-4">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="flex flex-col gap-3">
        <Skeleton className="aspect-[4/5] w-full rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-5 w-1/3" />
        </div>
      </div>
    ))}
  </div>
);

export default function FavoritesPage() {
  const { t } = useTranslation();
  const { isLoggedIn, isReady } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [list, setList] = useState<FavItem[] | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !isReady) return;
    if (isLoggedIn) {
      apiGetJson<FavItem[]>(`${API_URL}/favorites`)
        .then(setList)
        .catch(() => setList([]));
    } else {
      loadGuestFavorites().then(setList).catch(() => setList([]));
    }
  }, [mounted, isReady, isLoggedIn]);

  useEffect(() => {
    if (!mounted || isLoggedIn) return;
    const handler = () => {
      loadGuestFavorites().then(setList).catch(() => setList([]));
    };
    window.addEventListener('guest-favorites-changed', handler);
    return () => window.removeEventListener('guest-favorites-changed', handler);
  }, [mounted, isLoggedIn]);

  const removeFromList = (productId: string) => {
    if (isLoggedIn) {
      setList((prev) => (prev ?? []).filter((f) => f.product.id !== productId));
    } else {
      removeGuestFavorite(productId);
      setList((prev) => (prev ?? []).filter((f) => f.product.id !== productId));
    }
  };

  if (!mounted || !isReady || list === null) {
    return <FavoritesSkeleton />;
  }

  return (
    <div className="container mx-auto px-4 py-6 md:py-8">
      <h1 className="text-2xl font-bold mb-6">{t('favorites.title')}</h1>
      {list.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">{t('favorites.empty')}</p>
          {!isLoggedIn && <span>{t('favorites.emptyGuestNote')}</span>}
          <Link href="/catalog" className="text-primary hover:underline block mt-4">
            {t('favorites.goToCatalog')}
          </Link>
        </div>
      ) : (
        <>
          {!isLoggedIn && <p className="text-muted-foreground text-sm mb-4">{t('favorites.guestBanner')}</p>}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1 md:gap-4">
            {list.map(({ product }) => (
              <ProductCard
                key={product.id}
                product={apiProductToCardProduct(product)}
                initialFavorite
                onFavoriteChange={(inFavorites) => {
                  if (!inFavorites) removeFromList(product.id);
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
