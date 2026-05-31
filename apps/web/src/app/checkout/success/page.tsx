import type { Metadata } from 'next';
import { Suspense } from 'react';
import { localePageMetadata } from '@/lib/page-metadata';
import { CheckoutSuccessContent } from './checkout-success-content';

export async function generateMetadata(): Promise<Metadata> {
  return localePageMetadata('checkoutSuccess.metaTitle', undefined, '/checkout/success');
}

export default function CheckoutSuccessPage() {
  return (
    <div className="w-full max-w-2xl mx-auto px-0 sm:px-4 md:px-6 py-8">
      <Suspense fallback={<div className="animate-pulse h-24 bg-muted rounded-lg" />}>
        <CheckoutSuccessContent />
      </Suspense>
    </div>
  );
}
