import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { createE2eApp, getCsrfE2e, loginE2e, mergeCookieHeader } from './e2e-helpers';

jest.setTimeout(60_000);

describe('Seller product flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let categoryId: string;

  beforeAll(async () => {
    app = await createE2eApp();
    prisma = new PrismaClient();
    const category = await prisma.category.findFirst({ where: { slug: 'elektronika-telefonlar' } });
    if (!category) throw new Error('Seed category elektronika-telefonlar missing');
    categoryId = category.id;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await app?.close();
  });

  it('seller creates product and lists seller orders', async () => {
    const server = app.getHttpServer();
    const title = `E2E Seller Product ${randomUUID().slice(0, 8)}`;
    const { accessToken, cookies: loginCookies } = await loginE2e(server, 'seller@myshop.uz', 'Seller123!');
    const { csrfToken, cookies: csrfCookies } = await getCsrfE2e(server);
    const cookieHeader = mergeCookieHeader(loginCookies, csrfCookies);

    const createRes = await request(server)
      .post('/products')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-csrf-token', csrfToken)
      .set('Cookie', cookieHeader)
      .send({
        title,
        description: 'E2E test product',
        price: 150000,
        stock: 3,
        categoryId,
      })
      .expect(201);

    expect(createRes.body.title).toBe(title);
    expect(createRes.body.isModerated).toBe(false);

    const ordersRes = await request(server)
      .get('/orders/seller')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(ordersRes.body.data ?? ordersRes.body)).toBe(true);
  });
});
