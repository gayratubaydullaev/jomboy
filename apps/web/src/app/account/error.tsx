'use client';

import { LocalizedRouteError } from '@/components/ui/localized-route-error';

export default function AccountError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <LocalizedRouteError {...props} titleKey="errors.accountTitle" />;
}
