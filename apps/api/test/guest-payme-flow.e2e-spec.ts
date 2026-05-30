import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import {
  createE2eApp,
  ensureE2eCatalog,
  paymeCallback,
} from './e2e-helpers';

jest.setTimeout(90_000);

describe('Guest Payme pay-first flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let productId: string;
  let expectedAmountTiyin: number;

  const cartSessionId = `e2e-cart-${randomUUID()}`;
  const guestPhone = '998901112233';

  beforeAll(async () => {
    app = await createE2eApp();
    prisma = new PrismaClient();
    const catalog = await ensureE2eCatalog(prisma);
    productId = catalog.productId;
    expectedAmountTiyin = Math.round(catalog.price * 100);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await app?.close();
  });

  it('completes guest checkout: cart → session → payme callbacks → order', async () => {
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
        paymentMethod: 'PAYME',
        deliveryType: 'PICKUP',
        shippingAddress: {
          phone: guestPhone,
          email: 'guest-e2e@example.com',
          firstName: 'E2E',
          lastName: 'Guest',
        },
      })
      .expect(201);

    const { sessionId, pollToken } = sessionRes.body as { sessionId: string; pollToken: string };
    expect(sessionId).toBeDefined();
    expect(pollToken).toBeDefined();

    const initRes = await request(server)
      .post('/payments/payme/init')
      .set('x-cart-session', cartSessionId)
      .send({
        sessionId,
        pollToken,
        returnUrl: 'http://localhost:3000/checkout/success',
      })
      .expect(201);

    expect(initRes.body.paymentUrl ?? initRes.body.redirectUrl).toBeTruthy();

    const paymeTxId = `e2e-payme-${randomUUID()}`;
    const paymeParams = {
      id: paymeTxId,
      time: Date.now(),
      amount: expectedAmountTiyin,
      account: { order_id: sessionId },
    };

    await paymeCallback(server, 'CheckPerformTransaction', paymeParams, 10).expect(200);
    await paymeCallback(server, 'CreateTransaction', paymeParams, 11).expect(200);
    await paymeCallback(server, 'PerformTransaction', paymeParams, 12).expect(200);

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

    expect(orderRes.body.orderNumber).toBeDefined();
    expect(orderRes.body.guestPhone?.replace(/\D/g, '')).toContain('998901112233');
    expect(orderRes.body.paymentStatus).toBe('PAID');
    expect(orderRes.body.items?.length).toBeGreaterThan(0);

    const session = await prisma.checkoutSession.findUnique({ where: { id: sessionId } });
    expect(session?.orderId).toBe(orderId);
    expect(session?.guestPhone).toContain('998');

    const cart = await prisma.cart.findFirst({ where: { sessionId: cartSessionId }, include: { items: true } });
    expect(cart?.items.length ?? 0).toBe(0);
  });

  it('rejects payme CheckPerformTransaction when amount mismatches', async () => {
    const server = app.getHttpServer();
    const mismatchCart = `e2e-cart-mismatch-${randomUUID()}`;

    await request(server)
      .post('/cart/items')
      .set('x-cart-session', mismatchCart)
      .send({ productId, quantity: 1 })
      .expect(201);

    const sessionRes = await request(server)
      .post('/checkout-session/guest')
      .set('x-cart-session', mismatchCart)
      .send({
        paymentMethod: 'PAYME',
        deliveryType: 'PICKUP',
        shippingAddress: { phone: guestPhone },
      })
      .expect(201);

    const { sessionId } = sessionRes.body as { sessionId: string };
    const res = await paymeCallback(
      server,
      'CheckPerformTransaction',
      {
        id: `e2e-payme-bad-${randomUUID()}`,
        time: Date.now(),
        amount: 1,
        account: { order_id: sessionId },
      },
      20,
    );
    expect(res.status).toBe(200);
    expect(res.body.error?.code).toBe(-31001);
  });
});
