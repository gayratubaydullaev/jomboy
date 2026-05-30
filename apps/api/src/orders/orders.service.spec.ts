import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('OrdersService', () => {
  let service: OrdersService;
  const mockPrisma = {
    order: { findFirst: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TelegramService, useValue: { sendOrderNotification: jest.fn() } },
        { provide: NotificationsService, useValue: { create: jest.fn() } },
      ],
    }).compile();
    service = module.get(OrdersService);
    jest.clearAllMocks();
  });

  it('findGuestOrderByNumberAndPhone throws when order not found', async () => {
    (mockPrisma.order.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(service.findGuestOrderByNumberAndPhone('ORD-1', '+998901234567')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('findGuestOrderByNumberAndPhone throws when phone mismatch', async () => {
    (mockPrisma.order.findFirst as jest.Mock).mockResolvedValue({
      orderNumber: 'ORD-1',
      guestPhone: '+998901111111',
    });
    await expect(service.findGuestOrderByNumberAndPhone('ORD-1', '+998901234567')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('findGuestOrderByNumberAndPhone returns order when phone matches', async () => {
    const order = {
      id: 'order-1',
      orderNumber: 'ORD-1',
      guestPhone: '+998 90 123 45 67',
      items: [],
    };
    (mockPrisma.order.findFirst as jest.Mock).mockResolvedValue(order);
    const result = await service.findGuestOrderByNumberAndPhone('ORD-1', '998901234567');
    expect(result).toBe(order);
  });
});
