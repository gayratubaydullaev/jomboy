import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';
import { createE2eApp, ensureE2eCatalog, getCsrfE2e, loginE2e, mergeCookieHeader } from './e2e-helpers';

jest.setTimeout(60_000);

describe('Admin product moderation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    app = await createE2eApp();
    prisma = new PrismaClient();
    await ensureE2eCatalog(prisma);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await app?.close();
  });

  it('admin approves an unmoderated product', async () => {
    const server = app.getHttpServer();
    const product = await prisma.product.findFirst({
      where: { isModerated: true },
      select: { id: true },
    });
    expect(product).toBeTruthy();
    await prisma.product.update({ where: { id: product!.id }, data: { isModerated: false } });

    const { accessToken, cookies: loginCookies } = await loginE2e(server, 'admin@myshop.uz', 'Admin123!');
    const { csrfToken, cookies: csrfCookies } = await getCsrfE2e(server);

    await request(server)
      .post(`/admin/products/${product!.id}/moderate`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-csrf-token', csrfToken)
      .set('Cookie', mergeCookieHeader(loginCookies, csrfCookies))
      .send({ approve: true })
      .expect(201);

    const updated = await prisma.product.findUnique({ where: { id: product!.id }, select: { isModerated: true } });
    expect(updated?.isModerated).toBe(true);
  });
});
