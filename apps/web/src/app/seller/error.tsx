'use client';

import { LocalizedRouteError } from '@/components/ui/localized-route-error';

export default function SellerError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <LocalizedRouteError {...props} titleKey="errors.sellerTitle" />;
}
