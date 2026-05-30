import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { AppModule } from '../src/app.module';
import * as request from 'supertest';

export const PAYME_MERCHANT_E2E = 'e2e-merchant';
export const PAYME_KEY_E2E = 'e2e-payme-secret-key';
export const CLICK_SERVICE_E2E = 'e2e-click-service';
export const CLICK_SECRET_E2E = 'e2e-click-secret-key';

export async function createE2eApp(): Promise<INestApplication> {
  process.env.PAYME_MERCHANT_ID = PAYME_MERCHANT_E2E;
  process.env.PAYME_KEY = PAYME_KEY_E2E;
  process.env.CLICK_SERVICE_ID = CLICK_SERVICE_E2E;
  process.env.CLICK_SECRET_KEY = CLICK_SECRET_E2E;
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    process.env.JWT_SECRET = 'e2e-test-jwt-secret-min-32-chars!!';
  }
  process.env.NODE_ENV = 'test';

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
  await app.init();
  return app;
}

export function paymeAuthHeader(): string {
  return `Basic ${Buffer.from(`${PAYME_MERCHANT_E2E}:${PAYME_KEY_E2E}`, 'utf-8').toString('base64')}`;
}

export async function ensureE2eCatalog(prisma: PrismaClient): Promise<{ productId: string; price: number }> {
  await prisma.platformSettings.updateMany({
    data: {
      paymentPaymeEnabled: true,
      paymentClickEnabled: true,
      pickupEnabled: true,
      deliveryEnabled: true,
    },
  });

  const product = await prisma.product.findFirst({
    where: { isModerated: true, stock: { gt: 0 } },
    select: { id: true, price: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!product) {
    throw new Error('E2E catalog empty. Run: cd apps/api && pnpm exec prisma db seed');
  }
  return { productId: product.id, price: Number(product.price) };
}

export function paymeCallback(
  server: ReturnType<INestApplication['getHttpServer']>,
  method: string,
  params: Record<string, unknown>,
  requestId = 1,
) {
  return request(server)
    .post('/payments/payme/callback')
    .set('Authorization', paymeAuthHeader())
    .send({ method, params, id: requestId });
}

export function clickSignString(body: Record<string, string>, secretKey: string): string {
  const { click_trans_id, service_id, merchant_trans_id, merchant_prepare_id, amount, action, sign_time } = body;
  const parts =
    action === '1'
      ? [click_trans_id, service_id, secretKey, merchant_trans_id, merchant_prepare_id ?? '', amount, action, sign_time]
      : [click_trans_id, service_id, secretKey, merchant_trans_id, amount, action, sign_time];
  return createHash('md5').update(parts.join('')).digest('hex');
}

export function buildClickCallbackBody(
  merchantTransId: string,
  amount: number,
  action: '0' | '1',
  clickTransId: string,
): Record<string, string> {
  const sign_time = String(Date.now());
  const body: Record<string, string> = {
    click_trans_id: clickTransId,
    service_id: CLICK_SERVICE_E2E,
    merchant_trans_id: merchantTransId,
    amount: String(Math.round(amount)),
    action,
    sign_time,
  };
  if (action === '1') body.merchant_prepare_id = merchantTransId;
  body.sign_string = clickSignString(body, CLICK_SECRET_E2E);
  return body;
}

export function clickCallback(
  server: ReturnType<INestApplication['getHttpServer']>,
  body: Record<string, string>,
) {
  return request(server).post('/payments/click/callback').send(body);
}

export async function registerBuyerE2e(
  server: ReturnType<INestApplication['getHttpServer']>,
  email: string,
): Promise<{ accessToken: string; userId: string }> {
  const res = await request(server)
    .post('/auth/register')
    .send({
      email,
      password: 'Test1234!',
      firstName: 'E2E',
      lastName: 'Buyer',
    })
    .expect(201);
  const body = res.body as { accessToken: string; user: { id: string } };
  return { accessToken: body.accessToken, userId: body.user.id };
}
