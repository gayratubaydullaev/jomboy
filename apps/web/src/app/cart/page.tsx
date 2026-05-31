import type { Metadata } from 'next';
import { localePageMetadata } from '@/lib/page-metadata';
import { CartContent } from './cart-content';
import { CartPageChrome } from './cart-page-chrome';

export async function generateMetadata(): Promise<Metadata> {
  return localePageMetadata('cart.metaTitle', 'cart.metaDescription', '/cart');
}

export default function CartPage() {
  return (
    <div className="w-full max-w-3xl mx-auto px-0 sm:px-4 md:px-6 pb-8">
      <CartPageChrome />
      <CartContent />
    </div>
  );
}
