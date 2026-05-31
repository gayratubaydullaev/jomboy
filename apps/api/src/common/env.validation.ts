export function validateEnv(): Record<string, unknown> {
  const isProd = process.env.NODE_ENV === 'production';
  const required: { key: string; minLength?: number }[] = [
    { key: 'DATABASE_URL' },
    { key: 'JWT_SECRET', minLength: 32 },
    ...(isProd
      ? [
          { key: 'CSRF_SECRET', minLength: 32 } as { key: string; minLength?: number },
          { key: 'CLICK_ALLOWED_IPS', minLength: 1 } as { key: string; minLength?: number },
          { key: 'PAYME_ALLOWED_IPS', minLength: 1 } as { key: string; minLength?: number },
          { key: 'REDIS_URL', minLength: 1 } as { key: string; minLength?: number },
        ]
      : []),
  ];
  if (isProd && process.env.THROTTLE_USE_REDIS !== 'true') {
    throw new Error('THROTTLE_USE_REDIS must be "true" in production for distributed rate limiting.');
  }
  const missing: string[] = [];
  for (const { key, minLength } of required) {
    const val = process.env[key];
    if (!val?.trim()) missing.push(key);
    else if (minLength != null && val.length < minLength) {
      missing.push(`${key} (min ${minLength} chars)`);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing or invalid required env: ${missing.join(', ')}. Check .env and .env.example.`,
    );
  }
  return process.env as Record<string, unknown>;
}
