import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { MerchantStatus, UserRole } from '@prisma/client';
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
      prisma.$transaction.mockImplementation(
        async (callback: (tx: unknown) => unknown) =>
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
      prisma.$transaction.mockImplementation(
        (callback: (value: typeof tx) => unknown) => callback(tx),
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
    const baseUser = { id: 'user-1', email: dto.email, name: 'Owner', passwordHash: 'hash' };

    it('rejects an unknown user or invalid password', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.login(dto as never)).rejects.toThrow(UnauthorizedException);

      prisma.user.findUnique.mockResolvedValue({ ...baseUser, merchantUsers: [] });
      bcryptCompare.mockResolvedValue(false);
      await expect(service.login(dto as never)).rejects.toThrow(UnauthorizedException);
    });

    it('rejects users not attached to a merchant', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, merchantUsers: [] });
      await expect(service.login(dto as never)).rejects.toThrow(
        new UnauthorizedException('User is not attached to a merchant'),
      );
    });

    it('rejects a deactivated merchant user', async () => {
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
