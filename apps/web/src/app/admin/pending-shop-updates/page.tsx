'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardAuthGate } from '@/components/dashboard/dashboard-auth-gate';
import { DashboardPanel } from '@/components/dashboard/dashboard-panel';
import { DashboardEmptyState } from '@/components/dashboard/dashboard-empty-state';
import { FileEdit } from 'lucide-react';
import { useTranslation } from '@/contexts/i18n-context';

type PendingUpdate = {
  id: string;
  shopId: string;
  requestedName: string;
  requestedSlug: string;
  requestedDescription: string | null;
  requestedLegalType?: string | null;
  requestedLegalName?: string | null;
  requestedOgrn?: string | null;
  requestedInn?: string | null;
  requestedDocumentUrls?: string[] | null;
  status: string;
  createdAt: string;
  shop: {
    id: string;
    name: string;
    slug: string;
    userId: string;
    user: { email: string; firstName: string; lastName: string };
  };
};

type Response = { data: PendingUpdate[]; total: number; page: number; limit: number; totalPages: number };

function legalFormLabel(type: string | null | undefined, t: (k: string) => string): string {
  if (type === 'IP') return t('admin.ui.ip');
  if (type === 'OOO') return t('admin.ui.ooo');
  return type ?? '';
}

export default function AdminPendingShopUpdatesPage() {
  const { t, intlLocale } = useTranslation();
  const [data, setData] = useState<Response | null>(null);
  const [page, setPage] = useState(1);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const load = useCallback(() => {
    if (!token) return;
    fetch(`${API_URL}/admin/pending-shop-updates?page=${page}&limit=20`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, [token, page]);

  useEffect(() => {
    if (!token) return;
    load();
  }, [token, load]);

  const approve = (id: string) => {
    if (!token) return;
    apiFetch(`${API_URL}/admin/pending-shop-updates/${id}/approve`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      .then(() => {
        toast.success(t('admin.ui.approveChanges'));
        load();
      })
      .catch(() => toast.error(t('admin.common.errorGeneric')));
  };

  const reject = (id: string) => {
    if (!token) return;
    apiFetch(`${API_URL}/admin/pending-shop-updates/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    })
      .then(() => {
        toast.success(t('admin.ui.rejectRequest'));
        load();
      })
      .catch(() => toast.error(t('admin.common.errorGeneric')));
  };

  if (!token) return <DashboardAuthGate />;
  if (!data) return <Skeleton className="h-64 w-full rounded-xl" />;

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <DashboardPageHeader eyebrow={t('admin.common.platform')} title={t('admin.pendingShopUpdates.title')} description={t('admin.pendingShopUpdates.description')}>
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin">{t('admin.pendingShopUpdates.backHome')}</Link>
        </Button>
      </DashboardPageHeader>
      <DashboardPanel className="p-4 sm:p-5 md:p-6">
        <div className="space-y-3">
          {data.data.length === 0 ? (
            <DashboardEmptyState icon={FileEdit} title={t('admin.pendingShopUpdates.emptyTitle')} description={t('admin.pendingShopUpdates.emptyDescription')} />
          ) : (
            data.data.map((row) => (
              <Card key={row.id}>
                <CardContent className="pt-6">
                  <div className="flex flex-wrap justify-between gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {t('admin.ui.sellerLine', { firstName: row.shop.user.firstName, lastName: row.shop.user.lastName, email: row.shop.user.email })}
                      </p>
                      <p className="font-medium mt-1">{t('admin.ui.shopNow', { name: row.shop.name, slug: row.shop.slug })}</p>
                      <p className="text-sm mt-1 text-primary">{t('admin.ui.shopRequested', { name: row.requestedName, slug: row.requestedSlug })}</p>
                      {row.requestedDescription != null && <p className="text-sm mt-1">{t('admin.ui.descriptionLine', { text: row.requestedDescription })}</p>}
                      {(row.requestedLegalType || row.requestedLegalName || row.requestedOgrn || row.requestedInn) && (
                        <div className="mt-2 rounded bg-muted/60 p-2 text-sm">
                          <p className="font-medium text-foreground">{t('admin.sellerApplications.legalBlockTitle')}</p>
                          {row.requestedLegalType && (
                            <p>
                              {t('admin.ui.legalType')}: {legalFormLabel(row.requestedLegalType, t)}
                            </p>
                          )}
                          {row.requestedLegalName && (
                            <p>
                              {t('admin.ui.fullName')}: {row.requestedLegalName}
                            </p>
                          )}
                          {row.requestedOgrn && (
                            <p>
                              {t('admin.ui.ogrn')}: {row.requestedOgrn}
                            </p>
                          )}
                          {row.requestedInn && (
                            <p>
                              {t('admin.ui.inn')}: {row.requestedInn}
                            </p>
                          )}
                          {Array.isArray(row.requestedDocumentUrls) && row.requestedDocumentUrls.length > 0 && (
                            <p>{t('admin.ui.documentsCount', { count: row.requestedDocumentUrls.length })}</p>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">{new Date(row.createdAt).toLocaleString(intlLocale)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => approve(row.id)}>
                        {t('admin.ui.approve')}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => reject(row.id)}>
                        {t('admin.ui.reject')}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
        {data.totalPages > 1 && (
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              {t('admin.common.prev')}
            </Button>
            <span className="py-2 text-sm text-muted-foreground">{t('admin.common.pageSlash', { current: page, total: data.totalPages })}</span>
            <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
              {t('admin.common.next')}
            </Button>
          </div>
        )}
      </DashboardPanel>
    </div>
  );
}
