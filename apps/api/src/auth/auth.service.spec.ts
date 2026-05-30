import { createHash } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from '../mailer/mailer.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;

  const mockUser = { id: '1', email: 'test@test.com', passwordHash: '$2b$10$xxx', role: 'BUYER', isBlocked: false };
  const mockPrisma = {
    user: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    refreshToken: { create: jest.fn(), findUnique: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
    otpCode: { deleteMany: jest.fn(), create: jest.fn(), findFirst: jest.fn() },
  };
  const mockMailer = { sendMail: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('token') } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: MailerService, useValue: mockMailer },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('stores SHA-256 hash of refresh token, not plaintext', async () => {
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});
      await service.login({ id: '1', email: 'test@test.com', role: 'BUYER' });
      const createCall = (prisma.refreshToken.create as jest.Mock).mock.calls[0][0];
      const stored = createCall.data.token as string;
      expect(stored).toHaveLength(64);
      expect(stored).not.toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
    });
  });

  describe('refresh', () => {
    it('looks up refresh token by hash', async () => {
      const raw = 'raw-refresh-token-uuid-example';
      const hash = createHash('sha256').update(raw).digest('hex');
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'rt-1',
        token: hash,
        expiresAt: new Date(Date.now() + 86400000),
        user: mockUser,
      });
      (prisma.refreshToken.delete as jest.Mock).mockResolvedValue({});
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});
      await service.refresh(raw);
      expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { token: hash },
        include: { user: true },
      });
    });
  });

  describe('validateUser', () => {
    it('should return null if user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      const result = await service.validateUser('a@a.com', 'pass');
      expect(result).toBeNull();
    });

    it('should return null if password invalid', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      const result = await service.validateUser('test@test.com', 'wrong');
      expect(result).toBeNull();
    });
  });
});
