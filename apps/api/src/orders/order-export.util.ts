import type { OrderStatus, PaymentMethod, PaymentStatus, DeliveryType } from '@prisma/client';
import { buildWorkbookBuffer } from '../products/excel-utils';

export type OrderExportRow = {
  orderNumber: string;
  createdAt: Date;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  deliveryType: DeliveryType;
  totalAmount: { toString(): string };
  guestPhone?: string | null;
  buyer?: {
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  seller?: { firstName?: string | null; lastName?: string | null } | null;
  shippingAddress?: unknown;
  items?: {
    quantity: number;
    price: { toString(): string };
    product: { title: string; sku?: string | null };
  }[];
};

function formatAddress(addr: unknown): string {
  if (!addr || typeof addr !== 'object') return '';
  const a = addr as Record<string, string | undefined>;
  return [a.city, a.district, a.street, a.house].filter(Boolean).join(', ');
}

function buyerLabel(order: OrderExportRow): string {
  if (order.buyer) {
    const name = `${order.buyer.firstName ?? ''} ${order.buyer.lastName ?? ''}`.trim();
    return name || '—';
  }
  return order.guestPhone ? `Mehmon (${order.guestPhone})` : 'Mehmon';
}

function itemsSummary(items: OrderExportRow['items']): string {
  if (!items?.length) return '';
  return items
    .map((i) => {
      const sku = i.product.sku ? `[${i.product.sku}] ` : '';
      return `${sku}${i.product.title} ×${i.quantity} (${i.price.toString()})`;
    })
    .join('; ');
}

export async function buildOrdersExportBuffer(
  orders: OrderExportRow[],
  options: { includeSeller?: boolean } = {},
): Promise<Buffer> {
  const includeSeller = options.includeSeller ?? false;
  const header = [
    'Buyurtma raqami',
    'Sana',
    'Holat',
    'Toʻlov usuli',
    'Toʻlov holati',
    'Yetkazish',
    ...(includeSeller ? ['Sotuvchi'] : []),
    'Xaridor',
    'Telefon',
    'Email',
    'Manzil',
    'Jami',
    'Tovarlar',
  ];
  const rows: (string | number)[][] = [header];
  for (const o of orders) {
    rows.push([
      o.orderNumber,
      o.createdAt.toISOString().slice(0, 19).replace('T', ' '),
      o.status,
      o.paymentMethod,
      o.paymentStatus,
      o.deliveryType,
      ...(includeSeller ? [`${o.seller?.firstName ?? ''} ${o.seller?.lastName ?? ''}`.trim()] : []),
      buyerLabel(o),
      o.buyer?.phone ?? o.guestPhone ?? '',
      o.buyer?.email ?? '',
      formatAddress(o.shippingAddress),
      o.totalAmount.toString(),
      itemsSummary(o.items),
    ]);
  }
  const colWidths = includeSeller
    ? [16, 20, 12, 14, 14, 12, 16, 18, 14, 22, 28, 12, 48]
    : [16, 20, 12, 14, 14, 12, 18, 14, 22, 28, 12, 48];
  return buildWorkbookBuffer([{ name: 'Buyurtmalar', rows, colWidths }]);
}
