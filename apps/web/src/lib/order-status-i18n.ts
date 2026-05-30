import type { TranslateFn } from '@/contexts/i18n-context';

export function orderStatusLabel(status: string, deliveryType: string | undefined, t: TranslateFn): string {
  if (deliveryType === 'PICKUP') {
    if (status === 'SHIPPED') return t('myOrders.pickupShipped');
    if (status === 'DELIVERED') return t('myOrders.pickupDelivered');
  }
  const key = `myOrders.status.${status}`;
  const label = t(key);
  return label === key ? status : label;
}
