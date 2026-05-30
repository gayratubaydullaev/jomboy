'use client';

import { CheckoutSuccessContent } from '@/app/checkout/success/checkout-success-content';
import { TwaNav } from '@/components/telegram/twa-nav';

export default function TelegramCheckoutSuccessPage() {
  return (
    <div className="p-3 pb-24">
      <CheckoutSuccessContent />
      <TwaNav />
    </div>
  );
}
