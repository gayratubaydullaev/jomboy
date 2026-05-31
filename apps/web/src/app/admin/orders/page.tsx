'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL, formatPrice } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardPanel } from '@/components/dashboard/dashboard-panel';
import { DashboardEmptyState } from '@/components/dashboard/dashboard-empty-state';
import { DashboardAuthGate } from '@/components/dashboard/dashboard-auth-gate';
import { ShoppingBag, Download } from 'lucide-react';
import { useTranslation } from '@/contexts/i18n-context';
import { orderStatusLabel } from '@/lib/order-status-i18n';
import { downloadBlob } from '@/lib/download-blob';

type OrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  deliveryType?: string;
  paymentStatus?: string;
  totalAmount: string;
  createdAt: string;
  buyer?: { firstName?: string; lastName?: string };
  seller?: { firstName?: string };
};

type OrdersResponse =
  | { data: OrderRow[]; total: number; page: number; totalPages: number }
  | { message: string };

const PAGE_SIZE = 20;

function paymentStatusLabel(status: string | undefined, t: (k: string) => string): string {
  if (!status) return '';
  const key = `seller.orders.paymentStatus.${status}`;
  const label = t(key);
  return label === key ? status : label;
}

export default function AdminOrdersPage() {
  const { t, intlLocale } = useTranslation();
  const [data, setData] = useState<OrdersResponse | null>(null);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const { isLoggedIn, isReady } = useAuth();

  useEffect(() => {
    if (!isReady || !isLoggedIn) return;
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    apiFetch(`${API_URL}/admin/orders?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ message: t('admin.common.errorGeneric') }));
  }, [isReady, isLoggedIn, page, t]);

  const exportExcel = async () => {
    if (!isReady || !isLoggedIn || exporting) return;
    setExporting(true);
    try {
      const r = await apiFetch(`${API_URL}/admin/orders/export`);
      if (!r.ok) throw new Error(t('admin.orders.exportExcelError'));
      const blob = await r.blob();
      downloadBlob(blob, `platform-buyurtmalar-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(t('admin.orders.exportExcelOk'));
    } catch {
      toast.error(t('admin.orders.exportExcelError'));
    } finally {
      setExporting(false);
    }
  };

  if (!isReady || !isLoggedIn) return <DashboardAuthGate />;
  if (!data) return <Skeleton className="h-24 w-full" />;

  const orders = 'data' in data ? data.data : [];
  const total = 'total' in data ? data.total : 0;
  const totalPages = 'totalPages' in data ? data.totalPages : 1;
  const currentPage = 'page' in data ? data.page : 1;
  const errorMessage = 'message' in data ? data.message : null;
  const cur = t('checkout.currency');

  return (
    <div className="min-w-0 max-w-full">
      <DashboardPageHeader
        eyebrow={t('admin.common.platform')}
        title={t('admin.orders.title')}
        description={t('admin.orders.description', { total })}
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-[40px] touch-manipulation"
          disabled={exporting}
          onClick={() => void exportExcel()}
        >
          <Download className="h-4 w-4 mr-2" />
          {exporting ? t('admin.orders.exportExcelLoading') : t('admin.orders.exportExcel')}
        </Button>
      </DashboardPageHeader>
      {errorMessage && orders.length === 0 && (
        <p className="mb-4 text-sm text-destructive">{errorMessage}</p>
      )}
      <DashboardPanel className="p-4 sm:p-5 md:p-6">
        {totalPages > 1 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="min-h-[40px] touch-manipulation" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              {t('admin.common.prev')}
            </Button>
            <span className="text-sm text-muted-foreground">{t('admin.common.pageOf', { current: currentPage, total: totalPages })}</span>
            <Button variant="outline" size="sm" className="min-h-[40px] touch-manipulation" disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              {t('admin.common.next')}
            </Button>
          </div>
        )}
        {orders.length === 0 ? (
          <DashboardEmptyState
            icon={ShoppingBag}
            title={t('admin.orders.emptyTitle')}
            description={t('admin.orders.emptyDescription')}
          />
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <Card key={o.id} className="border-border/70 shadow-none">
                <CardContent className="p-4 sm:p-5">
                  <div className="mb-2 flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                    <span className="font-mono text-sm font-medium">{o.orderNumber}</span>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="secondary">{orderStatusLabel(o.status, o.deliveryType, t)}</Badge>
                      {o.paymentStatus && <Badge variant="outline">{paymentStatusLabel(o.paymentStatus, t)}</Badge>}
                    </div>
                    <span className="text-base font-semibold sm:ml-auto">
                      {formatPrice(Number(o.totalAmount))} {cur}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {o.buyer && (
                      <span>
                        {t('admin.orders.buyer')} {o.buyer.firstName} {o.buyer.lastName}
                      </span>
                    )}
                    {o.seller && (
                      <span>
                        {t('admin.orders.seller')} {o.seller.firstName}
                      </span>
                    )}
                    <span>{o.createdAt ? new Date(o.createdAt).toLocaleString(intlLocale) : ''}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DashboardPanel>
    </div>
  );
}
