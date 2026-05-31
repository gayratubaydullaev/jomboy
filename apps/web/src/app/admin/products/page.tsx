'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL, formatPrice } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { Package, Check, X } from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardPanel } from '@/components/dashboard/dashboard-panel';
import { DashboardEmptyState } from '@/components/dashboard/dashboard-empty-state';
import { DashboardAuthGate } from '@/components/dashboard/dashboard-auth-gate';
import { useTranslation } from '@/contexts/i18n-context';

type Product = {
  id: string;
  title: string;
  price: string;
  isModerated: boolean;
  images: { url: string }[];
  category: { name: string };
  shop: { name: string };
};

export default function AdminProductsPage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const [data, setData] = useState<{ data: Product[]; total: number; page: number; totalPages: number } | null>(null);
  const [filter, setFilter] = useState<'false' | 'true' | ''>('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const { isLoggedIn, isReady } = useAuth();
  const cur = t('checkout.currency');

  useEffect(() => {
    if (searchParams.get('filter') === 'pending') setFilter('false');
  }, [searchParams]);

  const load = useCallback(() => {
    if (!isReady || !isLoggedIn) return;
    setLoadError('');
    const q = filter ? `?page=1&limit=50&isModerated=${filter}` : '?page=1&limit=50';
    apiFetch(`${API_URL}/admin/products${q}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoadError('');
      })
      .catch(() => {
        setData({ data: [], total: 0, page: 1, totalPages: 0 });
        setLoadError(t('admin.common.apiConnectError'));
      });
  }, [isReady, isLoggedIn, filter, t]);

  useEffect(() => {
    load();
  }, [load]);

  const moderate = (productId: string, approve: boolean) => {
    if (!isReady || !isLoggedIn) return;
    setLoading(true);
    apiFetch(`${API_URL}/admin/products/${productId}/moderate`, {
      method: 'POST',
      body: JSON.stringify({ approve }),
    })
      .then(() => {
        toast.success(approve ? t('admin.ui.productApproved') : t('admin.ui.productRejected'));
        load();
      })
      .catch(() => toast.error(t('admin.common.actionFailed')))
      .finally(() => setLoading(false));
  };

  if (!isReady || !isLoggedIn) return <DashboardAuthGate />;
  if (data === null) return <Skeleton className="h-64 w-full" />;

  const products = data.data ?? [];

  return (
    <div className="min-w-0 max-w-full space-y-6">
      {loadError && <p className="text-sm text-destructive">{loadError}</p>}
      <DashboardPageHeader eyebrow={t('admin.common.platform')} title={t('admin.products.title')} description={t('admin.products.description')}>
        <div className="flex flex-wrap gap-2">
          <Button variant={filter === '' ? 'default' : 'outline'} size="sm" className="min-h-[40px] touch-manipulation" onClick={() => setFilter('')}>
            {t('admin.ui.all')}
          </Button>
          <Button variant={filter === 'false' ? 'default' : 'outline'} size="sm" className="min-h-[40px] touch-manipulation" onClick={() => setFilter('false')}>
            {t('admin.ui.pending')}
          </Button>
          <Button variant={filter === 'true' ? 'default' : 'outline'} size="sm" className="min-h-[40px] touch-manipulation" onClick={() => setFilter('true')}>
            {t('admin.ui.approved')}
          </Button>
        </div>
      </DashboardPageHeader>

      <DashboardPanel>
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Package className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            {t('admin.products.listTitle', { total: data.total })}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          {products.length === 0 ? (
            <DashboardEmptyState icon={Package} title={t('admin.products.emptyTitle')} description={t('admin.products.emptyDescription')} />
          ) : (
            <ul className="space-y-3">
              {products.map((p) => (
                <li key={p.id} className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border bg-card">
                  <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-muted shrink-0">
                    {p.images?.[0] ? (
                      <Image src={p.images[0].url} alt={p.title ?? ''} fill className="object-cover" sizes="56px" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">{t('admin.products.noImage')}</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{p.title}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {p.shop?.name} · {p.category?.name}
                    </p>
                    <p className="text-sm font-medium">
                      {formatPrice(Number(p.price))} {cur}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {p.isModerated ? (
                      <span className="text-sm text-green-600 font-medium">{t('admin.products.moderated')}</span>
                    ) : (
                      <>
                        <Button size="sm" className="min-h-[40px] touch-manipulation text-green-600" onClick={() => moderate(p.id, true)} disabled={loading}>
                          <Check className="h-4 w-4 mr-1" /> {t('admin.ui.approve')}
                        </Button>
                        <Button size="sm" variant="outline" className="min-h-[40px] touch-manipulation" onClick={() => moderate(p.id, false)} disabled={loading}>
                          <X className="h-4 w-4 mr-1" /> {t('admin.ui.reject')}
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" className="min-h-[40px] touch-manipulation" asChild>
                      <Link href={`/product/${p.id}`} target="_blank">
                        {t('admin.ui.view')}
                      </Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </DashboardPanel>
    </div>
  );
}
