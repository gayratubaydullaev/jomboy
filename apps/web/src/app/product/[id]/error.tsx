'use client';

import { LocalizedRouteError } from '@/components/ui/localized-route-error';

export default function ProductError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <LocalizedRouteError {...props} titleKey="errors.productTitle" />;
}
