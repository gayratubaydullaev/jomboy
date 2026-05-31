import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductQueryService } from './product-query.service';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('ProductsService', () => {
  let service: ProductsService;
  const mockPrisma = {
    shop: { findFirst: jest.fn() },
    category: { findUnique: jest.fn() },
    product: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    platformSettings: { findFirst: jest.fn() },
  };
  const mockTelegram = { sendAdminPendingProductNotification: jest.fn().mockResolvedValue(undefined) };
  const mockNotifications = { createForAdmins: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        ProductQueryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TelegramService, useValue: mockTelegram },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();
    service = module.get(ProductsService);
    jest.clearAllMocks();
  });

  describe('findOne', () => {
    it('throws when product is not found', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns product with review stats', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({
        id: 'p1',
        reviews: [{ rating: 5 }, { rating: 4 }],
      });
      mockPrisma.platformSettings.findFirst.mockResolvedValue({ chatWithSellerEnabled: true });
      const result = await service.findOne('p1');
      expect(result.reviewsCount).toBe(2);
      expect(result.avgRating).toBe(4.5);
      expect(result.chatWithSellerEnabled).toBe(true);
    });
  });

  describe('create', () => {
    const baseDto = {
      title: 'Test Product',
      description: 'Desc',
      price: 100000,
      stock: 5,
      categoryId: 'cat-sub',
    };

    it('throws when seller has no shop', async () => {
      mockPrisma.shop.findFirst.mockResolvedValue(null);
      await expect(service.create('seller-1', baseDto)).rejects.toThrow(ForbiddenException);
    });

    it('throws when category is top-level', async () => {
      mockPrisma.shop.findFirst.mockResolvedValue({ id: 'shop-1' });
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-sub', parentId: null });
      await expect(service.create('seller-1', baseDto)).rejects.toThrow(BadRequestException);
    });

    it('throws when comparePrice is below price', async () => {
      mockPrisma.shop.findFirst.mockResolvedValue({ id: 'shop-1' });
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-sub', parentId: 'parent' });
      await expect(
        service.create('seller-1', { ...baseDto, comparePrice: 50000 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates product for valid seller payload', async () => {
      mockPrisma.shop.findFirst.mockResolvedValue({ id: 'shop-1' });
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-sub', parentId: 'parent' });
      mockPrisma.product.create.mockResolvedValue({
        id: 'p-new',
        title: baseDto.title,
        shop: { name: 'Shop' },
      });

      const result = await service.create('seller-1', baseDto);
      expect(result.id).toBe('p-new');
      expect(mockPrisma.product.create).toHaveBeenCalled();
      expect(mockNotifications.createForAdmins).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns paginated list with default sort', async () => {
      mockPrisma.product.findMany.mockResolvedValue([{ id: 'p1', reviews: [] }]);
      mockPrisma.product.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10, sortBy: 'createdAt' });
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('resolves categorySlug filter', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      mockPrisma.product.findMany.mockResolvedValue([]);
      mockPrisma.product.count.mockResolvedValue(0);

      await service.findAll({ categorySlug: 'elektronika-telefonlar' });
      expect(mockPrisma.category.findUnique).toHaveBeenCalledWith({ where: { slug: 'elektronika-telefonlar' } });
    });
  });
});
