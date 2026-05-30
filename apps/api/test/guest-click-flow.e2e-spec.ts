import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import {
  buildClickCallbackBody,
  clickCallback,
  createE2eApp,
  ensureE2eCatalog,
} from './e2e-helpers';

jest.setTimeout(90_000);

describe('Guest Click pay-first flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let productId: string;
  let amountSum: number;

  const cartSessionId = `e2e-click-cart-${randomUUID()}`;
  const guestPhone = '998903334455';

  beforeAll(async () => {
    app = await createE2eApp();
    prisma = new PrismaClient();
    const catalog = await ensureE2eCatalog(prisma);
    productId = catalog.productId;
    amountSum = Math.round(catalog.price);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await app?.close();
  });

  it('completes guest checkout via Click prepare + complete', async () => {
    const server = app.getHttpServer();

    await request(server)
      .post('/cart/items')
      .set('x-cart-session', cartSessionId)
      .send({ productId, quantity: 1 })
      .expect(201);

    const sessionRes = await request(server)
      .post('/checkout-session/guest')
      .set('x-cart-session', cartSessionId)
      .send({
        paymentMethod: 'CLICK',
        deliveryType: 'PICKUP',
        shippingAddress: { phone: guestPhone, firstName: 'Click', lastName: 'Guest' },
      })
      .expect(201);

    const { sessionId, pollToken } = sessionRes.body as { sessionId: string; pollToken: string };
    const clickId = `e2e-click-${randomUUID()}`;

    const prepare = buildClickCallbackBody(sessionId, amountSum, '0', clickId);
    await clickCallback(server, prepare).expect(200);

    const complete = buildClickCallbackBody(sessionId, amountSum, '1', clickId);
    const completeRes = await clickCallback(server, complete).expect(200);
    expect(completeRes.body.error).toBe(0);

    const pollRes = await request(server)
      .get(`/checkout-session/${sessionId}/order`)
      .query({ token: pollToken })
      .expect(200);

    const { orderId, guestViewToken } = pollRes.body as {
      orderId: string;
      guestViewToken?: string;
    };
    expect(orderId).toBeDefined();
    expect(guestViewToken).toBeDefined();

    const orderRes = await request(server)
      .get(`/orders/${orderId}/guest-view`)
      .query({ token: guestViewToken })
      .expect(200);

    expect(orderRes.body.paymentStatus).toBe('PAID');
    expect(orderRes.body.paymentMethod).toBe('CLICK');
  });
});
