import type { Metadata } from 'next';
import { localePageMetadata } from '@/lib/page-metadata';
import OrderLookupPage from './order-lookup-page';

export async function generateMetadata(): Promise<Metadata> {
  return localePageMetadata('orderLookup.metaTitle', undefined, '/order/lookup');
}

export default function Page() {
  return <OrderLookupPage />;
}
