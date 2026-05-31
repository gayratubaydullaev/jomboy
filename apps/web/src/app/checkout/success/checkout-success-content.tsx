'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { API_URL, formatPrice } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { useTranslation } from '@/contexts/i18n-context';

type PickupAddress = { city?: string; district?: string; street?: string; house?: string; phone?: string } | null;

function formatPickupAddress(addr: PickupAddress): string {
  if (!addr || typeof addr !== 'object') return '';
  const parts = [addr.city, addr.district, addr.street, addr.house, addr.phone].filter(Boolean);
  return parts.join(', ');
}

type ShopLike = { id?: string; name?: string; pickupAddress?: PickupAddress } | null;

interface OrderItem {
  id: string;
  quantity: number;
  price: string;
  product: {
    id: string;
    title: string;
    images?: { url: string }[];
    shop?: ShopLike;
  };
}

interface StoredOrder {
  id: string;
  orderNumber: string;
  deliveryType: string;
  totalAmount: string;
  items: OrderItem[];
  seller?: { shop?: ShopLike } | null;
  guestViewToken?: string;
}

function toStoredOrder(
  o: {
    id: string;
    orderNumber: string;
    deliveryType: string;
    totalAmount: string;
    items?: { id: string; quantity: number; price: string; product: { id: string; title: string; images?: { url: string }[]; shop?: ShopLike } }[];
    seller?: { shop?: ShopLike } | null;
    guestViewToken?: string;
  },
  productFallback: string,
): StoredOrder {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    deliveryType: o.deliveryType,
    totalAmount: o.totalAmount,
    guestViewToken: o.guestViewToken,
    items: (o.items ?? []).map((i) => ({
      id: i.id,
      quantity: i.quantity,
      price: i.price,
      product: {
        id: i.product?.id ?? '',
        title: i.product?.title ?? productFallback,
        images: i.product?.images,
        shop: i.product?.shop ?? null,
      },
    })),
    seller: o.seller ?? null,
  };
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollSessionOrder(
  sessionId: string,
  pollToken: string,
  maxAttempts = 8,
): Promise<{ orderId?: string; guestViewToken?: string } | null> {
  const pollQs = pollToken ? `?token=${encodeURIComponent(pollToken)}` : '';
  for (let i = 0; i < maxAttempts; i++) {
    const res = await apiFetch(`${API_URL}/checkout-session/${sessionId}/order${pollQs}`);
    if (res.ok) {
      const data = (await res.json()) as { orderId?: string; guestViewToken?: string } | null;
      if (data?.orderId) return data;
    }
    if (i < maxAttempts - 1) await sleep(1500 + i * 500);
  }
  return null;
}

async function fetchOrderDetails(
  orderId: string,
  guestViewToken: string | undefined,
  productFallback: string,
): Promise<StoredOrder | null> {
  if (guestViewToken) {
    const r = await apiFetch(
      `${API_URL}/orders/${orderId}/guest-view?token=${encodeURIComponent(guestViewToken)}`,
    );
    if (r.ok) return toStoredOrder(await r.json(), productFallback);
    return null;
  }
  const orderRes = await apiFetch(`${API_URL}/orders/${orderId}`);
  if (orderRes.ok) return toStoredOrder(await orderRes.json(), productFallback);
  return null;
}

