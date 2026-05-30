const DEV_SESSION_FALLBACK = 'dev-session-secret-change-me';

export function getSessionCookieSecret(): string {
  const isProd = process.env.NODE_ENV === 'production';
  const secret = process.env.SESSION_COOKIE_SECRET?.trim();
  if (isProd) {
    if (!secret || secret.length < 32) {
      throw new Error(
        'SESSION_COOKIE_SECRET is required in production (min 32 chars). Set it in .env before build/start.',
      );
    }
    return secret;
  }
  if (secret && secret.length >= 32) return secret;
  const jwt = process.env.JWT_SECRET?.trim();
  if (jwt && jwt.length >= 32) return jwt;
  return DEV_SESSION_FALLBACK;
}

export function assertWebProductionEnv(): void {
  if (process.env.NODE_ENV !== 'production') return;
  getSessionCookieSecret();
  const jwt = process.env.JWT_SECRET?.trim();
  if (!jwt || jwt.length < 32) {
    throw new Error('JWT_SECRET is required in production (min 32 chars) for session route JWT verification.');
  }
}
