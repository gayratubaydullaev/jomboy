import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('requires PAYME_ALLOWED_IPS in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/db';
    process.env.JWT_SECRET = 'x'.repeat(32);
    process.env.CSRF_SECRET = 'y'.repeat(32);
    process.env.CLICK_ALLOWED_IPS = '127.0.0.1';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.THROTTLE_USE_REDIS = 'true';
    delete process.env.PAYME_ALLOWED_IPS;

    expect(() => validateEnv()).toThrow(/PAYME_ALLOWED_IPS/);
  });

  it('passes when all production vars are set', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/db';
    process.env.JWT_SECRET = 'x'.repeat(32);
    process.env.CSRF_SECRET = 'y'.repeat(32);
    process.env.CLICK_ALLOWED_IPS = '127.0.0.1';
    process.env.PAYME_ALLOWED_IPS = '127.0.0.1';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.THROTTLE_USE_REDIS = 'true';

    expect(() => validateEnv()).not.toThrow();
  });

  it('does not require PAYME_ALLOWED_IPS in development', () => {
    process.env.NODE_ENV = 'development';
    process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/db';
    process.env.JWT_SECRET = 'x'.repeat(32);
    delete process.env.PAYME_ALLOWED_IPS;
    delete process.env.CSRF_SECRET;
    delete process.env.CLICK_ALLOWED_IPS;
    delete process.env.REDIS_URL;
    delete process.env.THROTTLE_USE_REDIS;

    expect(() => validateEnv()).not.toThrow();
  });
});
