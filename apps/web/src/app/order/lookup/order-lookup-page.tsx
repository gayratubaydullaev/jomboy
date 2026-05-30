'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { API_URL, formatPrice } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { useTranslation } from '@/contexts/i18n-context';
import { orderStatusLabel } from '@/lib/order-status-i18n';

type PickupAddress = { city?: string; district?: string; street?: string; house?: string; phone?: string } | null;

function formatPickupAddress(addr: PickupAddress): string {
  if (!addr || typeof addr !== 'object') return '';
  const parts = [addr.city, addr.district, addr.street, addr.house, addr.phone].filter(Boolean);
  return parts.join(', ');
}

export default function OrderLookupPage() {
  const { t } = useTranslation();
  const [orderNumber, setOrderNumber] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<{
    id: string;
    orderNumber: string;
    status: string;
    deliveryType: string;
    totalAmount: string;
    items: {
      id: string;
      quantity: number;
      price: string;
      product: { id: string; title: string; images?: { url: string }[]; shop?: { pickupAddress?: PickupAddress } };
    }[];
    seller?: { shop?: { id: string; name: string; pickupAddress?: PickupAddress } } | null;
  } | null>(null);

  const cur = t('checkout.currency');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOrder(null);
    const num = orderNumber.trim();
    const phone = guestPhone.trim();
    if (!num || !phone) {
      setError(t('orderLookup.errorRequired'));
      return;
    }
    setLoading(true);
    try {
      const r = await apiFetch(
        `${API_URL}/orders/guest-lookup?orderNumber=${encodeURIComponent(num)}&guestPhone=${encodeURIComponent(phone)}`,
      );
      if (!r.ok) {
        setError(t('orderLookup.errorNotFound'));
        return;
      }
      const data = await r.json();
      setOrder(data);
    } catch {
      setError(t('orderLookup.errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-0 sm:px-4 md:px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">{t('orderLookup.backHome')}</Link>
        </Button>
      </div>
      <h1 className="text-xl sm:text-2xl font-bold">{t('orderLookup.title')}</h1>
      <p className="text-muted-foreground text-sm">{t('orderLookup.description')}</p>

      {!order ? (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="orderNumber" className="block text-sm font-medium mb-1.5">
                  {t('orderLookup.labelOrderNumber')}
                </label>
                <Input
                  id="orderNumber"
                  type="text"
                  placeholder={t('orderLookup.placeholderOrderNumber')}
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  className="font-mono"
                />
              </div>
              <div>
                <label htmlFor="guestPhone" className="block text-sm font-medium mb-1.5">
                  {t('orderLookup.labelPhone')}
                </label>
                <Input
                  id="guestPhone"
                  type="tel"
                  placeholder={t('orderLookup.placeholderPhone')}
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                {loading ? t('orderLookup.submitLoading') : t('orderLookup.submit')}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex flex-wrap items-center gap-2">
                <span>{order.seller?.shop?.name ?? t('orderLookup.shopDefault')}</span>
                <span className="text-muted-foreground font-normal text-sm">#{order.orderNumber}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-muted">{orderStatusLabel(order.status, order.deliveryType, t)}</span>
              </CardTitle>
              {order.deliveryType === 'PICKUP' && (
                <p className="text-sm text-muted-foreground mt-1">
                  {order.seller?.shop?.pickupAddress && formatPickupAddress(order.seller.shop.pickupAddress)
                    ? `${t('orderLookup.pickupAddress')} ${formatPickupAddress(order.seller.shop.pickupAddress)}`
                    : t('orderLookup.pickupNoAddress')}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-2">
                {order.items?.map((item) => (
                  <li key={item.id} className="flex gap-3 items-center text-sm">
                    {item.product?.images?.[0] && (
                      <div className="relative w-12 h-12 rounded-md overflow-hidden bg-muted shrink-0">
                        <Image src={item.product.images[0].url} alt={item.product.title ?? ''} fill className="object-cover" sizes="48px" />
                      </div>
                    )}
                    <span className="flex-1 truncate">{item.product?.title ?? t('orderLookup.productDefault')}</span>
                    <span className="text-muted-foreground">
                      {item.quantity} × {formatPrice(Number(item.price))} {cur}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="font-semibold pt-1 border-t">
                {t('orderLookup.total')} {formatPrice(Number(order.totalAmount))} {cur}
              </p>
            </CardContent>
          </Card>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setOrder(null);
                setError(null);
                setOrderNumber('');
                setGuestPhone('');
              }}
            >
              {t('orderLookup.searchAnother')}
            </Button>
            <Button asChild>
              <Link href="/">{t('orderLookup.home')}</Link>
            </Button>
          </div>
        </>
      )}

      <p className="text-sm text-muted-foreground">
        {t('orderLookup.footerLoginHint')}{' '}
        <Link href="/auth/login?next=/orders" className="text-primary underline">
          {t('orderLookup.footerLogin')}
        </Link>{' '}
        {t('orderLookup.footerLoginAfter')}
      </p>
    </div>
  );
}
