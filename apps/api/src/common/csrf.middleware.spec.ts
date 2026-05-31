import { CsrfMiddleware } from './csrf.middleware';

function mockReq(method: string, path: string, opts?: { header?: string; cookie?: string }) {
  return {
    method,
    path,
    headers: opts?.header ? { 'x-csrf-token': opts.header } : {},
    cookies: opts?.cookie ? { csrfToken: opts.cookie } : {},
  } as never;
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe('CsrfMiddleware', () => {
  const middleware = new CsrfMiddleware();

  it('allows GET without CSRF token', () => {
    const res = mockRes();
    let called = false;
    middleware.use(mockReq('GET', '/favorites'), res as never, () => {
      called = true;
    });
    expect(called).toBe(true);
    expect(res.statusCode).toBe(200);
  });

  it('allows excluded POST routes without CSRF', () => {
    const res = mockRes();
    let called = false;
    middleware.use(mockReq('POST', '/auth/login'), res as never, () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('allows cart item PATCH without CSRF', () => {
    const res = mockRes();
    let called = false;
    middleware.use(mockReq('PATCH', '/cart/items/item-123'), res as never, () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('rejects POST when CSRF header is missing', () => {
    const res = mockRes();
    let called = false;
    middleware.use(mockReq('POST', '/favorites'), res as never, () => {
      called = true;
    });
    expect(called).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ message: 'Invalid CSRF token' });
  });

  it('rejects POST when CSRF header does not match cookie', () => {
    const res = mockRes();
    middleware.use(
      mockReq('POST', '/favorites', { header: 'token-a', cookie: 'token-b' }),
      res as never,
      () => {},
    );
    expect(res.statusCode).toBe(403);
  });

  it('allows POST when CSRF header matches cookie', () => {
    const res = mockRes();
    let called = false;
    middleware.use(
      mockReq('POST', '/favorites', { header: 'same-token', cookie: 'same-token' }),
      res as never,
      () => {
        called = true;
      },
    );
    expect(called).toBe(true);
    expect(res.statusCode).toBe(200);
  });
});
