'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL, formatPrice } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from '@/contexts/i18n-context';
import { orderStatusLabel } from '@/lib/order-status-i18n';

function formatPickupAddress(addr: Record<string, unknown> | null | undefined): string {
  if (!addr || typeof addr !== 'object') return '';
  const parts = [
    addr.city,
    addr.district,
    addr.street,
    addr.house,
    typeof addr.fullAddress === 'string' ? addr.fullAddress : null,
  ].filter((x) => x != null && String(x).trim() !== '');
  return parts.map(String).join(', ').trim();
}

type OrderItem = {
  quantity: number;
  product: { id: string; title: string; images: { url: string }[] };
};
type Order = {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: string;
  createdAt: string;
  deliveryType?: 'DELIVERY' | 'PICKUP';
  shippingAddress?: Record<string, unknown> | null;
  items: OrderItem[];
  seller?: { firstName: string; lastName: string; shop?: { name: string; pickupAddress?: Record<string, unknown> | null } | null } | null;
};

export default function OrdersPage() {
  const { t, intlLocale } = useTranslation();
  const [data, setData] = useState<{ data: Order[] } | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const { isLoggedIn, isReady } = useAuth();

  useEffect(() => {
    if (!isReady || !isLoggedIn) return;
    apiFetch(`${API_URL}/orders/my`)
      .then((r) => {
        if (r.status === 403) {
          setForbidden(true);
          return null;
        }
        return r.json();
      })
      .then(setData)
      .catch(() => setData({ data: [] }));
  }, [isReady, isLoggedIn]);

  if (!isReady) {
    return (
      <div className="w-full max-w-2xl mx-auto px-0 sm:px-4 md:px-6 py-8">
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (!isLoggedIn)
    return (
      <div className="w-full max-w-2xl mx-auto px-0 sm:px-4 md:px-6 py-8 space-y-4">
        <p className="text-muted-foreground">{t('myOrders.loginPrompt')}</p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/auth/login?next=/orders">{t('myOrders.login')}</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/order/lookup">{t('myOrders.guestLookup')}</Link>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">{t('myOrders.guestHint')}</p>
      </div>
    );
  if (forbidden)
    return (
      <div className="w-full max-w-2xl mx-auto px-0 sm:px-4 md:px-6 py-8">
        <p className="text-muted-foreground mb-4">{t('myOrders.forbidden')}</p>
        <Button asChild variant="outline">
          <Link href="/account">{t('myOrders.backProfile')}</Link>
        </Button>
      </div>
    );
  if (!data)
    return (
      <div className="w-full max-w-2xl mx-auto px-0 sm:px-4 md:px-6">
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );

  const orders = data.data ?? [];
  const cur = t('checkout.currency');

  return (
    <div className="w-full max-w-2xl mx-auto px-0 sm:px-4 md:px-6 pb-8">
      <div className="flex flex-wrap items-center gap-3 md:gap-4 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/account">
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t('myOrders.profile')}
          </Link>
        </Button>
      </div>
      <h1 className="text-xl sm:text-2xl font-bold mb-2">{t('myOrders.title')}</h1>
      <p className="text-muted-foreground text-sm mb-6">{t('myOrders.subtitle')}</p>
      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t('myOrders.empty')}{' '}
            <Link href="/catalog" className="text-primary underline">
              {t('myOrders.catalogLink')}
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <Card key={o.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <span className="font-mono text-sm">{o.orderNumber}</span>
                  <Badge>{orderStatusLabel(o.status, o.deliveryType, t)}</Badge>
                  <span className="font-semibold">
                    {formatPrice(Number(o.totalAmount))} {cur}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  {new Date(o.createdAt).toLocaleString(intlLocale)}
                </p>
                {o.deliveryType === 'PICKUP' && (
                  <div className="rounded-lg bg-muted/60 p-3 mb-3 text-sm">
                    <p className="font-medium text-foreground mb-0.5">{t('myOrders.pickupSelf')}</p>
                    {o.seller?.shop?.name && (
                      <p className="text-muted-foreground">
                        <span className="text-foreground/90">{t('myOrders.shop')} </span>
                        {o.seller.shop.name}
                      </p>
                    )}
                    {o.seller?.shop?.pickupAddress && formatPickupAddress(o.seller.shop.pickupAddress as Record<string, unknown>) ? (
                      <p className="text-muted-foreground mt-0.5">
                        <span className="text-foreground/90">{t('myOrders.pickupAddressFrom')} </span>
                        {formatPickupAddress(o.seller.shop.pickupAddress as Record<string, unknown>)}
                      </p>
                    ) : (
                      <p className="text-muted-foreground text-xs mt-0.5">{t('myOrders.pickupNoAddressHint')}</p>
                    )}
                  </div>
                )}
                {o.deliveryType === 'DELIVERY' && <p className="text-xs text-muted-foreground mb-2">{t('myOrders.delivery')}</p>}
                {o.seller && (
                  <p className="text-xs text-muted-foreground mb-2">
                    {t('myOrders.seller')} {o.seller.firstName} {o.seller.lastName}
                  </p>
                )}
                <ul className="space-y-1">
                  {o.items?.slice(0, 3).map((item, i) => (
                    <li key={item.product?.id ?? i} className="flex gap-2 text-sm items-center">
                      <Link href={`/product/${item.product?.id ?? '#'}`} className="flex gap-2 items-center min-w-0 flex-1 hover:opacity-90">
                        {item.product?.images?.[0] && (
                          <div className="relative w-8 h-8 rounded bg-muted shrink-0 overflow-hidden">
                            <Image src={item.product.images[0].url} alt={item.product.title ?? ''} fill className="object-cover rounded" sizes="32px" />
                          </div>
                        )}
                        <span className="truncate text-primary underline underline-offset-2 decoration-primary/50">
                          {item.product?.title ?? t('myOrders.productFallback')}
                        </span>
                      </Link>
                      <span className="text-muted-foreground shrink-0">× {item.quantity}</span>
                    </li>
                  ))}
                  {(o.items?.length ?? 0) > 3 && (
                    <li className="text-xs text-muted-foreground">{t('myOrders.moreItems', { count: (o.items?.length ?? 0) - 3 })}</li>
                  )}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
