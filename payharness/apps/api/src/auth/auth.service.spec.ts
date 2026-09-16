import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { MerchantStatus, PlatformUserStatus, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

const bcryptHash = bcrypt.hash as jest.Mock;
const bcryptCompare = bcrypt.compare as jest.Mock;

describe('AuthService', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    platformUser: { findUnique: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  };
  const jwtService = { signAsync: jest.fn() };
  const auditLogs = { create: jest.fn() };
  const mailer = { send: jest.fn() };
  const service = new AuthService(
    prisma as never,
    jwtService as never,
    auditLogs as never,
    mailer as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    bcryptHash.mockResolvedValue('hashed-password');
    bcryptCompare.mockResolvedValue(true);
    jwtService.signAsync.mockResolvedValue('access-token');
    auditLogs.create.mockResolvedValue(undefined);
    mailer.send.mockResolvedValue(undefined);
    prisma.platformUser.update.mockResolvedValue(undefined);
  });

  describe('register', () => {
    const dto = {
      email: 'owner@example.com',
      name: 'Owner',
      password: 'password123',
      merchantName: 'Acme Payments',
      country: 'ke',
    };

    it('rejects an already registered email', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(service.register(dto as never)).rejects.toThrow(
        new BadRequestException('Email is already registered'),
      );
    });

    it('rejects registration when the starter plan is missing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
        callback({
          user: {
            create: jest.fn().mockResolvedValue({
              id: 'user-1',
              email: dto.email,
              name: dto.name,
            }),
          },
          subscriptionPlan: { findFirst: jest.fn().mockResolvedValue(null) },
          merchant: { create: jest.fn() },
        }),
      );

      await expect(service.register(dto as never)).rejects.toThrow(
        new BadRequestException('Default subscription plan was not found'),
      );
      expect(bcryptHash).toHaveBeenCalledWith(dto.password, 12);
    });

    it('creates the merchant, audit event, notification, and owner response', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const tx = {
        user: {
          create: jest.fn().mockResolvedValue({
            id: 'user-1',
            email: dto.email,
            name: dto.name,
          }),
        },
        subscriptionPlan: { findFirst: jest.fn().mockResolvedValue({ id: 'plan-1' }) },
        merchant: {
          create: jest.fn().mockResolvedValue({
            id: 'merchant-1',
            name: dto.merchantName,
            status: MerchantStatus.PENDING,
          }),
        },
      };
      prisma.$transaction.mockImplementation((callback: (value: typeof tx) => unknown) =>
        callback(tx),
      );

      await expect(service.register(dto as never)).resolves.toEqual({
        user: { id: 'user-1', email: dto.email, name: dto.name },
        merchantId: 'merchant-1',
        role: UserRole.OWNER,
        status: MerchantStatus.PENDING,
        type: 'merchant',
      });
      expect(tx.merchant.create).toHaveBeenCalled();
      expect(auditLogs.create).toHaveBeenCalledWith(
        expect.objectContaining({ merchantId: 'merchant-1', userId: 'user-1' }),
      );
      expect(mailer.send).toHaveBeenCalledWith(expect.objectContaining({ to: dto.email }));
    });
  });

  describe('login', () => {
    const dto = { email: 'owner@example.com', password: 'password123' };
    const merchant = { id: 'merchant-1', status: MerchantStatus.ACTIVE };
    const baseUser = {
      id: 'user-1',
      email: dto.email,
      name: 'Owner',
      passwordHash: 'hash',
    };
    const platformUser = {
      id: 'platform-1',
      email: dto.email,
      name: 'Platform Admin',
      password: 'hash',
      role: 'SUPERADMIN',
      status: PlatformUserStatus.ACTIVE,
    };

    it('logs in an active platform user through the same endpoint', async () => {
      prisma.platformUser.findUnique.mockResolvedValue(platformUser);

      await expect(service.login(dto as never)).resolves.toEqual({
        accessToken: 'access-token',
        user: { id: platformUser.id, email: platformUser.email, name: platformUser.name },
        role: platformUser.role,
        type: 'platform',
      });
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.platformUser.update).toHaveBeenCalledWith({
        where: { id: platformUser.id },
        data: { lastLogin: expect.any(Date) },
      });
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: platformUser.id,
          role: platformUser.role,
          type: 'platform',
        }),
      );
    });

    it('rejects an inactive platform account with a clear status message', async () => {
      prisma.platformUser.findUnique.mockResolvedValue({
        ...platformUser,
        status: PlatformUserStatus.SUSPENDED,
      });

      await expect(service.login(dto as never)).rejects.toThrow(
        new ForbiddenException('Your platform account is suspended. Please contact a Platform Administrator.'),
      );
      expect(bcryptCompare).not.toHaveBeenCalled();
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('identifies an incorrect platform password', async () => {
      prisma.platformUser.findUnique.mockResolvedValue(platformUser);
      bcryptCompare.mockResolvedValue(false);

      await expect(service.login(dto as never)).rejects.toThrow(
        new UnauthorizedException('The password you entered is incorrect.'),
      );
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('reports when no account exists for the supplied email', async () => {
      prisma.platformUser.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(dto as never)).rejects.toThrow(
        new UnauthorizedException('No account exists with that email address.'),
      );
    });

    it('identifies an incorrect merchant password', async () => {
      prisma.platformUser.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(baseUser);
      bcryptCompare.mockResolvedValue(false);

      await expect(service.login(dto as never)).rejects.toThrow(
        new UnauthorizedException('The password you entered is incorrect.'),
      );
    });

    it('rejects an unknown user or invalid password', async () => {
      prisma.platformUser.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.login(dto as never)).rejects.toThrow(UnauthorizedException);

      prisma.user.findUnique.mockResolvedValue({ ...baseUser, merchantUsers: [] });
      bcryptCompare.mockResolvedValue(false);
      await expect(service.login(dto as never)).rejects.toThrow(UnauthorizedException);
    });

    it('rejects users not attached to a merchant', async () => {
      prisma.platformUser.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, merchantUsers: [] });
      await expect(service.login(dto as never)).rejects.toThrow(
        new UnauthorizedException('Your account is not connected to a merchant organization. Please contact support.'),
      );
    });

    it('rejects a deactivated merchant user', async () => {
      prisma.platformUser.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        merchantUsers: [
          {
            merchantId: merchant.id,
            role: UserRole.OWNER,
            status: 'DEACTIVATED',
            merchant,
          },
        ],
      });
      await expect(service.login(dto as never)).rejects.toThrow(ForbiddenException);
    });

    it.each([MerchantStatus.PENDING, MerchantStatus.REJECTED, MerchantStatus.SUSPENDED])(
      'rejects an inactive merchant with %s status',
      async (status: MerchantStatus) => {
        prisma.platformUser.findUnique.mockResolvedValue(null);
        prisma.user.findUnique.mockResolvedValue({
          ...baseUser,
          merchantUsers: [
            {
              merchantId: merchant.id,
              role: UserRole.OWNER,
              status: 'ACTIVE',
              merchant: { ...merchant, status },
            },
          ],
        });

        await expect(service.login(dto as never)).rejects.toThrow(ForbiddenException);
        expect(auditLogs.create).not.toHaveBeenCalled();
      },
    );

    it('logs in an active merchant user and signs a merchant token', async () => {
      prisma.platformUser.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        merchantUsers: [
          {
            merchantId: merchant.id,
            role: UserRole.VIEWER,
            status: 'ACTIVE',
            merchant,
          },
          {
            merchantId: merchant.id,
            role: UserRole.OWNER,
            status: 'ACTIVE',
            merchant,
          },
        ],
      });

      await expect(service.login(dto as never)).resolves.toEqual({
        accessToken: 'access-token',
        user: { id: baseUser.id, email: baseUser.email, name: baseUser.name },
        merchantId: merchant.id,
        role: UserRole.OWNER,
        type: 'merchant',
      });
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: baseUser.id,
          merchantId: merchant.id,
          type: 'merchant',
        }),
      );
      expect(auditLogs.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auth.login' }),
      );
    });
  });
});
