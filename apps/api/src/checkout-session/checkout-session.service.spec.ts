import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CheckoutSessionService } from './checkout-session.service';
import { PrismaService } from '../prisma/prisma.service';
import { DeliveryType } from './dto/create-checkout-session.dto';

describe('CheckoutSessionService', () => {
  let service: CheckoutSessionService;
  const mockPrisma = {
    cart: { findFirst: jest.fn() },
    checkoutSession: { create: jest.fn(), findUnique: jest.fn() },
    order: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CheckoutSessionService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(CheckoutSessionService);
    jest.clearAllMocks();
  });

  it('createSession rejects empty cart', async () => {
    (mockPrisma.cart.findFirst as jest.Mock).mockResolvedValue({ items: [] });
    await expect(
      service.createSession('buyer-1', {
        paymentMethod: 'CLICK',
        deliveryType: DeliveryType.DELIVERY,
        shippingAddress: { city: 'T', street: 'S', house: '1', phone: '998901234567' },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('getOrderIdBySessionId rejects invalid poll token', async () => {
    mockPrisma.checkoutSession.findUnique.mockResolvedValue({
      orderId: 'order-1',
      pollToken: 'secret-token',
      buyerId: null,
    });
    await expect(
      service.getOrderIdBySessionId('session-1', { pollToken: 'wrong' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('createGuestSession requires non-empty cart session id', async () => {
    await expect(
      service.createGuestSession('', {
        paymentMethod: 'CLICK',
        deliveryType: DeliveryType.PICKUP,
        shippingAddress: { phone: '998901234567' },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('getOrderIdBySessionId returns orderId with valid poll token', async () => {
    mockPrisma.checkoutSession.findUnique.mockResolvedValue({
      orderId: 'order-1',
      pollToken: 'secret-token',
      buyerId: null,
    });
    mockPrisma.order.findUnique.mockResolvedValue({ guestViewToken: 'guest-token' });
    const result = await service.getOrderIdBySessionId('session-1', { pollToken: 'secret-token' });
    expect(result).toEqual({ orderId: 'order-1', guestViewToken: 'guest-token' });
  });
});
