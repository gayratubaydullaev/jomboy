'use client';

import { useEffect } from 'react';

/** Initializes Sentry in the browser when NEXT_PUBLIC_SENTRY_DSN is set. */
export function SentryInit() {
  useEffect(() => {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) return;
    void import('@sentry/react').then((Sentry) => {
      Sentry.init({
        dsn,
        environment: process.env.NODE_ENV,
        release:
          process.env.NEXT_PUBLIC_SENTRY_RELEASE ||
          process.env.NEXT_PUBLIC_BUILD_ID ||
          undefined,
        tracesSampleRate: 0.1,
      });
    });
  }, []);
  return null;
}
