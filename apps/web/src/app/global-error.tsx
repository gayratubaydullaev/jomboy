'use client';

import { getErrorMessages } from '@/lib/error-copy';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const copy = getErrorMessages();
  return (
    <html lang="uz">
      <body>
        <div style={{ padding: 24, textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
          <h2>{copy.title}</h2>
          <p style={{ color: '#666', fontSize: 14 }}>{error.message}</p>
          <button type="button" onClick={reset} style={{ marginTop: 16, padding: '8px 16px' }}>
            {copy.tryAgain}
          </button>
        </div>
      </body>
    </html>
  );
}
