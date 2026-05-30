import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { createE2eApp, ensureE2eCatalog, registerBuyerE2e } from './e2e-helpers';

jest.setTimeout(60_000);

describe('Auth checkout session (e2e)', () => {
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

  it('registers buyer, adds to cart, creates checkout session', async () => {
    const server = app.getHttpServer();
    const email = `e2e-buyer-${randomUUID()}@example.com`;
    const { accessToken } = await registerBuyerE2e(server, email);

    await request(server)
      .post('/cart/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ productId, quantity: 1 })
      .expect(201);

    const sessionRes = await request(server)
      .post('/checkout-session')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        paymentMethod: 'PAYME',
        deliveryType: 'PICKUP',
        shippingAddress: { phone: '998901234567' },
      })
      .expect(201);

    const { sessionId, pollToken } = sessionRes.body as { sessionId: string; pollToken: string };
    expect(sessionId).toBeDefined();
    expect(pollToken).toBeDefined();

    const pollRes = await request(server)
      .get(`/checkout-session/${sessionId}/order`)
      .query({ token: pollToken })
      .expect(200);

    expect(pollRes.body.orderId ?? null).toBeNull();
  });
});
