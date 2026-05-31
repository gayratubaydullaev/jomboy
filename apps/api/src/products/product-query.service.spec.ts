import { Test, TestingModule } from '@nestjs/testing';
import { ProductQueryService } from './product-query.service';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('ProductQueryService', () => {
  let service: ProductQueryService;
  const mockPrisma = {
    category: { findUnique: jest.fn() },
    product: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductQueryService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(ProductQueryService);
    jest.clearAllMocks();
  });

  it('returns paginated list with review stats (default sort)', async () => {
    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: 'p1',
        title: 'Phone',
        reviews: [{ rating: 5 }, { rating: 3 }],
      },
    ]);
    mockPrisma.product.count.mockResolvedValue(1);

    const result = await service.findAll({ page: 1, limit: 10, sortBy: 'createdAt' });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].reviewsCount).toBe(2);
    expect(result.data[0].avgRating).toBe(4);
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it('resolves categorySlug to categoryId filter', async () => {
    mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.product.count.mockResolvedValue(0);

    await service.findAll({ categorySlug: 'phones' });
    expect(mockPrisma.category.findUnique).toHaveBeenCalledWith({ where: { slug: 'phones' } });
    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ categoryId: 'cat-1' }),
      }),
    );
  });

  it('uses relevance SQL path when search without explicit sort', async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([{ id: 'p-search' }]);
    mockPrisma.product.count.mockResolvedValue(1);
    mockPrisma.product.findMany.mockResolvedValue([{ id: 'p-search', reviews: [{ rating: 4 }] }]);

    const result = await service.findAll({ search: 'iphone 15' });
    expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    expect(result.data).toHaveLength(1);
    expect(result.data[0].avgRating).toBe(4);
  });

  it('returns empty page when relevance search finds no ids', async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([]);
    mockPrisma.product.count.mockResolvedValue(0);

    const result = await service.findAll({ search: 'missing-product', sortBy: 'relevance' });
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
    expect(mockPrisma.product.findMany).not.toHaveBeenCalled();
  });

  it('handles random sort via raw query and preserves order', async () => {
    mockPrisma.product.count.mockResolvedValue(2);
    mockPrisma.$queryRaw.mockResolvedValueOnce([{ id: 'p2' }, { id: 'p1' }]);
    mockPrisma.product.findMany.mockResolvedValue([
      { id: 'p1', reviews: [] },
      { id: 'p2', reviews: [{ rating: 5 }] },
    ]);

    const result = await service.findAll({ sortBy: 'random', seed: 'test-seed', limit: 2, page: 1 });
    expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    expect(result.data[0].id).toBe('p2');
    expect(result.data[0].reviewsCount).toBe(1);
    expect(result.data[1].id).toBe('p1');
    expect(result.data[1].reviewsCount).toBe(0);
  });

  it('returns empty random page when no ids match', async () => {
    mockPrisma.product.count.mockResolvedValue(5);
    mockPrisma.$queryRaw.mockResolvedValueOnce([]);

    const result = await service.findAll({ sortBy: 'random', page: 1, limit: 10 });
    expect(result.data).toEqual([]);
    expect(result.total).toBe(5);
    expect(result.totalPages).toBe(1);
  });

  it('applies price sort and min/max filters', async () => {
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.product.count.mockResolvedValue(0);

    await service.findAll({ sortBy: 'price', sortOrder: 'asc', minPrice: 1000, maxPrice: 50000 });
    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { price: 'asc' },
        where: expect.objectContaining({
          price: expect.objectContaining({
            gte: expect.any(Decimal),
            lte: expect.any(Decimal),
          }),
        }),
      }),
    );
  });

  it('includes shop and price filters in relevance SQL path', async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([{ id: 'p-shop' }]);
    mockPrisma.product.count.mockResolvedValue(1);
    mockPrisma.product.findMany.mockResolvedValue([{ id: 'p-shop', reviews: [] }]);

    await service.findAll({
      search: 'case',
      shopSlug: 'my-shop',
      minPrice: 5000,
      maxPrice: 100000,
    });

    expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    expect(mockPrisma.product.findMany).toHaveBeenCalled();
  });
});