export function CheckoutSuccessContent() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const isTwa = pathname?.startsWith('/telegram-app');
  const lookupHref = isTwa ? '/telegram-app/lookup' : '/order/lookup';
  const ordersHref = isTwa ? '/telegram-app/orders' : '/orders';
  const catalogHref = isTwa ? '/telegram-app/catalog' : '/catalog';
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<StoredOrder[] | null>(null);
  const [pending, setPending] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const orderIdFromUrl = searchParams.get('orderId');
  const tokenFromUrl = searchParams.get('token');
  const sessionIdFromUrl = searchParams.get('session_id');
  const pollTokenFromUrl = searchParams.get('poll_token');

  useEffect(() => {
    (async () => {
      try {
        const productFallback = t('checkoutSuccess.productDefault');
        const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('checkout_orders') : null;
        if (raw) {
          const data = JSON.parse(raw) as StoredOrder[];
          setOrders(Array.isArray(data) ? data : [data]);
          sessionStorage.removeItem('checkout_orders');
          return;
        }
        if (orderIdFromUrl && tokenFromUrl) {
          const r = await apiFetch(
            `${API_URL}/orders/${orderIdFromUrl}/guest-view?token=${encodeURIComponent(tokenFromUrl)}`,
          );
          if (r.ok) {
            setOrders([toStoredOrder(await r.json(), productFallback)]);
          } else {
            setOrders([]);
            setLoadFailed(true);
          }
          return;
        }
        if (sessionIdFromUrl) {
          setPending(true);
          const storedPoll =
            typeof sessionStorage !== 'undefined'
              ? sessionStorage.getItem(`checkout_poll_${sessionIdFromUrl}`)
              : null;
          const pollToken = pollTokenFromUrl ?? storedPoll ?? '';
          const sessionData = await pollSessionOrder(sessionIdFromUrl, pollToken);
          setPending(false);
          if (sessionData?.orderId) {
            const order = await fetchOrderDetails(
              sessionData.orderId,
              sessionData.guestViewToken,
              productFallback,
            );
            if (order) {
              if (sessionData.guestViewToken) {
                order.guestViewToken = sessionData.guestViewToken;
              }
              setOrders([order]);
              return;
            }
          }
          setOrders([]);
          setLoadFailed(!sessionData?.orderId);
          return;
        }
        setOrders([]);
      } catch {
        setOrders([]);
        setLoadFailed(true);
        setPending(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderIdFromUrl, tokenFromUrl, sessionIdFromUrl, pollTokenFromUrl]);

  if (orders === null) {
    return (
      <div className="space-y-3">
        <div className="animate-pulse h-24 bg-muted rounded-lg" />
        {pending && <p className="text-sm text-muted-foreground text-center">{t('checkoutSuccess.sessionPending')}</p>}
      </div>
    );
  }

  const totalSum = orders.reduce((s, o) => s + Number(o.totalAmount), 0);
  const guestToken = orders[0]?.guestViewToken ?? tokenFromUrl;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">{t('checkoutSuccess.title')}</h1>
        <p className="text-muted-foreground">
          {pending
            ? t('checkoutSuccess.sessionPending')
            : loadFailed && orders.length === 0
              ? t('checkoutSuccess.loadFailed')
              : orders.length === 0
                ? t('checkoutSuccess.hintOrders')
                : orders.length > 1
                  ? t('checkoutSuccess.hintMultiple', { count: orders.length })
                  : t('checkoutSuccess.hintOrders')}
        </p>
      </div>

      {orders.length > 0 && (
        <div className="space-y-4">
          {orders.map((order) => {
            const shopName = order.seller?.shop?.name ?? t('checkoutSuccess.shopDefault');
            const pickupAddress = order.seller?.shop?.pickupAddress ?? null;
            const isPickup = order.deliveryType === 'PICKUP';

            return (
              <Card key={order.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex flex-wrap items-center gap-2">
                    <span>{shopName}</span>
                    <span className="text-muted-foreground font-normal text-sm">#{order.orderNumber}</span>
                  </CardTitle>
                  {isPickup && pickupAddress && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('checkoutSuccess.pickupAddressLabel')}{' '}
                      {formatPickupAddress(pickupAddress) || t('checkoutSuccess.addressNotShown')}
                    </p>
                  )}
                  {isPickup && !pickupAddress && (
                    <p className="text-sm text-muted-foreground mt-1">{t('checkoutSuccess.pickupSellerWillContact')}</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <ul className="space-y-2">
                    {order.items?.map((item) => (
                      <li key={item.id} className="flex gap-3 items-center text-sm">
                        {item.product?.images?.[0] && (
                          <div className="relative w-12 h-12 rounded-md overflow-hidden bg-muted shrink-0">
                            <Image
                              src={item.product.images[0].url}
                              alt={item.product.title}
                              fill
                              className="object-cover"
                              sizes="48px"
                            />
                          </div>
                        )}
                        <span className="flex-1 truncate">{item.product?.title ?? t('checkoutSuccess.productDefault')}</span>
                        <span className="text-muted-foreground">
                          {item.quantity} × {formatPrice(Number(item.price))} {t('checkout.currency')}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="font-semibold pt-1 border-t">
                    {t('checkoutSuccess.orderTotal')} {formatPrice(Number(order.totalAmount))} {t('checkout.currency')}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {orders.length > 1 && totalSum > 0 && (
        <p className="text-center text-muted-foreground">
          {t('checkoutSuccess.grandTotal')} <strong>{formatPrice(totalSum)} {t('checkout.currency')}</strong>
        </p>
      )}

      <div className="flex flex-wrap gap-3 justify-center pt-4">
        {(orderIdFromUrl || orders[0]?.id) && guestToken && orders.length > 0 && (
          <Button variant="outline" asChild>
            <Link
              href={`/order/${orderIdFromUrl ?? orders[0]!.id}/view?token=${encodeURIComponent(guestToken)}`}
            >
              {t('checkoutSuccess.linkSaveOrder')}
            </Link>
          </Button>
        )}
        {orders.length > 0 && (
          <Button variant="outline" asChild>
            <Link href={lookupHref}>{t('checkoutSuccess.linkLookup')}</Link>
          </Button>
        )}
        <Button asChild><Link href={ordersHref}>{t('checkoutSuccess.orders')}</Link></Button>
        <Button asChild variant="outline"><Link href={catalogHref}>{t('checkoutSuccess.catalog')}</Link></Button>
      </div>
      {orders.length > 0 && (
        <p className="text-center text-sm text-muted-foreground pt-2">
          {t('checkoutSuccess.footerHintBefore')}
          <Link href={lookupHref} className="text-primary underline">
            {t('checkoutSuccess.footerLookup')}
          </Link>
          {t('checkoutSuccess.footerHintAfter')}
        </p>
      )}
    </div>
  );
}
