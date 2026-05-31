import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2eApp } from './e2e-helpers';

jest.setTimeout(60_000);

describe('Login rate limit (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('returns 429 after exceeding login attempts', async () => {
    const server = app.getHttpServer();
    const payload = { email: 'rate-limit@example.com', password: 'WrongPass1!' };

    for (let i = 0; i < 3; i++) {
      await request(server).post('/auth/login').send(payload).expect(401);
    }

    const res = await request(server).post('/auth/login').send(payload);
    expect(res.status).toBe(429);
  });
});
