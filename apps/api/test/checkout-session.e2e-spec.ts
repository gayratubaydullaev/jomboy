import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2eApp } from './e2e-helpers';

describe('CheckoutSession (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /checkout-session/guest requires cart session header', () => {
    return request(app.getHttpServer())
      .post('/checkout-session/guest')
      .send({
        paymentMethod: 'CLICK',
        deliveryType: 'PICKUP',
        shippingAddress: { phone: '998901234567' },
      })
      .expect(400);
  });

  it('GET /checkout-session/:id/order rejects invalid poll token or missing session', async () => {
    const sessionId = '00000000-0000-4000-8000-000000000001';
    const res = await request(app.getHttpServer())
      .get(`/checkout-session/${sessionId}/order`)
      .query({ token: 'invalid-token' });
    expect([403, 404]).toContain(res.status);
  });

  it('GET /checkout-session/:id/order without token is rejected', async () => {
    const sessionId = '00000000-0000-4000-8000-000000000002';
    const res = await request(app.getHttpServer()).get(`/checkout-session/${sessionId}/order`);
    expect([403, 404]).toContain(res.status);
  });

  it('POST /checkout-session/guest rejects invalid payment method', () => {
    return request(app.getHttpServer())
      .post('/checkout-session/guest')
      .set('x-cart-session', 'guest-cart-session-1')
      .send({
        paymentMethod: 'CASH',
        deliveryType: 'PICKUP',
        shippingAddress: { phone: '998901234567' },
      })
      .expect(400);
  });
});
