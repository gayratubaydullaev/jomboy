'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export function RouteError({
  error,
  reset,
  title,
  retryLabel,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  retryLabel?: string;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container py-12 text-center space-y-4">
      <h2 className="text-xl font-semibold">{title ?? 'Something went wrong'}</h2>
      <p className="text-sm text-muted-foreground">{error.message}</p>
      <Button type="button" onClick={reset}>
        {retryLabel ?? 'Try again'}
      </Button>
    </div>
  );
}
