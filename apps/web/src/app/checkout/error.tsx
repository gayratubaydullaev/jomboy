'use client';

import { LocalizedRouteError } from '@/components/ui/localized-route-error';

export default function CheckoutError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <LocalizedRouteError {...props} titleKey="errors.checkoutTitle" />;
}
