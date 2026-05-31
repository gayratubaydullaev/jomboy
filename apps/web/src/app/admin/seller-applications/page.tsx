'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardAuthGate } from '@/components/dashboard/dashboard-auth-gate';
import { DashboardPanel } from '@/components/dashboard/dashboard-panel';
import { DashboardEmptyState } from '@/components/dashboard/dashboard-empty-state';
import { FileCheck } from 'lucide-react';
import { useTranslation } from '@/contexts/i18n-context';

type Application = {
  id: string;
  userId: string;
  shopName: string;
  description: string | null;
  message: string | null;
  legalType?: string | null;
  legalName?: string | null;
  ogrn?: string | null;
  inn?: string | null;
  documentUrls?: string[] | null;
  status: string;
  rejectReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  user: { id: string; email: string; firstName: string; lastName: string };
};

type Response = { data: Application[]; total: number; page: number; limit: number; totalPages: number };

function statusLabel(status: string, t: (k: string) => string): string {
  const key = `admin.sellerApplications.status.${status}`;
  const label = t(key);
  return label === key ? status : label;
}

function legalFormLabel(type: string | null | undefined, t: (k: string) => string): string {
  if (type === 'IP') return t('admin.ui.ip');
  if (type === 'OOO') return t('admin.ui.ooo');
  return type ?? '';
}

export default function AdminSellerApplicationsPage() {
  const { t, intlLocale } = useTranslation();
  const [data, setData] = useState<Response | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const { isLoggedIn, isReady } = useAuth();

  const load = useCallback(() => {
    if (!isReady || !isLoggedIn) return;
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    params.set('page', String(page));
    params.set('limit', '20');
    apiFetch(`${API_URL}/admin/seller-applications?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, [isReady, isLoggedIn, statusFilter, page]);

  useEffect(() => {
    if (!isReady || !isLoggedIn) return;
    load();
  }, [isReady, isLoggedIn, load]);

  const approve = (id: string) => {
    if (!isReady || !isLoggedIn) return;
    apiFetch(`${API_URL}/admin/seller-applications/${id}/approve`, { method: 'POST', })
      .then(() => {
        toast.success(t('admin.ui.applicationApproved'));
        load();
      })
      .catch(() => toast.error(t('admin.common.errorGeneric')));
  };

  const reject = (id: string) => {
    const reason = rejectReason[id] ?? '';
    if (!isReady || !isLoggedIn) return;
    apiFetch(`${API_URL}/admin/seller-applications/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason.trim() || undefined }),
    })
      .then(() => {
        toast.success(t('admin.ui.applicationRejected'));
        setRejectReason((r) => ({ ...r, [id]: '' }));
        load();
      })
      .catch(() => toast.error(t('admin.common.errorGeneric')));
  };

  if (!isReady || !isLoggedIn) return <DashboardAuthGate />;
  if (!data) return <Skeleton className="h-64 w-full rounded-xl" />;

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <DashboardPageHeader eyebrow={t('admin.common.platform')} title={t('admin.sellerApplications.title')} description={t('admin.sellerApplications.description')}>
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin">{t('admin.ui.homeLink')}</Link>
        </Button>
      </DashboardPageHeader>
      <div className="flex flex-wrap gap-2">
        <Button variant={statusFilter === '' ? 'default' : 'outline'} size="sm" onClick={() => { setStatusFilter(''); setPage(1); }}>
          {t('admin.ui.all')}
        </Button>
        <Button variant={statusFilter === 'PENDING' ? 'default' : 'outline'} size="sm" onClick={() => { setStatusFilter('PENDING'); setPage(1); }}>
          {t('admin.ui.pending')}
        </Button>
        <Button variant={statusFilter === 'APPROVED' ? 'default' : 'outline'} size="sm" onClick={() => { setStatusFilter('APPROVED'); setPage(1); }}>
          {t('admin.sellerApplications.filterApproved')}
        </Button>
        <Button variant={statusFilter === 'REJECTED' ? 'default' : 'outline'} size="sm" onClick={() => { setStatusFilter('REJECTED'); setPage(1); }}>
          {t('admin.sellerApplications.filterRejected')}
        </Button>
      </div>
      <DashboardPanel className="p-4 sm:p-5 md:p-6">
        <div className="space-y-3">
          {data.data.length === 0 ? (
            <DashboardEmptyState icon={FileCheck} title={t('admin.sellerApplications.emptyTitle')} description={t('admin.sellerApplications.emptyDescription')} />
          ) : (
            data.data.map((app) => (
              <Card key={app.id}>
                <CardContent className="pt-6">
                  <div className="flex flex-wrap justify-between gap-4">
                    <div>
                      <p className="font-semibold">{app.shopName}</p>
                      <p className="text-sm text-muted-foreground">
                        {app.user.firstName} {app.user.lastName} — {app.user.email}
                      </p>
                      {app.description && <p className="text-sm mt-1">{app.description}</p>}
                      {app.message && (
                        <p className="text-sm mt-1 italic">
                          {t('admin.sellerApplications.messagePrefix')} {app.message}
                        </p>
                      )}
                      {(app.legalType || app.legalName || app.ogrn || app.inn) && (
                        <div className="mt-2 rounded bg-muted/60 p-2 text-sm">
                          <p className="font-medium text-foreground">{t('admin.sellerApplications.legalBlockTitle')}</p>
                          {app.legalType && (
                            <p>
                              {t('admin.ui.legalType')}: {legalFormLabel(app.legalType, t)}
                            </p>
                          )}
                          {app.legalName && (
                            <p>
                              {t('admin.ui.fullName')}: {app.legalName}
                            </p>
                          )}
                          {app.ogrn && (
                            <p>
                              {t('admin.ui.ogrn')}: {app.ogrn}
                            </p>
                          )}
                          {app.inn && (
                            <p>
                              {t('admin.ui.inn')}: {app.inn}
                            </p>
                          )}
                          {Array.isArray(app.documentUrls) && app.documentUrls.length > 0 && <p>{t('admin.ui.documentsCount', { count: app.documentUrls.length })}</p>}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">{new Date(app.createdAt).toLocaleString(intlLocale)}</p>
                      <Badge variant={app.status === 'PENDING' ? 'secondary' : app.status === 'APPROVED' ? 'default' : 'destructive'} className="mt-2">
                        {statusLabel(app.status, t)}
                      </Badge>
                      {app.status === 'REJECTED' && app.rejectReason && (
                        <p className="text-sm text-destructive mt-1">
                          {t('admin.sellerApplications.reasonPrefix')} {app.rejectReason}
                        </p>
                      )}
                    </div>
                    {app.status === 'PENDING' && (
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          placeholder={t('admin.ui.rejectPlaceholder')}
                          className="rounded-md border border-input px-3 py-2 text-sm w-48"
                          value={rejectReason[app.id] ?? ''}
                          onChange={(e) => setRejectReason((r) => ({ ...r, [app.id]: e.target.value }))}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => approve(app.id)}>
                            {t('admin.ui.approve')}
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => reject(app.id)}>
                            {t('admin.ui.reject')}
                          </Button>
                        </div>
                      </div>
                    )}
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
