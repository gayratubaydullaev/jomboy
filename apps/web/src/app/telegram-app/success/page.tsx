'use client';

import { Suspense } from 'react';
import { CheckoutSuccessContent } from '@/app/checkout/success/checkout-success-content';
import { TwaNav } from '@/components/telegram/twa-nav';

export default function TelegramCheckoutSuccessPage() {
  return (
    <div className="p-3 pb-24">
      <Suspense fallback={<div className="animate-pulse h-24 bg-muted rounded-lg" />}>
        <CheckoutSuccessContent />
      </Suspense>
      <TwaNav />
    </div>
  );
}
