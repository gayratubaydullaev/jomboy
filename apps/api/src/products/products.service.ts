import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductFilterDto } from './dto/product-filter.dto';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { parseProductNum, validateOptionsAndVariants } from './product-variants.util';
import { ProductQueryService } from './product-query.service';
import { normalizePagination, paginatedResponse, emptyPaginatedResponse } from '@myshopuz/shared';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private telegram: TelegramService,
    private notifications: NotificationsService,
    private productQuery: ProductQueryService,
  ) {}

  async create(sellerId: string, dto: CreateProductDto) {
    const shop = await this.prisma.shop.findFirst({ where: { userId: sellerId } });
    if (!shop) throw new ForbiddenException('Shop not found');
    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    if (!category) throw new NotFoundException('Category not found');
    if (category.parentId == null) {
      throw new BadRequestException('Mahsulot faqat ostkategoriyaga biriktirilishi mumkin');
    }
    if (dto.comparePrice != null && dto.comparePrice < dto.price) {
      throw new BadRequestException(
        'Solishtirish narxi (eski narx) joriy narxdan kam boК»lishi mumkin emas. SunКјiy chegirma yaratish taqiqlanadi.',
      );
    }
    const slug = dto.slug ?? dto.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const hasVariants = dto.variants?.length;
    if (hasVariants && dto.options && Object.keys(dto.options).length > 0) {
      validateOptionsAndVariants(dto.options, dto.variants!);
    }
    const totalStock = hasVariants
      ? dto.variants!.reduce((s, v) => s + (v.stock ?? 0), 0)
      : (dto.stock ?? 0);
    const product = await this.prisma.product.create({
      data: {
        title: dto.title,
        slug,
        description: dto.description,
        price: new Decimal(dto.price),
        comparePrice: dto.comparePrice != null ? new Decimal(dto.comparePrice) : null,
        stock: totalStock,
        sku: hasVariants ? undefined : dto.sku,
        categoryId: dto.categoryId,
        shopId: shop.id,
        options: dto.options ?? undefined,
        specs: dto.specs ?? undefined,
        unit: dto.unit?.trim() || undefined,
        images: dto.imageUrls?.length
          ? { create: dto.imageUrls.map((url, i) => ({ url, sortOrder: i })) }
          : undefined,
      },
      include: { images: true, category: true, variants: true, shop: { select: { name: true } } },
    });
    this.telegram.sendAdminPendingProductNotification(product).catch(() => {});
    this.notifications
      .createForAdmins({
        type: 'PENDING_PRODUCT',
        title: 'Yangi tovar вЂ” moderatsiya',
        body: product.title,
        link: '/admin/products',
        entityId: product.id,
      })
      .catch(() => {});
    if (hasVariants) {
      await this.prisma.productVariant.createMany({
        data: dto.variants!.map((v) => ({
          productId: product.id,
          options: v.options,
          stock: v.stock ?? 0,
          imageUrl: v.imageUrl ?? null,
          sku: v.sku ?? null,
          priceOverride: v.priceOverride != null ? new Decimal(v.priceOverride) : null,
        })),
      });
      const updated = await this.prisma.product.findUniqueOrThrow({
        where: { id: product.id },
        include: { images: true, category: true, variants: true, shop: { select: { name: true } } },
      });
      return updated;
    }
    return product;
  }

  findAll(filters: ProductFilterDto) {
    return this.productQuery.findAll(filters);
  }

  async findShopBySlug(slug: string) {
    const shop = await this.prisma.shop.findFirst({
      where: { slug, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        legalType: true,
        legalName: true,
        ogrn: true,
        inn: true,
      },
    });
    if (!shop) throw new NotFoundException('Shop not found');
    return shop;
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, isActive: true, isModerated: true },
      include: { images: true, category: true, shop: true, variants: true, reviews: { where: { isModerated: true }, include: { user: { select: { firstName: true, lastName: true } } } } },
    });
    if (!product) throw new NotFoundException('Product not found');
    const reviewsCount = product.reviews.length;
    const avgRating = reviewsCount ? Math.round((product.reviews.reduce((s, r) => s + r.rating, 0) / reviewsCount) * 10) / 10 : null;
    const platform = await this.prisma.platformSettings.findFirst({ select: { chatWithSellerEnabled: true } });
    const chatWithSellerEnabled = platform?.chatWithSellerEnabled ?? true;
    return { ...product, reviewsCount, avgRating, chatWithSellerEnabled };
  }

  async findBySlug(shopSlug: string, productSlug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug: productSlug, shop: { slug: shopSlug }, isActive: true, isModerated: true },
      include: { images: true, category: true, shop: true, variants: true, reviews: { where: { isModerated: true }, include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async update(id: string, sellerId: string, dto: UpdateProductDto) {
    const product = await this.prisma.product.findFirst({
      where: { id, shop: { userId: sellerId } },
      include: { shop: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (dto.categoryId != null) {
      const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
      if (!category) throw new NotFoundException('Category not found');
      if (category.parentId == null) {
        throw new BadRequestException('Mahsulot faqat ostkategoriyaga biriktirilishi mumkin');
      }
    }
    const { imageUrls, variants, ...rest } = dto as UpdateProductDto & { variants?: Array<{ options: Record<string, string>; stock: number; imageUrl?: string; sku?: string; priceOverride?: number }> };
    const currentPrice = rest.price != null ? Number(rest.price) : Number(product.price);
    if (rest.comparePrice != null && rest.comparePrice < currentPrice) {
      throw new BadRequestException(
        'Solishtirish narxi (eski narx) joriy narxdan kam boК»lishi mumkin emas. SunКјiy chegirma yaratish taqiqlanadi.',
      );
    }
    const data: Prisma.ProductUpdateInput = { ...rest };
    if (rest.price != null) data.price = new Decimal(rest.price);
    if (rest.comparePrice != null) data.comparePrice = new Decimal(rest.comparePrice);
    if (rest.specs !== undefined) data.specs = rest.specs ?? Prisma.JsonNull;
    if ((rest as { unit?: string }).unit !== undefined) data.unit = (rest as { unit?: string }).unit?.trim() || null;
    if (imageUrls !== undefined) {
      await this.prisma.productImage.deleteMany({ where: { productId: id } });
      data.images = imageUrls?.length
        ? { create: imageUrls.map((url, i) => ({ url, sortOrder: i })) }
        : undefined;
    }
    if (variants !== undefined) {
      const optionsForValidate = (rest.options ?? product?.options) as Record<string, string[]> | undefined;
      if (variants.length > 0 && optionsForValidate && Object.keys(optionsForValidate).length > 0) {
        validateOptionsAndVariants(optionsForValidate, variants);
      }
      await this.prisma.productVariant.deleteMany({ where: { productId: id } });
      if (variants.length > 0) {
        const totalStock = variants.reduce((s, v) => s + (v.stock ?? 0), 0);
        data.stock = totalStock;
        await this.prisma.productVariant.createMany({
          data: variants.map((v) => ({
            productId: id,
            options: v.options,
            stock: v.stock ?? 0,
            imageUrl: v.imageUrl ?? null,
            sku: v.sku ?? null,
            priceOverride: v.priceOverride != null ? new Decimal(v.priceOverride) : null,
          })),
        });
      }
    }
    return this.prisma.product.update({ where: { id }, data, include: { images: true, category: true, variants: true } });
  }

  async remove(id: string, sellerId: string) {
    const product = await this.prisma.product.findFirst({ where: { id, shop: { userId: sellerId } } });
    if (!product) throw new NotFoundException('Product not found');
    await this.prisma.product.update({ where: { id }, data: { isActive: false } });
    return { success: true };
  }

  async getSellerProducts(sellerId: string, page = 1, limit = 20) {
    const shop = await this.prisma.shop.findFirst({ where: { userId: sellerId } });
    if (!shop) return emptyPaginatedResponse(limit);
    const { page: p, limit: take, skip } = normalizePagination(page, limit);
    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where: { shopId: shop.id },
        skip,
        take,
        include: { images: true, category: true },
      }),
      this.prisma.product.count({ where: { shopId: shop.id } }),
    ]);
    const data = rows.map((row) => ({
      ...row,
      price: row.price.toString(),
      comparePrice: row.comparePrice != null ? row.comparePrice.toString() : null,
    }));
    return paginatedResponse(data, total, p, take);
  }

  async getSellerProductById(id: string, sellerId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, shop: { userId: sellerId } },
      include: { images: true, category: true, variants: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }
}
