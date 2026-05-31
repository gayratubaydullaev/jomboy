import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { BannersService } from '../banners/banners.service';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { AdminUsersService } from './admin-users.service';
import { AdminSellersService } from './admin-sellers.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private prisma: PrismaService,
    private telegram: TelegramService,
    private banners: BannersService,
    private users: AdminUsersService,
    private sellers: AdminSellersService,
  ) {}

  getUsers(req: Request, page = 1, limit = 20, role?: UserRole) {
    return this.users.getUsers(req, page, limit, role);
  }

  getUserById(req: Request, id: string) {
    return this.users.getUserById(req, id);
  }

  blockUser(userId: string, block: boolean, callerId: string) {
    return this.users.blockUser(userId, block, callerId);
  }

  setRole(userId: string, role: UserRole, callerId: string, callerRole: UserRole) {
    return this.users.setRole(userId, role, callerId, callerRole);
  }

  setModeratorPermissions(
    userId: string,
    callerRole: UserRole,
    permissions: { canModerateProducts?: boolean; canModerateReviews?: boolean; canApproveSellerApplications?: boolean; canApproveShopUpdates?: boolean },
  ) {
    return this.users.setModeratorPermissions(userId, callerRole, permissions);
  }

  async getCategories() {
    return this.prisma.category.findMany({
      where: { parentId: null },
      include: { children: { orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(data: { name: string; slug: string; description?: string; parentId?: string }) {
    return this.prisma.category.create({ data });
  }

  async updateCategory(id: string, data: { name?: string; slug?: string; description?: string }) {
    return this.prisma.category.update({ where: { id }, data });
  }

  async deleteCategory(id: string) {
    return this.prisma.category.delete({ where: { id } });
  }

  async getProductsForModeration(page = 1, limit = 20, isModerated?: boolean) {
    const where = isModerated !== undefined ? { isModerated, isActive: true } : { isActive: true };
    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { images: true, category: true, shop: { select: { name: true } } },
      }),
      this.prisma.product.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async moderateProduct(productId: string, approve: boolean) {
    return this.prisma.product.update({
      where: { id: productId },
      data: { isModerated: approve },
    });
  }

  async getOrders(req: Request, page = 1, limit = 20) {
    const user = req.user as { id: string; role: string } | undefined;
    const userId = user?.id ? String(user.id) : null;
    const roleStr = user?.role ? String(user.role) : null;
    const skip = Math.max(0, (Number(page) || 1) - 1) * Math.max(1, Math.min(100, Number(limit) || 20));
    const take = Math.max(1, Math.min(100, Number(limit) || 20));

    return this.prisma.$transaction(async (tx) => {
      if (userId) await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
      if (roleStr) await tx.$executeRaw`SELECT set_config('app.user_role', ${roleStr}, true)`;
      const [data, total] = await Promise.all([
        tx.order.findMany({
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          include: { buyer: { select: { firstName: true, lastName: true } }, seller: { select: { firstName: true } }, items: true },
        }),
        tx.order.count(),
      ]);
      return { data, total, page: Math.max(1, Number(page) || 1), limit: take, totalPages: Math.ceil(total / take) };
    });
  }

  async getStats() {
    const [
      usersCount,
      productsCount,
      ordersCount,
      paidOrdersCount,
      totalRevenue,
      pendingProductsCount,
      pendingReviewsCount,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.product.count({ where: { isActive: true } }),
      this.prisma.order.count(),
      this.prisma.order.count({ where: { paymentStatus: 'PAID' } }),
      this.prisma.order.aggregate({ _sum: { totalAmount: true }, where: { paymentStatus: 'PAID' } }),
      this.prisma.product.count({ where: { isActive: true, isModerated: false } }),
      this.prisma.review.count({ where: { isModerated: false } }),
    ]);
    return {
      usersCount,
      productsCount,
      ordersCount,
      paidOrdersCount,
      totalRevenue: totalRevenue._sum.totalAmount?.toString() ?? '0',
      pendingProductsCount,
      pendingReviewsCount,
    };
  }

  async getSalesChart(days = 30): Promise<{ date: string; total: number; ordersCount: number }[]> {
    const n = Math.min(90, Math.max(1, Number(days) || 30));
    const to = new Date();
    to.setUTCHours(23, 59, 59, 999);
    const from = new Date(to);
    from.setDate(from.getDate() - n);
    from.setUTCHours(0, 0, 0, 0);
    const orders = await this.prisma.order.findMany({
      where: { paymentStatus: 'PAID', createdAt: { gte: from, lte: to } },
      select: { totalAmount: true, createdAt: true },
    });
    const byDay = new Map<string, { total: number; ordersCount: number }>();
    for (const o of orders) {
      const d = o.createdAt.toISOString().slice(0, 10);
      const cur = byDay.get(d) ?? { total: 0, ordersCount: 0 };
      cur.total += Number(o.totalAmount);
      cur.ordersCount += 1;
      byDay.set(d, cur);
    }
    const result: { date: string; total: number; ordersCount: number }[] = [];
    const cursor = new Date(from);
    while (cursor <= to) {
      const d = cursor.toISOString().slice(0, 10);
      const v = byDay.get(d) ?? { total: 0, ordersCount: 0 };
      result.push({ date: d, total: v.total, ordersCount: v.ordersCount });
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }

  async getPlatformSettings() {
    const settings = await this.prisma.platformSettings.findFirst();
    if (!settings) {
      return this.prisma.platformSettings.create({
        data: {
          commissionRate: 5,
          minPayoutAmount: 100000,
          paymentClickEnabled: true,
          paymentPaymeEnabled: true,
          paymentCashEnabled: true,
          paymentCardOnDeliveryEnabled: true,
          deliveryEnabled: true,
          pickupEnabled: true,
          chatWithSellerEnabled: true,
        },
      });
    }
    return settings;
  }

  async updatePlatformSettings(data: {
    siteName?: string | null;
    commissionRate?: number;
    minPayoutAmount?: number;
    paymentClickEnabled?: boolean;
    paymentPaymeEnabled?: boolean;
    paymentCashEnabled?: boolean;
    paymentCardOnDeliveryEnabled?: boolean;
    deliveryEnabled?: boolean;
    pickupEnabled?: boolean;
    chatWithSellerEnabled?: boolean;
    adminTelegramChatId?: string | null;
  }) {
    const settings = await this.prisma.platformSettings.findFirst();
    if (!settings) {
      return this.prisma.platformSettings.create({
        data: {
          commissionRate: data.commissionRate ?? 5,
          minPayoutAmount: data.minPayoutAmount ?? 100000,
          paymentClickEnabled: data.paymentClickEnabled ?? true,
          paymentPaymeEnabled: data.paymentPaymeEnabled ?? true,
          paymentCashEnabled: data.paymentCashEnabled ?? true,
          paymentCardOnDeliveryEnabled: data.paymentCardOnDeliveryEnabled ?? true,
          deliveryEnabled: data.deliveryEnabled ?? true,
          pickupEnabled: data.pickupEnabled ?? true,
          chatWithSellerEnabled: data.chatWithSellerEnabled ?? true,
        },
      });
    }
    return this.prisma.platformSettings.update({
      where: { id: settings.id },
      data: {
        ...(data.siteName !== undefined && { siteName: data.siteName?.trim() || null }),
        ...(data.commissionRate != null && { commissionRate: data.commissionRate }),
        ...(data.minPayoutAmount != null && { minPayoutAmount: data.minPayoutAmount }),
        ...(data.paymentClickEnabled != null && { paymentClickEnabled: data.paymentClickEnabled }),
        ...(data.paymentPaymeEnabled != null && { paymentPaymeEnabled: data.paymentPaymeEnabled }),
        ...(data.paymentCashEnabled != null && { paymentCashEnabled: data.paymentCashEnabled }),
        ...(data.paymentCardOnDeliveryEnabled != null && { paymentCardOnDeliveryEnabled: data.paymentCardOnDeliveryEnabled }),
        ...(data.deliveryEnabled != null && { deliveryEnabled: data.deliveryEnabled }),
        ...(data.pickupEnabled != null && { pickupEnabled: data.pickupEnabled }),
        ...(data.chatWithSellerEnabled != null && { chatWithSellerEnabled: data.chatWithSellerEnabled }),
        ...(data.adminTelegramChatId !== undefined && {
          adminTelegramChatId: data.adminTelegramChatId?.trim() || null,
        }),
      },
    });
  }

  async linkTelegram(code: string): Promise<{ ok: boolean }> {
    const chatId = await this.telegram.resolveLinkCode(code);
    if (!chatId) throw new BadRequestException('Kod notoʻgʻri yoki muddati tugagan. Botda /start yoki /link yuboring.');
    let settings = await this.prisma.platformSettings.findFirst();
    if (!settings) {
      settings = await this.prisma.platformSettings.create({
        data: {
          commissionRate: 5,
          minPayoutAmount: 100000,
          paymentClickEnabled: true,
          paymentPaymeEnabled: true,
          paymentCashEnabled: true,
          paymentCardOnDeliveryEnabled: true,
          deliveryEnabled: true,
          pickupEnabled: true,
          chatWithSellerEnabled: true,
        },
      });
    }
    await this.prisma.platformSettings.update({
      where: { id: settings.id },
      data: { adminTelegramChatId: chatId },
    });
    return { ok: true };
  }

  async getTelegramStatus(): Promise<{ connected: boolean; adminTelegramChatId?: string | null }> {
    const chatId = await this.telegram.getAdminChatId();
    return { connected: !!chatId, adminTelegramChatId: chatId ?? null };
  }

  async disconnectTelegram(): Promise<{ ok: boolean }> {
    const settings = await this.prisma.platformSettings.findFirst();
    if (!settings) return { ok: true };
    await this.prisma.platformSettings.update({
      where: { id: settings.id },
      data: { adminTelegramChatId: null },
    });
    return { ok: true };
  }

  getSellers(req: Request, page = 1, limit = 20) {
    return this.sellers.getSellers(req, page, limit);
  }

  getPayouts(req: Request, page = 1, limit = 20) {
    return this.sellers.getPayouts(req, page, limit);
  }

  recordPayout(sellerId: string, amount: number, method: string, paidAt?: Date, note?: string) {
    return this.sellers.recordPayout(sellerId, amount, method, paidAt, note);
  }

  setSellerCommissionRate(sellerId: string, commissionRate: number | null) {
    return this.sellers.setSellerCommissionRate(sellerId, commissionRate);
  }

  getSellerApplications(page = 1, limit = 20, status?: string) {
    return this.sellers.getSellerApplications(page, limit, status);
  }

  approveSellerApplication(applicationId: string, adminUserId: string) {
    return this.sellers.approveSellerApplication(applicationId, adminUserId);
  }

  rejectSellerApplication(applicationId: string, adminUserId: string, rejectReason?: string) {
    return this.sellers.rejectSellerApplication(applicationId, adminUserId, rejectReason);
  }

  getPendingShopUpdates(page = 1, limit = 20) {
    return this.sellers.getPendingShopUpdates(page, limit);
  }

  approvePendingShopUpdate(pendingId: string, adminUserId: string) {
    return this.sellers.approvePendingShopUpdate(pendingId, adminUserId);
  }

  rejectPendingShopUpdate(pendingId: string, adminUserId: string, rejectReason?: string) {
    return this.sellers.rejectPendingShopUpdate(pendingId, adminUserId, rejectReason);
  }

  async getBanners() {
    return this.prisma.banner.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async createBanner(data: {
    image: string;
    href: string;
    external?: boolean;
    title?: string;
    sortOrder?: number;
    displaySeconds?: number;
    startsAt?: string;
    endsAt?: string;
  }) {
    const result = await this.prisma.banner.create({
      data: {
        image: data.image,
        href: data.href,
        external: data.external ?? false,
        title: data.title ?? null,
        sortOrder: data.sortOrder ?? 0,
        displaySeconds: data.displaySeconds ?? null,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
      },
    });
    await this.banners.invalidateCache();
    return result;
  }

  async updateBanner(
    id: string,
    data: {
      image?: string;
      href?: string;
      external?: boolean;
      title?: string;
      sortOrder?: number;
      isActive?: boolean;
      displaySeconds?: number | null;
      startsAt?: string | null;
      endsAt?: string | null;
    },
  ) {
    const result = await this.prisma.banner.update({
      where: { id },
      data: {
        ...(data.image != null && { image: data.image }),
        ...(data.href != null && { href: data.href }),
        ...(data.external != null && { external: data.external }),
        ...(data.title != null && { title: data.title }),
        ...(data.sortOrder != null && { sortOrder: data.sortOrder }),
        ...(data.isActive != null && { isActive: data.isActive }),
        ...(data.displaySeconds !== undefined && { displaySeconds: data.displaySeconds }),
        ...(data.startsAt !== undefined && { startsAt: data.startsAt ? new Date(data.startsAt) : null }),
        ...(data.endsAt !== undefined && { endsAt: data.endsAt ? new Date(data.endsAt) : null }),
      },
    });
    await this.banners.invalidateCache();
    return result;
  }

  async deleteBanner(id: string) {
    const result = await this.prisma.banner.delete({ where: { id } });
    await this.banners.invalidateCache();
    return result;
  }

  async getReviews(page = 1, limit = 20, isModerated?: boolean) {
    const skip = Math.max(0, (Number(page) || 1) - 1) * Math.max(1, Math.min(100, Number(limit) || 20));
    const take = Math.max(1, Math.min(100, Number(limit) || 20));
    const where = isModerated !== undefined ? { isModerated } : {};
    const [data, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
          product: { select: { id: true, title: true } },
        },
      }),
      this.prisma.review.count({ where }),
    ]);
    return { data, total, page: Math.max(1, Number(page) || 1), limit: take, totalPages: Math.ceil(total / take) };
  }
}
