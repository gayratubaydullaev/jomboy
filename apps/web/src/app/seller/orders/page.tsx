'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL, formatPrice } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardPanel } from '@/components/dashboard/dashboard-panel';
import { DashboardEmptyState } from '@/components/dashboard/dashboard-empty-state';
import { DashboardAuthGate } from '@/components/dashboard/dashboard-auth-gate';
import { ShoppingBag } from 'lucide-react';
import { useTranslation, type TranslateFn } from '@/contexts/i18n-context';
import { orderStatusLabel } from '@/lib/order-status-i18n';

type ShippingAddr = { city?: string; district?: string; street?: string; house?: string; phone?: string; firstName?: string; lastName?: string };
type OrderItemRow = {
  quantity: number;
  price: string;
  product: {
    id: string;
    title: string;
    price: string;
    sku?: string | null;
    unit?: string | null;
    stock?: number;
    options?: unknown;
    specs?: unknown;
  };
  variant?: {
    id?: string;
    options?: Record<string, string> | unknown;
    sku?: string | null;
    stock?: number;
    priceOverride?: string | null;
  } | null;
};
type OrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus?: string;
  paymentMethod?: string;
  deliveryType?: string;
  totalAmount: string;
  createdAt: string;
  buyer: { firstName: string; lastName: string; email?: string; phone?: string } | null;
  guestPhone?: string | null;
  shippingAddress?: ShippingAddr | null;
  items?: OrderItemRow[];
};

function formatAddress(addr: ShippingAddr | null | undefined): string {
  if (!addr || typeof addr !== 'object') return '—';
  const parts = [addr.city, addr.district, addr.street, addr.house].filter(Boolean);
  return parts.length ? parts.join(', ') : '—';
}

function formatVariantOptions(opts: Record<string, string> | unknown): string {
  if (!opts || typeof opts !== 'object') return '';
  const entries = Object.entries(opts as Record<string, string>);
  return entries.length ? entries.map(([k, v]) => `${k}: ${v}`).join(', ') : '';
}

function paymentStatusLabel(ps: string | undefined, t: TranslateFn): string {
  if (!ps) return '—';
  const key = `seller.orders.paymentStatus.${ps}`;
  const lbl = t(key);
  return lbl === key ? ps : lbl;
}

function paymentMethodLabel(pm: string | undefined, t: TranslateFn): string {
  if (!pm) return '—';
  const key = `seller.orders.paymentMethod.${pm}`;
  const lbl = t(key);
  return lbl === key ? pm : lbl;
}

