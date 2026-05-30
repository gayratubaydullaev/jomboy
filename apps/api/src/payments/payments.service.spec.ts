import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProvider } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { OrdersService } from '../orders/orders.service';
import { SettingsService } from '../settings/settings.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  const prisma: {
    checkoutSession: { findUnique: jest.Mock };
    order: { findUnique: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
    payment: { create: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
    paymeTransaction: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock; findMany: jest.Mock };
    $transaction: jest.Mock;
  } = {
    checkoutSession: { findUnique: jest.fn() },
    order: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    payment: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    paymeTransaction: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((fn: (tx: typeof prisma) => unknown) => fn(prisma));
  const settings = { assertPaymentEnabled: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'CLICK_SERVICE_ID') return 'svc';
              if (key === 'CLICK_SECRET_KEY') return 'secret';
              if (key === 'PAYME_MERCHANT_ID') return 'm';
              return undefined;
            },
          },
        },
        { provide: TelegramService, useValue: { sendOrderNotification: jest.fn(), sendAdminOrderNotification: jest.fn() } },
        { provide: OrdersService, useValue: { createOrderFromCheckoutSession: jest.fn() } },
        { provide: SettingsService, useValue: settings },
      ],
    }).compile();
    service = module.get(PaymentsService);
  });

  it('rejects payment init for another user session', async () => {
    const sessionId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    prisma.checkoutSession.findUnique.mockResolvedValue({
      id: sessionId,
      buyerId: 'owner-id',
      paymentMethod: 'CLICK',
      totalAmount: 100,
      orderId: null,
    });
    await expect(
      service.createClickPayment(sessionId, 'http://localhost/success', { userId: 'other-user' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows guest session init with poll token', async () => {
    const sessionId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    prisma.checkoutSession.findUnique.mockResolvedValue({
      id: sessionId,
      buyerId: null,
      paymentMethod: 'CLICK',
      totalAmount: 100,
      orderId: null,
      pollToken: 'guest-poll-token',
    });
    const result = await service.createClickPayment(sessionId, 'http://localhost/success', {
      pollToken: 'guest-poll-token',
    });
    expect(result.redirectUrl).toContain('click.uz');
  });

  it('handles Payme CheckPerformTransaction', async () => {
    const sessionId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    prisma.checkoutSession.findUnique.mockResolvedValue({
      id: sessionId,
      orderId: null,
      totalAmount: 10,
    });
    const result = await service.handlePaymeCallback({
      method: 'CheckPerformTransaction',
      params: {
        amount: 1000,
        account: { order_id: sessionId },
      },
    });
    expect(result).toEqual({ result: { allow: true } });
  });

  it('handles Payme CreateTransaction idempotently', async () => {
    const sessionId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    prisma.checkoutSession.findUnique.mockResolvedValue({
      id: sessionId,
      orderId: null,
      totalAmount: 10,
    });
    prisma.paymeTransaction.findUnique.mockResolvedValue(null);
    prisma.paymeTransaction.create.mockResolvedValue({});
    const result = await service.handlePaymeCallback({
      method: 'CreateTransaction',
      params: {
        id: 'payme-tx-1',
        time: 1700000000000,
        amount: 1000,
        account: { order_id: sessionId },
      },
    });
    expect((result as { result: { state: number } }).result.state).toBe(1);
    expect(prisma.paymeTransaction.create).toHaveBeenCalled();
  });
});
