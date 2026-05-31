import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CartService } from './cart.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CartService', () => {
  let service: CartService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tx: any;
  const mockPrisma = { $transaction: jest.fn() };

  beforeEach(async () => {
    tx = {
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      cart: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      cartItem: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    mockPrisma.$transaction.mockImplementation(async (fn: (client: typeof tx) => unknown) => fn(tx));

    const module: TestingModule = await Test.createTestingModule({
      providers: [CartService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(CartService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn: (client: typeof tx) => unknown) => fn(tx));
  });

  it('creates user cart when missing', async () => {
    const cart = { id: 'cart-1', userId: 'user-1', items: [] };
    tx.cart.findUnique.mockResolvedValueOnce(null);
    tx.cart.create.mockResolvedValueOnce(cart);

    const result = await service.getOrCreateCart('user-1', null);
    expect(result).toEqual(cart);
    expect(tx.cart.create).toHaveBeenCalledWith(expect.objectContaining({ data: { userId: 'user-1' } }));
  });

  it('addItem increments quantity for existing line', async () => {
    const cart = { id: 'cart-1', userId: 'user-1', items: [] };
    const existing = { id: 'item-1', quantity: 2 };
    const updated = { id: 'cart-1', items: [{ id: 'item-1', quantity: 3 }] };

    tx.cart.findUnique.mockResolvedValueOnce(cart);
    tx.cartItem.findFirst.mockResolvedValueOnce(existing);
    tx.cartItem.update.mockResolvedValueOnce({});
    tx.cart.findUniqueOrThrow.mockResolvedValueOnce(updated);

    const result = await service.addItem('user-1', null, { productId: 'prod-1', quantity: 1 });
    expect(tx.cartItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { quantity: 3 },
    });
    expect(result).toEqual(updated);
  });

  it('updateQuantity throws when cart not found', async () => {
    tx.cart.findFirst.mockResolvedValueOnce(null);
    await expect(service.updateQuantity('missing', 'prod-1', 1, 'user-1')).rejects.toThrow(NotFoundException);
  });

  it('mergeCart returns user cart when guest cart is empty', async () => {
    const userCart = { id: 'user-cart', userId: 'user-1', items: [] };
    tx.cart.findFirst.mockResolvedValueOnce(null);
    tx.cart.findUnique.mockResolvedValueOnce(userCart);

    const result = await service.mergeCart('guest-session', 'user-1');
    expect(result).toEqual(userCart);
  });

  it('mergeCart combines guest items into user cart', async () => {
    const guestCart = {
      id: 'guest-cart',
      sessionId: 'sess-1',
      items: [{ id: 'gi-1', productId: 'prod-1', variantId: null, quantity: 2 }],
    };
    const userCart = { id: 'user-cart', userId: 'user-1', items: [] };
    const merged = { id: 'user-cart', items: [{ productId: 'prod-1', quantity: 2 }] };

    tx.cart.findFirst.mockResolvedValueOnce(guestCart);
    tx.cart.findUnique.mockResolvedValueOnce(userCart);
    tx.cartItem.findFirst.mockResolvedValueOnce(null);
    tx.cartItem.create.mockResolvedValueOnce({});
    tx.cart.delete.mockResolvedValueOnce({});
    tx.cart.findUniqueOrThrow.mockResolvedValueOnce(merged);

    const result = await service.mergeCart('sess-1', 'user-1');
    expect(tx.cartItem.create).toHaveBeenCalled();
    expect(tx.cart.delete).toHaveBeenCalledWith({ where: { id: 'guest-cart' } });
    expect(result).toEqual(merged);
  });

  it('creates guest cart with generated session when userId is null', async () => {
    const cart = { id: 'guest-cart', sessionId: 'anon-x', items: [] };
    tx.cart.findFirst.mockResolvedValueOnce(null);
    tx.cart.create.mockResolvedValueOnce(cart);
    const result = await service.getOrCreateCart(null, null);
    expect(result).toEqual(cart);
    expect(tx.cart.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sessionId: expect.any(String) }) }));
  });
});
