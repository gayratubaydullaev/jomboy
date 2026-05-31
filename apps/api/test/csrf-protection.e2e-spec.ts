import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { createE2eApp, ensureE2eCatalog, getCsrfE2e, loginE2e, mergeCookieHeader, registerBuyerE2e } from './e2e-helpers';

jest.setTimeout(60_000);

describe('CSRF protection (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let productId: string;

  beforeAll(async () => {
    app = await createE2eApp();
    prisma = new PrismaClient();
    const catalog = await ensureE2eCatalog(prisma);
    productId = catalog.productId;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await app?.close();
  });

  it('rejects authenticated POST without CSRF token', async () => {
    const server = app.getHttpServer();
    const { accessToken } = await loginE2e(server, 'admin@myshop.uz', 'Admin123!');

    await request(server)
      .post('/favorites')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ productId })
      .expect(403);
  });

  it('allows authenticated POST with matching CSRF cookie and header', async () => {
    const server = app.getHttpServer();
    const email = `csrf-buyer-${randomUUID()}@example.com`;
    const { accessToken, cookies: loginCookies } = await registerBuyerE2e(server, email);
    const { csrfToken, cookies: csrfCookies } = await getCsrfE2e(server);

    await request(server)
      .post('/favorites')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-csrf-token', csrfToken)
      .set('Cookie', mergeCookieHeader(loginCookies, csrfCookies))
      .send({ productId })
      .expect(201);
  });
});
