import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2eApp } from './e2e-helpers';

describe('Payments guest init (e2e)', () => {
  let app: INestApplication;
  const sessionId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /payments/payme/init without auth or pollToken is rejected', () => {
    return request(app.getHttpServer())
      .post('/payments/payme/init')
      .send({
        sessionId,
        returnUrl: 'http://localhost:3000/checkout/success',
      })
      .expect((res) => {
        expect([400, 403, 404]).toContain(res.status);
      });
  });

  it('POST /payments/click/init validates returnUrl', async () => {
    const res = await request(app.getHttpServer())
      .post('/payments/click/init')
      .send({
        sessionId,
        returnUrl: 'not-a-url',
        pollToken: 'some-token',
      });
    expect([400, 422]).toContain(res.status);
  });
});
