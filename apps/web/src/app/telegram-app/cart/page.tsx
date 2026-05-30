'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { TwaNav } from '@/components/telegram/twa-nav';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/contexts/i18n-context';
import { useTelegramMainButton } from '@/hooks/use-telegram-main-button';

const CartContent = dynamic(() => import('@/app/cart/cart-content').then((m) => m.CartContent), {
  ssr: false,
  loading: () => <div className="h-40 animate-pulse bg-muted rounded-lg" />,
});

export default function TelegramCartPage() {
  const { t } = useTranslation();
  useTelegramMainButton({ text: t('cart.checkout'), href: '/telegram-app/checkout' });
  return (
    <div className="p-3 pb-24 min-h-[100dvh]">
      <h1 className="text-lg font-semibold mb-4">{t('nav.cart')}</h1>
      <CartContent checkoutHref="/telegram-app/checkout" catalogHref="/telegram-app/catalog" />
      <div className="mt-4">
        <Button asChild className="w-full">
          <Link href="/telegram-app/checkout">{t('cart.checkout')}</Link>
        </Button>
      </div>
      <TwaNav />
    </div>
  );
}
