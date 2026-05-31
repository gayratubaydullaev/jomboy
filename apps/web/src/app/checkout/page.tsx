import type { Metadata } from 'next';
import { localePageMetadata } from '@/lib/page-metadata';
import { CheckoutForm } from './checkout-form';
import { CheckoutPageChrome } from './checkout-page-chrome';

export async function generateMetadata(): Promise<Metadata> {
  return localePageMetadata('checkout.metaTitle', undefined, '/checkout');
}

export default function CheckoutPage() {
  return (
    <div className="w-full max-w-lg mx-auto px-0 sm:px-4 md:px-6 pb-8">
      <CheckoutPageChrome />
      <CheckoutForm />
    </div>
  );
}