export default function SellerOrdersPage() {
  const { t, intlLocale } = useTranslation();
  const [data, setData] = useState<{ data: OrderRow[] } | null>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const currency = t('checkout.currency');

  useEffect(() => {
    if (!token) return;
    apiFetch(`${API_URL}/orders/seller`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).then(setData);
  }, [token]);

  const updateStatus = (orderId: string, status: string, deliveryType?: string) => {
    if (!token) return;
    apiFetch(`${API_URL}/orders/${orderId}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ status }) })
      .then(() => {
        setData((d) => (d ? { ...d, data: d.data.map((o) => (o.id === orderId ? { ...o, status } : o)) } : null));
        toast.success(`${t('seller.orders.toastStatusPrefix')} ${orderStatusLabel(status, deliveryType, t)}`);
      })
      .catch(() => toast.error(t('seller.orders.toastStatusError')));
  };

  const markAsPaid = (orderId: string) => {
    if (!token) return;
    apiFetch(`${API_URL}/orders/${orderId}/mark-paid`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      .then(() => {
        setData((d) => (d ? { ...d, data: d.data.map((o) => (o.id === orderId ? { ...o, paymentStatus: 'PAID' } : o)) } : null));
        toast.success(t('seller.orders.toastPaid'));
      })
      .catch((e) => toast.error(e?.message ?? t('seller.orders.toastPaidError')));
  };

  const isPickup = (o: OrderRow) => o.deliveryType === 'PICKUP';
  const isPrepaid = (o: OrderRow) => o.paymentMethod === 'CLICK' || o.paymentMethod === 'PAYME';
  const canShipOrDeliver = (o: OrderRow) => !isPrepaid(o) || o.paymentStatus === 'PAID';

  const shipBtnLabel = (o: OrderRow) => (isPickup(o) ? t('seller.orders.readyPickup') : t('seller.orders.shipped'));
  const deliverBtnLabel = (o: OrderRow) => (isPickup(o) ? t('seller.orders.deliveredPickup') : t('seller.orders.delivered'));

  if (!token) return <DashboardAuthGate />;
  if (!data) return <Skeleton className="h-24 w-full" />;
  const orders = data.data ?? [];

  return (
    <div className="min-w-0 max-w-full">
      <DashboardPageHeader
        eyebrow={t('seller.orders.eyebrow')}
        title={t('seller.orders.title')}
        description={t('seller.orders.description')}
      />
      <DashboardPanel className="p-4 sm:p-5 md:p-6">
        {orders.length === 0 ? (
          <DashboardEmptyState
            icon={ShoppingBag}
            title={t('seller.orders.emptyTitle')}
            description={t('seller.orders.emptyDescription')}
          />
        ) : (
          <div className="space-y-4">
            {orders.map((o) => (
              <Card key={o.id} className="border-border/70 shadow-none">
                <CardHeader className="flex flex-wrap items-center gap-2 pb-2">
                  <span className="font-mono">{o.orderNumber}</span>
                  <span className="text-sm text-muted-foreground">{new Date(o.createdAt).toLocaleDateString(intlLocale)}</span>
                  <Badge variant="secondary" className="text-xs">
                    {isPickup(o) ? t('seller.orders.pickup') : t('seller.orders.delivery')}
                  </Badge>
                  <Badge>{orderStatusLabel(o.status, o.deliveryType, t)}</Badge>
                  <Badge variant="outline" className="text-xs">
                    💳 {paymentStatusLabel(o.paymentStatus, t)} ({paymentMethodLabel(o.paymentMethod, t)})
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p>
                    {t('seller.orders.buyer')}{' '}
                    {o.buyer
                      ? `${(o.buyer.firstName ?? '')} ${(o.buyer.lastName ?? '')}`.trim() || '—'
                      : o.guestPhone
                        ? t('seller.home.guestWithPhone', { phone: o.guestPhone })
                        : t('seller.home.guest')}
                  </p>
                  <p>
                    {t('seller.orders.phone')} {o.buyer?.phone ?? o.guestPhone ?? '—'}
                  </p>
                  {!isPickup(o) && (
                    <p className="text-sm text-muted-foreground">
                      {t('seller.orders.address')} {formatAddress(o.shippingAddress)}
                    </p>
                  )}
                  {Array.isArray(o.items) && o.items.length > 0 && (
                    <div className="rounded-md border overflow-hidden overflow-x-auto">
                      <table className="w-full text-sm min-w-[600px]">
                        <thead>
                          <tr className="bg-muted/50 text-left">
                            <th className="p-2 font-medium">{t('seller.orders.tableSku')}</th>
                            <th className="p-2 font-medium">{t('seller.orders.tableProduct')}</th>
                            <th className="p-2 font-medium">{t('seller.orders.tableVariant')}</th>
                            <th className="p-2 font-medium">{t('seller.orders.tableUnit')}</th>
                            <th className="p-2 font-medium text-right">{t('seller.orders.tableQty')}</th>
                            <th className="p-2 font-medium text-right">{t('seller.orders.tableStock')}</th>
                            <th className="p-2 font-medium text-right">{t('seller.orders.tablePrice')}</th>
                            <th className="p-2 font-medium text-right">{t('seller.orders.tableSum')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {o.items.map((it, idx) => {
                            const variantOpts = it.variant ? formatVariantOptions(it.variant.options) : '';
                            const sku = it.variant?.sku ?? it.product?.sku ?? '—';
                            const unit = it.product?.unit ?? t('seller.orders.unitPiece');
                            const stock = it.variant != null ? it.variant.stock : it.product?.stock;
                            const lineTotal = Number(it.price) * it.quantity;
                            return (
                              <tr key={idx} className="border-t">
                                <td className="p-2 font-mono text-muted-foreground">{sku}</td>
                                <td className="p-2">{it.product?.title ?? t('seller.orders.productFallback')}</td>
                                <td className="p-2 text-muted-foreground">{variantOpts || '—'}</td>
                                <td className="p-2 text-muted-foreground">{unit}</td>
                                <td className="p-2 text-right">{it.quantity}</td>
                                <td className="p-2 text-right text-muted-foreground">{stock != null ? stock : '—'}</td>
                                <td className="p-2 text-right">
                                  {formatPrice(Number(it.price))} {currency}
                                </td>
                                <td className="p-2 text-right font-medium">
                                  {formatPrice(lineTotal)} {currency}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p className="font-semibold">
                    {t('seller.orders.total')} {formatPrice(Number(o.totalAmount))} {currency}
                  </p>
                  {(o.paymentMethod === 'CASH' || o.paymentMethod === 'CARD_ON_DELIVERY') && o.paymentStatus === 'PENDING' && (
                    <Button size="sm" variant="secondary" onClick={() => markAsPaid(o.id)}>
                      {t('seller.orders.markPaid')}
                    </Button>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {o.status === 'PENDING' && (
                      <>
                        <Button size="sm" onClick={() => updateStatus(o.id, 'CONFIRMED', o.deliveryType)}>
                          {t('seller.orders.confirm')}
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => updateStatus(o.id, 'CANCELLED', o.deliveryType)}>
                          {t('seller.orders.cancel')}
                        </Button>
                      </>
                    )}
                    {o.status === 'CONFIRMED' && (
                      <>
                        <Button size="sm" onClick={() => updateStatus(o.id, 'PROCESSING', o.deliveryType)}>
                          {t('seller.orders.processing')}
                        </Button>
                        {canShipOrDeliver(o) ? (
                          <Button size="sm" onClick={() => updateStatus(o.id, 'SHIPPED', o.deliveryType)}>
                            {shipBtnLabel(o)}
                          </Button>
                        ) : (
                          <Button size="sm" variant="secondary" disabled title={t('seller.orders.disabledAwaitPayment')}>
                            {shipBtnLabel(o)} {t('seller.orders.suffixAwaitPayment')}
                          </Button>
                        )}
                        <Button size="sm" variant="destructive" onClick={() => updateStatus(o.id, 'CANCELLED', o.deliveryType)}>
                          {t('seller.orders.cancel')}
                        </Button>
                      </>
                    )}
                    {o.status === 'PROCESSING' && (
                      <>
                        {canShipOrDeliver(o) ? (
                          <Button size="sm" onClick={() => updateStatus(o.id, 'SHIPPED', o.deliveryType)}>
                            {shipBtnLabel(o)}
                          </Button>
                        ) : (
                          <Button size="sm" variant="secondary" disabled title={t('seller.orders.disabledAwaitPayment')}>
                            {shipBtnLabel(o)} {t('seller.orders.suffixAwaitPayment')}
                          </Button>
                        )}
                        <Button size="sm" variant="destructive" onClick={() => updateStatus(o.id, 'CANCELLED', o.deliveryType)}>
                          {t('seller.orders.cancel')}
                        </Button>
                      </>
                    )}
                    {o.status === 'SHIPPED' &&
                      (canShipOrDeliver(o) ? (
                        <Button size="sm" onClick={() => updateStatus(o.id, 'DELIVERED', o.deliveryType)}>
                          {deliverBtnLabel(o)}
                        </Button>
                      ) : (
                        <Button size="sm" variant="secondary" disabled title={t('seller.orders.disabledAwaitPayment')}>
                          {deliverBtnLabel(o)} {t('seller.orders.suffixAwaitPayment')}
                        </Button>
                      ))}
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
