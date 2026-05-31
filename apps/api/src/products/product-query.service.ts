import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductFilterDto } from './dto/product-filter.dto';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const LIST_INCLUDE = {
  images: true,
  category: true,
  shop: { select: { name: true, slug: true } },
  variants: true,
  reviews: { where: { isModerated: true }, select: { rating: true } },
} as const;

type ProductListRow = Prisma.ProductGetPayload<{ include: typeof LIST_INCLUDE }>;

@Injectable()
export class ProductQueryService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters: ProductFilterDto) {
    const where: Prisma.ProductWhereInput = { isActive: true, isModerated: true, stock: { gt: 0 } };
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.categorySlug) {
      const cat = await this.prisma.category.findUnique({ where: { slug: filters.categorySlug } });
      if (cat) where.categoryId = cat.id;
    }
    if (filters.shopSlug) where.shop = { slug: filters.shopSlug };
    if (filters.minPrice != null || filters.maxPrice != null) {
      where.price = {};
      if (filters.minPrice != null) (where.price as Prisma.DecimalFilter).gte = new Decimal(filters.minPrice);
      if (filters.maxPrice != null) (where.price as Prisma.DecimalFilter).lte = new Decimal(filters.maxPrice);
    }
    const searchQuery = filters.search?.trim().replace(/\s+/g, ' ').slice(0, 200) || undefined;
    if (searchQuery) {
      const words = searchQuery.split(/\s+/).filter(Boolean);
      const existingAnd = where.AND;
      const andArray: Prisma.ProductWhereInput[] = Array.isArray(existingAnd) ? existingAnd : existingAnd ? [existingAnd] : [];
      const searchConditions: Prisma.ProductWhereInput[] = words.map((word) => ({
        OR: [
          { title: { contains: word, mode: 'insensitive' as const } },
          { description: { contains: word, mode: 'insensitive' as const } },
          { slug: { contains: word, mode: 'insensitive' as const } },
          { sku: { contains: word, mode: 'insensitive' as const } },
        ],
      }));
      where.AND = [...andArray, ...searchConditions];
    }

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    if (filters.sortBy === 'random') {
      const total = await this.prisma.product.count({
        where: { isActive: true, isModerated: true, stock: { gt: 0 }, category: { parentId: { not: null } } },
      });
      const seed = filters.seed ?? String(Date.now());
      const idsResult = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT p.id FROM "products" p
        INNER JOIN "categories" c ON p."category_id" = c.id
        WHERE p."is_active" = true AND p."is_moderated" = true AND p.stock > 0
        AND c."parent_id" IS NOT NULL
        ORDER BY md5(p.id || ${seed})
        LIMIT ${limit} OFFSET ${skip}
      `;
      const ids = idsResult.map((r) => r.id);
      if (ids.length === 0) {
        return { data: [], total, page, limit, totalPages: Math.ceil(total / limit) };
      }
      const products = await this.prisma.product.findMany({
        where: { id: { in: ids } },
        include: LIST_INCLUDE,
      });
      const orderMap = new Map(ids.map((id, i) => [id, i]));
      products.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
      return {
        data: this.mapWithReviewStats(products),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }

    const useRelevance = searchQuery && (filters.sortBy === 'relevance' || (!filters.sortBy && searchQuery));
    const orderBy: Prisma.ProductOrderByWithRelationInput = {};
    if (filters.sortBy === 'price') orderBy.price = filters.sortOrder ?? 'asc';
    else if (filters.sortBy === 'createdAt') orderBy.createdAt = filters.sortOrder ?? 'desc';
    else if (!useRelevance) orderBy.createdAt = 'desc';

    let rows: ProductListRow[];
    let total: number;
    if (useRelevance) {
      const escapeLike = (s: string) => s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
      const fullPattern = `%${escapeLike(searchQuery!)}%`;
      const conditions: Prisma.Sql[] = [
        Prisma.sql`p.is_active = true`,
        Prisma.sql`p.is_moderated = true`,
        Prisma.sql`p.stock > 0`,
      ];
      if (where.categoryId) conditions.push(Prisma.sql`p.category_id = ${where.categoryId as string}`);
      if (where.shop) conditions.push(Prisma.sql`p.shop_id IN (SELECT id FROM shops WHERE slug = ${(where.shop as { slug: string }).slug})`);
      if (where.price) {
        const price = where.price as Prisma.DecimalFilter;
        if (price.gte != null) conditions.push(Prisma.sql`p.price >= ${price.gte}`);
        if (price.lte != null) conditions.push(Prisma.sql`p.price <= ${price.lte}`);
      }
      const words = searchQuery!.split(/\s+/).filter(Boolean);
      for (const word of words) {
        const pat = `%${escapeLike(word)}%`;
        conditions.push(
          Prisma.sql`(p.title ILIKE ${pat} OR p.description ILIKE ${pat} OR p.slug ILIKE ${pat} OR (p.sku IS NOT NULL AND p.sku ILIKE ${pat}))`,
        );
      }
      const [idsResult, totalCount] = await Promise.all([
        this.prisma.$queryRaw<{ id: string }[]>`
          SELECT p.id FROM products p
          WHERE ${Prisma.join(conditions, ' AND ')}
          ORDER BY (p.title ILIKE ${fullPattern}) DESC, (p.description ILIKE ${fullPattern}) DESC, p.created_at DESC
          LIMIT ${limit} OFFSET ${skip}
        `,
        this.prisma.product.count({ where }),
      ]);
      total = totalCount;
      const ids = idsResult.map((r) => r.id);
      if (ids.length === 0) {
        return { data: [], total, page, limit, totalPages: Math.ceil(total / limit) };
      }
      rows = await this.prisma.product.findMany({
        where: { id: { in: ids } },
        include: LIST_INCLUDE,
      });
      const orderMap = new Map(ids.map((id, i) => [id, i]));
      rows.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
    } else {
      const [rowsList, totalCount] = await Promise.all([
        this.prisma.product.findMany({
          where,
          orderBy,
          skip,
          take: limit,
          include: LIST_INCLUDE,
        }),
        this.prisma.product.count({ where }),
      ]);
      rows = rowsList;
      total = totalCount;
    }

    return {
      data: this.mapWithReviewStats(rows),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private mapWithReviewStats(rows: ProductListRow[]) {
    return rows.map((p) => {
      const { reviews, ...rest } = p;
      const count = reviews.length;
      const avgRating = count ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : null;
      return { ...rest, reviewsCount: count, avgRating };
    });
  }
}
