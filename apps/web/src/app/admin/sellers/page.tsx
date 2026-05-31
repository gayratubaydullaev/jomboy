'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL, formatPrice } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { Store, Percent } from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardPanel } from '@/components/dashboard/dashboard-panel';
import { DashboardEmptyState } from '@/components/dashboard/dashboard-empty-state';
import { DashboardAuthGate } from '@/components/dashboard/dashboard-auth-gate';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/contexts/i18n-context';

type Seller = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isBlocked: boolean;
  shop: { id: string; name: string; slug: string; commissionRate?: number | null } | null;
  productsCount: number;
  ordersCount: number;
  totalRevenue: string;
};

export default function AdminSellersPage() {
  const { t } = useTranslation();
  const cur = t('checkout.currency');
  const [data, setData] = useState<{ data: Seller[]; total: number } | null>(null);
  const [loadError, setLoadError] = useState('');
  const [commissionModal, setCommissionModal] = useState<{ open: boolean; seller: Seller | null }>({ open: false, seller: null });
  const [commissionValue, setCommissionValue] = useState('');
  const [commissionSubmitting, setCommissionSubmitting] = useState(false);
  const [commissionError, setCommissionError] = useState('');
  const { isLoggedIn, isReady } = useAuth();

  const fetchSellers = useCallback(() => {
    if (!isReady || !isLoggedIn) return;
    setLoadError('');
    apiFetch(`${API_URL}/admin/sellers?limit=50`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoadError('');
      })
      .catch(() => {
        setData({ data: [], total: 0 });
        setLoadError(t('admin.sellers.loadError'));
      });
  }, [isReady, isLoggedIn, t]);

  useEffect(() => {
    fetchSellers();
  }, [fetchSellers]);

  const openCommissionModal = (seller: Seller) => {
    setCommissionModal({ open: true, seller });
    const rate = seller.shop?.commissionRate;
    setCommissionValue(rate != null && rate !== undefined ? String(rate) : '');
    setCommissionError('');
  };

  const closeCommissionModal = () => {
    setCommissionModal({ open: false, seller: null });
    setCommissionSubmitting(false);
    setCommissionError('');
  };

  const submitCommission = () => {
    const seller = commissionModal.seller;
    if (!seller || !isLoggedIn) return;
    const trimmed = commissionValue.trim();
    const value = trimmed === '' ? null : parseFloat(trimmed.replace(/,/g, '.'));
    if (trimmed !== '' && (value == null || Number.isNaN(value) || value < 0 || value > 100)) {
      setCommissionError(t('admin.ui.commissionPercentHint'));
      return;
    }
    setCommissionSubmitting(true);
    setCommissionError('');
    apiFetch(`${API_URL}/admin/sellers/${seller.id}/commission`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        },
      body: JSON.stringify({ commissionRate: value }),
    })
      .then(() => {
        closeCommissionModal();
        fetchSellers();
        toast.success(t('admin.ui.commissionSaved'));
      })
      .catch(() => {
        setCommissionError(t('admin.ui.commissionSaveErr'));
        setCommissionSubmitting(false);
        toast.error(t('admin.ui.commissionSaveFailed'));
      });
  };

  if (!isReady || !isLoggedIn) return <DashboardAuthGate />;
  if (!data) return <Skeleton className="h-64 w-full" />;

  const sellers = Array.isArray(data?.data) ? data.data : [];

  return (
    <div className="min-w-0 max-w-full space-y-4 sm:space-y-6">
      <DashboardPageHeader eyebrow={t('admin.common.platform')} title={t('admin.sellers.title')} description={t('admin.sellers.description')} />
      {loadError && <p className="text-sm text-destructive">{loadError}</p>}
      <DashboardPanel className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border/80 bg-muted/40">
                <th className="text-left py-2 px-2 font-medium">{t('admin.sellers.thName')}</th>
                <th className="text-left py-2 px-2 font-medium">{t('admin.sellers.thShop')}</th>
                <th className="text-right py-2 px-2 font-medium">{t('admin.sellers.thCommission')}</th>
                <th className="text-right py-2 px-2 font-medium">{t('admin.sellers.thProducts')}</th>
                <th className="text-right py-2 px-2 font-medium">{t('admin.sellers.thOrders')}</th>
                <th className="text-right py-2 px-2 font-medium">{t('admin.sellers.thRevenue')}</th>
                <th className="text-left py-2 px-2 font-medium w-24" />
              </tr>
            </thead>
            <tbody>
              {sellers.map((s) => (
                <tr key={s.id} className="border-b hover:bg-muted/50">
                  <td className="py-3 px-2">
                    <p className="font-medium">
                      {s.firstName} {s.lastName}
                    </p>
                    <p className="text-muted-foreground text-xs">{s.email}</p>
                    {s.isBlocked && <Badge variant="destructive" className="mt-1">{t('admin.common.blocked')}</Badge>}
                  </td>
                  <td className="py-3 px-2">{s.shop ? s.shop.name : t('admin.common.dash')}</td>
                  <td className="py-3 px-2 text-right">{s.shop?.commissionRate != null ? `${Number(s.shop.commissionRate)}%` : t('admin.sellers.platformDefault')}</td>
                  <td className="py-3 px-2 text-right">{s.productsCount}</td>
                  <td className="py-3 px-2 text-right">{s.ordersCount}</td>
                  <td className="py-3 px-2 text-right font-medium">
                    {formatPrice(Number(s.totalRevenue))} {cur}
                  </td>
                  <td className="py-3 px-2">
                    <Button variant="ghost" size="sm" onClick={() => openCommissionModal(s)} className="gap-1" title={t('admin.sellers.editCommissionTitle')}>
                      <Percent className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sellers.length === 0 && !loadError && (
          <div className="p-6">
            <DashboardEmptyState icon={Store} title={t('admin.sellers.emptyTitle')} description={t('admin.sellers.emptyDescription')} />
          </div>
        )}
      </DashboardPanel>

      <Dialog open={commissionModal.open} onOpenChange={(open) => !open && closeCommissionModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.sellers.dialogTitle')}</DialogTitle>
            <DialogDescription>
              {commissionModal.seller && (
                <>{t('admin.sellers.dialogDescription', { firstName: commissionModal.seller.firstName, lastName: commissionModal.seller.lastName })}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="commission-rate">{t('admin.sellers.labelPercent')}</Label>
              <Input
                id="commission-rate"
                type="text"
                inputMode="decimal"
                placeholder={t('admin.sellers.phPlatformDefault')}
                value={commissionValue}
                onChange={(e) => setCommissionValue(e.target.value)}
              />
            </div>
            {commissionError && <p className="text-sm text-destructive">{commissionError}</p>}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="min-h-[40px] touch-manipulation" onClick={closeCommissionModal} disabled={commissionSubmitting}>
              {t('admin.ui.cancel')}
            </Button>
            <Button className="min-h-[40px] touch-manipulation" onClick={submitCommission} disabled={commissionSubmitting}>
              {commissionSubmitting ? t('admin.ui.saving') : t('admin.ui.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
