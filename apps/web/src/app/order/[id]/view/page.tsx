import type { Metadata } from 'next';
import { localePageMetadata } from '@/lib/page-metadata';
import OrderGuestViewPage from './order-guest-view-page';

export async function generateMetadata(): Promise<Metadata> {
  return localePageMetadata('orderGuestView.metaTitle', undefined, '/order/view');
}

export default function Page() {
  return <OrderGuestViewPage />;
}
