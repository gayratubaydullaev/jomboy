import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Request } from 'express';

@Injectable()
export class AdminSellersService {
  private readonly logger = new Logger(AdminSellersService.name);

  constructor(private prisma: PrismaService) {}

  async getSellers(req: Request, page = 1, limit = 20) {
    const user = req.user as { id: string; role: string } | undefined;
    const userId = user?.id ? String(user.id) : null;
    const roleStr = user?.role ? String(user.role) : null;
    const skip = Math.max(0, (Number(page) || 1) - 1) * Math.max(1, Math.min(100, Number(limit) || 20));
    const take = Math.max(1, Math.min(100, Number(limit) || 20));

    return this.prisma.$transaction(async (tx) => {
      if (userId) await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
      if (roleStr) await tx.$executeRaw`SELECT set_config('app.user_role', ${roleStr}, true)`;
      const [sellers, paidOrders, total] = await Promise.all([
        tx.user.findMany({
          where: { role: 'SELLER' },
          skip,
          take,
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            isBlocked: true,
            shop: { select: { id: true, name: true, slug: true, commissionRate: true } },
          },
        }),
        tx.order.findMany({
          where: { paymentStatus: 'PAID' },
          select: { sellerId: true, totalAmount: true },
        }),
        tx.user.count({ where: { role: 'SELLER' } }),
      ]);
      const revenueBySeller = new Map<string, { ordersCount: number; totalRevenue: number }>();
      for (const o of paidOrders) {
        const amt = Number(o.totalAmount);
        const cur = revenueBySeller.get(o.sellerId) ?? { ordersCount: 0, totalRevenue: 0 };
        cur.ordersCount += 1;
        cur.totalRevenue += amt;
        revenueBySeller.set(o.sellerId, cur);
      }
      const shopIds = sellers.map((s) => s.shop?.id).filter(Boolean) as string[];
      const productCounts = shopIds.length
        ? await tx.product.groupBy({ by: ['shopId'], _count: true, where: { shopId: { in: shopIds } } })
        : [];
      const countByShop = new Map(productCounts.map((p) => [p.shopId, p._count]));
      const data = sellers.map((s) => {
        const rev = revenueBySeller.get(s.id) ?? { ordersCount: 0, totalRevenue: 0 };
        const productsCount = s.shop ? (countByShop.get(s.shop.id) ?? 0) : 0;
        return {
          id: s.id,
          email: s.email,
          firstName: s.firstName,
          lastName: s.lastName,
          isBlocked: s.isBlocked,
          shop: s.shop,
          productsCount,
          ordersCount: rev.ordersCount,
          totalRevenue: String(rev.totalRevenue),
        };
      });
      return { data, total, page: Math.max(1, Number(page) || 1), limit: take, totalPages: Math.ceil(total / take) };
    });
  }

  async getPayouts(req: Request, page = 1, limit = 20) {
    const user = req.user as { id: string; role: string } | undefined;
    const userId = user?.id ? String(user.id) : null;
    const roleStr = user?.role ? String(user.role) : null;
    const take = Math.max(1, Math.min(100, Number(limit) || 20));
    const skip = (Math.max(1, Number(page) || 1) - 1) * take;

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (userId) await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
        if (roleStr) await tx.$executeRaw`SELECT set_config('app.user_role', ${roleStr}, true)`;
        const [orders, settings, records] = await Promise.all([
          tx.order.findMany({
            where: { paymentStatus: 'PAID' },
            select: {
              sellerId: true,
              totalAmount: true,
              seller: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  shop: { select: { commissionRate: true } },
                },
              },
            },
          }),
          tx.platformSettings.findFirst(),
          tx.payoutRecord.findMany({ select: { sellerId: true, amount: true } }),
        ]);
        const platformRate = settings ? Number(settings.commissionRate) / 100 : 0.05;
        const bySeller = new Map<string, { seller: { id: string; firstName: string; lastName: string; email: string }; total: number; commission: number; ordersCount: number }>();
        for (const o of orders) {
          const total = Number(o.totalAmount);
          const sellerRate = o.seller.shop?.commissionRate != null ? Number(o.seller.shop.commissionRate) / 100 : platformRate;
          const commission = total * sellerRate;
          const existing = bySeller.get(o.sellerId);
          if (existing) {
            existing.total += total;
            existing.commission += commission;
            existing.ordersCount += 1;
          } else {
            bySeller.set(o.sellerId, {
              seller: { id: o.seller.id, firstName: o.seller.firstName, lastName: o.seller.lastName, email: o.seller.email },
              total,
              commission,
              ordersCount: 1,
            });
          }
        }
        const totalPaidBySeller = new Map<string, number>();
        for (const r of records) {
          totalPaidBySeller.set(r.sellerId, (totalPaidBySeller.get(r.sellerId) ?? 0) + Number(r.amount));
        }
        const list = Array.from(bySeller.entries()).map(([sid, row]) => {
          const totalPaid = totalPaidBySeller.get(sid) ?? 0;
          const balance = row.commission - totalPaid;
          return { ...row, totalPaid, balance };
        });
        return {
          data: list.slice(skip, skip + take),
          total: list.length,
          page: Math.max(1, Number(page) || 1),
          limit: take,
          totalPages: Math.ceil(list.length / take),
        };
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`getPayouts failed: ${msg}`, err instanceof Error ? err.stack : undefined);
      if (/payout_records|commission_rate|does not exist|relation.*does not exist/i.test(msg)) {
        throw new HttpException(
          'Toʻlovlar uchun migratsiya kerak. apps/api da: pnpm exec prisma migrate deploy',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      throw new HttpException(
        { message: 'Toʻlovlar roʻyxati olinmadi', error: msg },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async recordPayout(sellerId: string, amount: number, method: string, paidAt?: Date, note?: string) {
    return this.prisma.payoutRecord.create({
      data: {
        sellerId,
        amount,
        method: method || 'CASH',
        paidAt: paidAt ?? new Date(),
        note: note ?? null,
      },
    });
  }

  async setSellerCommissionRate(sellerId: string, commissionRate: number | null) {
    const shop = await this.prisma.shop.findUnique({ where: { userId: sellerId } });
    if (!shop) throw new NotFoundException('Shop not found for this seller');
    return this.prisma.shop.update({
      where: { id: shop.id },
      data: commissionRate === null ? { commissionRate: null } : { commissionRate },
    });
  }

  async getSellerApplications(page = 1, limit = 20, status?: string) {
    const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Math.min(50, Number(limit) || 20));
    const take = Math.max(1, Math.min(50, Number(limit) || 20));
    const where = status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status) ? { status } : {};
    const [data, total] = await Promise.all([
      this.prisma.sellerApplication.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      }),
      this.prisma.sellerApplication.count({ where }),
    ]);
    return { data, total, page: Math.max(1, Number(page)), limit: take, totalPages: Math.ceil(total / take) };
  }

  async approveSellerApplication(applicationId: string, adminUserId: string) {
    const app = await this.prisma.sellerApplication.findUnique({
      where: { id: applicationId },
      include: { user: true },
    });
    if (!app) throw new BadRequestException('Ariza topilmadi.');
    if (app.status !== 'PENDING') throw new BadRequestException('Ariza allaqachon ko‘rib chiqilgan.');
    let slug = app.shopName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'shop';
    const existing = await this.prisma.shop.findUnique({ where: { slug } });
    if (existing) {
      let suffix = 1;
      while (await this.prisma.shop.findUnique({ where: { slug: `${slug}-${suffix}` } })) suffix += 1;
      slug = `${slug}-${suffix}`;
    }
    const appAny = app as { legalType?: string | null; legalName?: string | null; ogrn?: string | null; inn?: string | null; documentUrls?: string[] | null };
    await this.prisma.$transaction(async (tx) => {
      await tx.shop.create({
        data: {
          userId: app.userId,
          name: app.shopName,
          slug,
          description: app.description ?? null,
          legalType: appAny.legalType ?? undefined,
          legalName: appAny.legalName ?? undefined,
          ogrn: appAny.ogrn ?? undefined,
          inn: appAny.inn ?? undefined,
          documentUrls: Array.isArray(appAny.documentUrls) ? appAny.documentUrls : undefined,
        },
      });
      await tx.user.update({
        where: { id: app.userId },
        data: { role: 'SELLER' },
      });
      await tx.sellerApplication.update({
        where: { id: applicationId },
        data: { status: 'APPROVED', reviewedAt: new Date(), reviewedById: adminUserId },
      });
    });
    return { ok: true, message: 'Ariza qabul qilindi. Foydalanuvchi endi sotuvchi.' };
  }

  async rejectSellerApplication(applicationId: string, adminUserId: string, rejectReason?: string) {
    const app = await this.prisma.sellerApplication.findUnique({ where: { id: applicationId } });
    if (!app) throw new BadRequestException('Ariza topilmadi.');
    if (app.status !== 'PENDING') throw new BadRequestException('Ariza allaqachon ko‘rib chiqilgan.');
    await this.prisma.sellerApplication.update({
      where: { id: applicationId },
      data: { status: 'REJECTED', rejectReason: rejectReason ?? null, reviewedAt: new Date(), reviewedById: adminUserId },
    });
    return { ok: true, message: 'Ariza rad etildi.' };
  }

  async getPendingShopUpdates(page = 1, limit = 20) {
    const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Math.min(50, Number(limit) || 20));
    const take = Math.max(1, Math.min(50, Number(limit) || 20));
    const [data, total] = await Promise.all([
      this.prisma.pendingShopUpdate.findMany({
        where: { status: 'PENDING' },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { shop: { select: { id: true, name: true, slug: true, userId: true, user: { select: { email: true, firstName: true, lastName: true } } } } },
      }),
      this.prisma.pendingShopUpdate.count({ where: { status: 'PENDING' } }),
    ]);
    return { data, total, page: Math.max(1, Number(page)), limit: take, totalPages: Math.ceil(total / take) };
  }

  async approvePendingShopUpdate(pendingId: string, adminUserId: string) {
    const pending = await this.prisma.pendingShopUpdate.findUnique({
      where: { id: pendingId },
      include: { shop: true },
    });
    if (!pending) throw new BadRequestException('So‘rov topilmadi.');
    if (pending.status !== 'PENDING') throw new BadRequestException('So‘rov allaqachon ko‘rib chiqilgan.');
    const slugExists = await this.prisma.shop.findFirst({
      where: { slug: pending.requestedSlug, id: { not: pending.shopId } },
    });
    if (slugExists) throw new BadRequestException(`Slug "${pending.requestedSlug}" allaqachon band.`);
    const pendingAny = pending as {
      requestedLegalType?: string | null;
      requestedLegalName?: string | null;
      requestedOgrn?: string | null;
      requestedInn?: string | null;
      requestedDocumentUrls?: string[] | null;
    };
    await this.prisma.$transaction(async (tx) => {
      await tx.shop.update({
        where: { id: pending.shopId },
        data: {
          name: pending.requestedName,
          slug: pending.requestedSlug,
          description: pending.requestedDescription ?? undefined,
          legalType: pendingAny.requestedLegalType ?? undefined,
          legalName: pendingAny.requestedLegalName ?? undefined,
          ogrn: pendingAny.requestedOgrn ?? undefined,
          inn: pendingAny.requestedInn ?? undefined,
          documentUrls: pendingAny.requestedDocumentUrls ?? undefined,
        },
      });
      await tx.pendingShopUpdate.update({
        where: { id: pendingId },
        data: { status: 'APPROVED', reviewedAt: new Date(), reviewedById: adminUserId },
      });
    });
    return { ok: true, message: 'O‘zgarishlar qabul qilindi.' };
  }

  async rejectPendingShopUpdate(pendingId: string, adminUserId: string, rejectReason?: string) {
    const pending = await this.prisma.pendingShopUpdate.findUnique({ where: { id: pendingId } });
    if (!pending) throw new BadRequestException('So‘rov topilmadi.');
    if (pending.status !== 'PENDING') throw new BadRequestException('So‘rov allaqachon ko‘rib chiqilgan.');
    await this.prisma.pendingShopUpdate.update({
      where: { id: pendingId },
      data: { status: 'REJECTED', rejectReason: rejectReason ?? null, reviewedAt: new Date(), reviewedById: adminUserId },
    });
    return { ok: true, message: 'So‘rov rad etildi.' };
  }
}
