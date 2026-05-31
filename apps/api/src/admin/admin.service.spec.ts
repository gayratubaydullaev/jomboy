import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { AdminService } from './admin.service';
import { AdminUsersService } from './admin-users.service';
import { AdminSellersService } from './admin-sellers.service';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { BannersService } from '../banners/banners.service';

describe('AdminService', () => {
  let service: AdminService;
  const mockPrisma = {
    user: { update: jest.fn() },
    product: { update: jest.fn() },
    $transaction: jest.fn(),
  };
  const mockTelegram = {};
  const mockBanners = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        AdminUsersService,
        AdminSellersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TelegramService, useValue: mockTelegram },
        { provide: BannersService, useValue: mockBanners },
      ],
    }).compile();

    service = module.get(AdminService);
    jest.clearAllMocks();
  });

  describe('blockUser', () => {
    it('prevents admin from blocking themselves', async () => {
      await expect(service.blockUser('admin-1', true, 'admin-1')).rejects.toThrow(BadRequestException);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('updates isBlocked for other users', async () => {
      mockPrisma.user.update.mockResolvedValue({ id: 'user-2', isBlocked: true });
      const result = await service.blockUser('user-2', true, 'admin-1');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-2' },
        data: { isBlocked: true },
      });
      expect(result.isBlocked).toBe(true);
    });
  });

  describe('setRole', () => {
    it('requires caller to be ADMIN', async () => {
      await expect(service.setRole('user-2', UserRole.SELLER, 'mod-1', UserRole.ADMIN_MODERATOR)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('prevents admin from demoting themselves', async () => {
      await expect(service.setRole('admin-1', UserRole.BUYER, 'admin-1', UserRole.ADMIN)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects invalid role values', async () => {
      await expect(service.setRole('user-2', 'INVALID' as UserRole, 'admin-1', UserRole.ADMIN)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('updates role for valid requests', async () => {
      mockPrisma.user.update.mockResolvedValue({ id: 'user-2', role: UserRole.SELLER });
      const result = await service.setRole('user-2', UserRole.SELLER, 'admin-1', UserRole.ADMIN);
      expect(mockPrisma.user.update).toHaveBeenCalled();
      expect(result.role).toBe(UserRole.SELLER);
    });
  });

  describe('moderateProduct', () => {
    it('sets isModerated according to approve flag', async () => {
      mockPrisma.product.update.mockResolvedValue({ id: 'p1', isModerated: true });
      const approved = await service.moderateProduct('p1', true);
      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { isModerated: true },
      });
      expect(approved.isModerated).toBe(true);

      mockPrisma.product.update.mockResolvedValue({ id: 'p2', isModerated: false });
      const rejected = await service.moderateProduct('p2', false);
      expect(rejected.isModerated).toBe(false);
    });
  });
});
