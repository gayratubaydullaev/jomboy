'use client';

import { RouteError } from '@/components/ui/route-error';
import { useTranslation } from '@/contexts/i18n-context';

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
  titleKey: string;
};

export function LocalizedRouteError({ error, reset, titleKey }: Props) {
  const { t } = useTranslation();
  return (
    <RouteError
      error={error}
      reset={reset}
      title={t(titleKey)}
      retryLabel={t('errors.tryAgain')}
    />
  );
}
