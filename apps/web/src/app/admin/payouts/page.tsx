'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL, formatPrice } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { Banknote, PlusCircle } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/contexts/i18n-context';

type PayoutRow = {
  seller: { id: string; firstName: string; lastName: string; email: string };
  total: number;
  commission: number;
  ordersCount: number;
  totalPaid: number;
  balance: number;
};

export default function AdminPayoutsPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<{ data: PayoutRow[]; total: number } | null>(null);
  const [loadError, setLoadError] = useState('');
  const [recordModal, setRecordModal] = useState<{ open: boolean; row: PayoutRow | null }>({ open: false, row: null });
  const [recordAmount, setRecordAmount] = useState('');
  const [recordMethod, setRecordMethod] = useState<'CASH' | 'CARD'>('CASH');
  const [recordPaidAt, setRecordPaidAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [recordNote, setRecordNote] = useState('');
  const [recordSubmitting, setRecordSubmitting] = useState(false);
  const [recordError, setRecordError] = useState('');
  const { isLoggedIn, isReady } = useAuth();

  const cur = () => t('checkout.currency');

  const fetchPayouts = useCallback(() => {
    if (!isReady || !isLoggedIn) return;
    setLoadError('');
    apiFetch(`${API_URL}/admin/payouts?limit=100`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoadError('');
      })
      .catch(() => {
        setData({ data: [], total: 0 });
        setLoadError(t('admin.common.apiConnectShort'));
      });
  }, [isReady, isLoggedIn, t]);

  useEffect(() => {
    fetchPayouts();
  }, [fetchPayouts]);

  const openRecordModal = (row: PayoutRow) => {
    setRecordModal({ open: true, row });
    setRecordAmount('');
    setRecordMethod('CASH');
    setRecordPaidAt(new Date().toISOString().slice(0, 16));
    setRecordNote('');
    setRecordError('');
  };

  const closeRecordModal = () => {
    setRecordModal({ open: false, row: null });
    setRecordSubmitting(false);
    setRecordError('');
  };

  const submitRecordPayout = () => {
    const row = recordModal.row;
    if (!row || !isLoggedIn) return;
    const amount = parseFloat(recordAmount.replace(/,/g, '.'));
    if (Number.isNaN(amount) || amount <= 0) {
      setRecordError(t('admin.ui.enterAmount'));
      return;
    }
    setRecordSubmitting(true);
    setRecordError('');
    apiFetch(`${API_URL}/admin/payouts/record`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        },
      body: JSON.stringify({
        sellerId: row.seller.id,
        amount,
        method: recordMethod,
        paidAt: recordPaidAt ? new Date(recordPaidAt).toISOString() : undefined,
        note: recordNote || undefined,
      }),
    })
      .then(() => {
        closeRecordModal();
        fetchPayouts();
        toast.success(t('admin.ui.payoutRecorded'));
      })
      .catch(() => {
        setRecordError(t('admin.ui.payoutRecordErr'));
        setRecordSubmitting(false);
        toast.error(t('admin.ui.payoutSaveFailed'));
      });
  };

  if (!isReady || !isLoggedIn) return <DashboardAuthGate />;
  if (!data) return <Skeleton className="h-64 w-full" />;

  const rows = Array.isArray(data?.data) ? data.data : [];

  return (
    <div className="min-w-0 max-w-full space-y-4 sm:space-y-6">
      <DashboardPageHeader
        eyebrow={t('admin.common.platform')}
        title={t('admin.payouts.title')}
        description={t('admin.payouts.description')}
      />
      <div className="max-w-2xl rounded-lg border border-border bg-muted/50 p-4">
        <p className="text-sm font-medium mb-1">{t('admin.payouts.howTitle')}</p>
        <ul className="text-xs sm:text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>{t('admin.payouts.how1')}</li>
          <li>{t('admin.payouts.how2')}</li>
          <li>{t('admin.payouts.how3')}</li>
          <li>{t('admin.payouts.how4')}</li>
        </ul>
      </div>
      {loadError && <p className="text-sm text-destructive">{loadError}</p>}
      <DashboardPanel className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left py-2 px-2 font-medium">{t('admin.payouts.thSeller')}</th>
                <th className="text-right py-2 px-2 font-medium" title={t('admin.payouts.thOrdersTitle')}>
                  {t('admin.ui.orders')}
                </th>
                <th className="text-right py-2 px-2 font-medium" title={t('admin.payouts.thSalesTitle')}>
                  {t('admin.ui.sales')}
                </th>
                <th className="text-right py-2 px-2 font-medium" title={t('admin.payouts.thSellerGetsTitle')}>
                  {t('admin.stats.thSellerGets')}
                </th>
                <th className="text-right py-2 px-2 font-medium" title={t('admin.payouts.thOurCommissionTitle')}>
                  {t('admin.ui.commission')}
                </th>
                <th className="text-right py-2 px-2 font-medium" title={t('admin.payouts.thPaidTitle')}>
                  {t('admin.stats.thPaidToUs')}
                </th>
                <th className="text-right py-2 px-2 font-medium" title={t('admin.payouts.thBalanceTitle')}>
                  {t('admin.ui.balance')}
                </th>
                <th className="text-right py-2 px-2 font-medium w-32" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.seller?.id ?? i} className="border-b hover:bg-muted/50">
                  <td className="py-3 px-2">
                    <p className="font-medium">
                      {row.seller?.firstName} {row.seller?.lastName}
                    </p>
                    <p className="text-muted-foreground text-xs">{row.seller?.email}</p>
                  </td>
                  <td className="py-3 px-2 text-right">{row.ordersCount}</td>
                  <td className="py-3 px-2 text-right">
                    {formatPrice(row.total)} {cur()}
                  </td>
                  <td className="py-3 px-2 text-right">
                    {formatPrice(row.total - row.commission)} {cur()}
                  </td>
                  <td className="py-3 px-2 text-right">
                    {formatPrice(row.commission)} {cur()}
                  </td>
                  <td className="py-3 px-2 text-right">
                    {formatPrice(row.totalPaid)} {cur()}
                  </td>
                  <td className="py-3 px-2 text-right font-medium">
                    {row.balance === 0 ? (
                      <span className="text-muted-foreground">{t('admin.ui.paidStatus')}</span>
                    ) : row.balance < 0 ? (
                      <span className="text-green-600 dark:text-green-400" title={t('admin.payouts.creditTitle')}>
                        +{formatPrice(-row.balance)} {cur()}
                      </span>
                    ) : (
                      <span>
                        {formatPrice(row.balance)} {cur()}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-2 text-right">
                    <Button variant="outline" size="sm" className="min-h-[40px] touch-manipulation" onClick={() => openRecordModal(row)}>
                      <PlusCircle className="h-4 w-4" />
                      {t('admin.ui.recordPayment')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="border-t-2 bg-muted/40 font-medium">
                <tr>
                  <td className="py-3 px-2" colSpan={2}>
                    {t('admin.ui.total')}
                  </td>
                  <td className="py-3 px-2 text-right">
                    {formatPrice(rows.reduce((s, r) => s + r.total, 0))} {cur()}
                  </td>
                  <td className="py-3 px-2 text-right">
                    {formatPrice(rows.reduce((s, r) => s + (r.total - r.commission), 0))} {cur()}
                  </td>
                  <td className="py-3 px-2 text-right">
                    {formatPrice(rows.reduce((s, r) => s + r.commission, 0))} {cur()}
                  </td>
                  <td className="py-3 px-2 text-right">
                    {formatPrice(rows.reduce((s, r) => s + r.totalPaid, 0))} {cur()}
                  </td>
                  <td className="py-3 px-2 text-right">
                    {formatPrice(rows.reduce((s, r) => s + r.balance, 0))} {cur()}
                  </td>
                  <td className="py-3 px-2" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {rows.length === 0 && !loadError && (
          <div className="p-6">
            <DashboardEmptyState icon={Banknote} title={t('admin.payouts.emptyTitle')} description={t('admin.payouts.emptyDescription')} />
          </div>
        )}
      </DashboardPanel>
      {rows.length > 0 && <p className="text-xs text-muted-foreground sm:text-sm">{t('admin.payouts.balanceFootnote')}</p>}

      <Dialog open={recordModal.open} onOpenChange={(open) => !open && closeRecordModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.ui.recordTitle')}</DialogTitle>
            <DialogDescription>
              {recordModal.row &&
                t('admin.payouts.recordDialogBody', {
                  firstName: recordModal.row.seller.firstName,
                  lastName: recordModal.row.seller.lastName,
                })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="record-amount">{t('admin.ui.amountSomLabel')}</Label>
              <Input id="record-amount" type="text" inputMode="decimal" placeholder={t('admin.payouts.amountPlaceholder')} value={recordAmount} onChange={(e) => setRecordAmount(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="record-method">{t('admin.ui.paymentMethod')}</Label>
              <select
                id="record-method"
                className="flex h-10 min-h-[40px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                value={recordMethod}
                onChange={(e) => setRecordMethod(e.target.value as 'CASH' | 'CARD')}
              >
                <option value="CASH">{t('admin.ui.cash')}</option>
                <option value="CARD">{t('admin.ui.card')}</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="record-paidAt">{t('admin.ui.date')}</Label>
              <Input id="record-paidAt" type="datetime-local" value={recordPaidAt} onChange={(e) => setRecordPaidAt(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="record-note">{t('admin.ui.note')}</Label>
              <Input id="record-note" value={recordNote} onChange={(e) => setRecordNote(e.target.value)} placeholder={t('admin.payouts.notePlaceholder')} />
            </div>
            {recordError && <p className="text-sm text-destructive">{recordError}</p>}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="min-h-[40px] touch-manipulation" onClick={closeRecordModal} disabled={recordSubmitting}>
              {t('admin.ui.cancel')}
            </Button>
            <Button className="min-h-[40px] touch-manipulation" onClick={submitRecordPayout} disabled={recordSubmitting}>
              {recordSubmitting ? t('admin.ui.saving') : t('admin.ui.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
