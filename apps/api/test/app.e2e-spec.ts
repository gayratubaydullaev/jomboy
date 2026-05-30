import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2eApp } from './e2e-helpers';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/health (GET) returns 200', () => {
    return request(app.getHttpServer()).get('/health').expect(200);
  });

  it('/categories (GET) returns 200', () => {
    return request(app.getHttpServer()).get('/categories').expect(200);
  });
});
