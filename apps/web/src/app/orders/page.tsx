import type { Metadata } from 'next';
import { localePageMetadata } from '@/lib/page-metadata';
import OrdersPage from './orders-page';

export async function generateMetadata(): Promise<Metadata> {
  return localePageMetadata('myOrders.metaTitle', undefined, '/orders');
}

export default function Page() {
  return <OrdersPage />;
}
