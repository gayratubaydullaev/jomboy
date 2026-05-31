import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, UserRole } from '@prisma/client';
import { normalizePagination, paginatedResponse } from '@myshopuz/shared';
import { Request } from 'express';

const VALID_ROLES: UserRole[] = ['ADMIN', 'ADMIN_MODERATOR', 'BUYER', 'SELLER'];

@Injectable()
export class AdminUsersService {
  constructor(private prisma: PrismaService) {}

  async getUsers(req: Request, page = 1, limit = 20, role?: UserRole) {
    const user = req.user as { id: string; role: string } | undefined;
    const userId = user?.id ? String(user.id) : null;
    const roleStr = user?.role ? String(user.role) : null;
    const filterRole = role && VALID_ROLES.includes(role) ? role : undefined;
    const where = filterRole ? { role: filterRole } : {};
    const { page: p, limit: take, skip } = normalizePagination(page, limit, 100);

    return this.prisma.$transaction(async (tx) => {
      if (userId) await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
      if (roleStr) await tx.$executeRaw`SELECT set_config('app.user_role', ${roleStr}, true)`;
      const [data, total] = await Promise.all([
        tx.user.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          select: { id: true, email: true, firstName: true, lastName: true, role: true, isBlocked: true, createdAt: true, moderatorPermissions: true },
        }),
        tx.user.count({ where }),
      ]);
      return paginatedResponse(data, total, p, take);
    });
  }

  async getUserById(req: Request, id: string) {
    const user = req.user as { id: string; role: string } | undefined;
    const userId = user?.id ? String(user.id) : null;
    const roleStr = user?.role ? String(user.role) : null;

    return this.prisma.$transaction(async (tx) => {
      if (userId) await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
      if (roleStr) await tx.$executeRaw`SELECT set_config('app.user_role', ${roleStr}, true)`;
      const u = await tx.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          isBlocked: true,
          emailVerified: true,
          avatarUrl: true,
          moderatorPermissions: true,
          createdAt: true,
          updatedAt: true,
          shop: { select: { id: true, name: true, slug: true, description: true, isActive: true } },
        },
      });
      if (!u) return null;
      if (u.role !== 'SELLER' || !u.shop) {
        return { ...u, productsCount: 0, ordersCount: 0, totalRevenue: '0' };
      }
      const [productsCount, paidOrders] = await Promise.all([
        tx.product.count({ where: { shopId: u.shop.id } }),
        tx.order.findMany({ where: { sellerId: id, paymentStatus: 'PAID' }, select: { totalAmount: true } }),
      ]);
      const totalRevenue = paidOrders.reduce((s, o) => s + Number(o.totalAmount), 0);
      return {
        ...u,
        productsCount,
        ordersCount: paidOrders.length,
        totalRevenue: String(totalRevenue),
      };
    });
  }

  async blockUser(userId: string, block: boolean, callerId: string) {
    if (userId === callerId && block) {
      throw new BadRequestException('O‘zingizni bloklay olmaysiz.');
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { isBlocked: block },
    });
  }

  async setRole(userId: string, role: UserRole, callerId: string, callerRole: UserRole) {
    if (callerRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Faqat bosh admin foydalanuvchi rolini o‘zgartirishi mumkin.');
    }
    if (!VALID_ROLES.includes(role)) {
      throw new BadRequestException('Noto‘g‘ri rol.');
    }
    if (userId === callerId && role !== UserRole.ADMIN) {
      throw new BadRequestException('O‘zingizga bosh admindan boshqa rol berib bo‘lmaydi (tizimdan chiqib ketasiz).');
    }
    const data: { role: UserRole; moderatorPermissions?: typeof Prisma.JsonNull } = { role };
    if (role !== UserRole.ADMIN_MODERATOR) {
      data.moderatorPermissions = Prisma.JsonNull;
    }
    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  async setModeratorPermissions(
    userId: string,
    callerRole: UserRole,
    permissions: { canModerateProducts?: boolean; canModerateReviews?: boolean; canApproveSellerApplications?: boolean; canApproveShopUpdates?: boolean },
  ) {
    if (callerRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Faqat bosh admin moderator huquqlarini o‘zgartirishi mumkin.');
    }
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, moderatorPermissions: true },
    });
    if (!target || target.role !== UserRole.ADMIN_MODERATOR) {
      throw new BadRequestException('Faqat moderator rolidagi foydalanuvchiga huquqlar beriladi.');
    }
    const current = (target.moderatorPermissions as Record<string, boolean> | null) ?? {};
    const data = (permissions as Record<string, unknown>) ?? {};
    const keys: (keyof typeof permissions)[] = ['canModerateProducts', 'canModerateReviews', 'canApproveSellerApplications', 'canApproveShopUpdates'];
    const merged = { ...current } as Record<string, boolean>;
    for (const k of keys) {
      if (data[k] === true || data[k] === false) merged[k] = data[k] as boolean;
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { moderatorPermissions: Object.keys(merged).length > 0 ? merged : Prisma.JsonNull },
    });
  }
}
