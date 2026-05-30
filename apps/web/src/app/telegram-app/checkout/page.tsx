'use client';

import dynamic from 'next/dynamic';
import { TwaNav } from '@/components/telegram/twa-nav';
import { useTranslation } from '@/contexts/i18n-context';
import { useTelegramMainButton } from '@/hooks/use-telegram-main-button';

const CheckoutForm = dynamic(() => import('@/app/checkout/checkout-form').then((m) => m.CheckoutForm), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse bg-muted rounded-lg" />,
});

const TWA_CHECKOUT_FORM_ID = 'twa-checkout-form';

export default function TelegramCheckoutPage() {
  const { t } = useTranslation();
  useTelegramMainButton({
    text: t('checkout.submit'),
    onClick: () => {
      (document.getElementById(TWA_CHECKOUT_FORM_ID) as HTMLFormElement | null)?.requestSubmit();
    },
  });
  return (
    <div className="p-3 pb-24 min-h-[100dvh]">
      <h1 className="text-lg font-semibold mb-4">{t('checkout.title')}</h1>
      <CheckoutForm successPathPrefix="/telegram-app" formId={TWA_CHECKOUT_FORM_ID} />
      <TwaNav />
    </div>
  );
}
