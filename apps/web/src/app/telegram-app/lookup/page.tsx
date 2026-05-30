'use client';

import OrderLookupPage from '@/app/order/lookup/order-lookup-page';
import { TwaNav } from '@/components/telegram/twa-nav';

export default function TelegramOrderLookupPage() {
  return (
    <div className="p-3 pb-24">
      <OrderLookupPage />
      <TwaNav />
    </div>
  );
}
