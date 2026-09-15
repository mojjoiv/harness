import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ApiKeyAuthGuard } from './api-key-auth.guard';

jest.mock('bcrypt', () => ({ compare: jest.fn() }));

describe('ApiKeyAuthGuard', () => {
  const prisma = {
    apiKey: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    merchant: {
      findUnique: jest.fn(),
    },
  } as any;

  const guard = new ApiKeyAuthGuard(prisma);
  const context = (headers: Record<string, string>) => ({
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  }) as any;

  beforeEach(() => jest.resetAllMocks());

  it('rejects a missing API key', async () => {
    await expect(guard.canActivate(context({}))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.apiKey.findMany).not.toHaveBeenCalled();
  });

  it('rejects an invalid API key', async () => {
    prisma.apiKey.findMany.mockResolvedValue([
      {
        id: 'key-1',
        prefix: 'ph_live_1234567',
        keyHash: 'hash',
        merchantId: 'm-1',
        environment: 'LIVE',
      },
    ]);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      guard.canActivate(context({ authorization: 'Bearer ph_live_123456789' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.merchant.findUnique).not.toHaveBeenCalled();
    expect(prisma.apiKey.update).not.toHaveBeenCalled();
  });

  it('rejects a valid key when the merchant is not active', async () => {
    prisma.apiKey.findMany.mockResolvedValue([
      {
        id: 'key-1',
        prefix: 'ph_live_1234567',
        keyHash: 'hash',
        merchantId: 'm-1',
        environment: 'LIVE',
      },
    ]);
    prisma.merchant.findUnique.mockResolvedValue({ status: 'SUSPENDED' });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    await expect(
      guard.canActivate(context({ authorization: 'Bearer ph_live_123456789' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.apiKey.update).not.toHaveBeenCalled();
  });

  it('rejects a valid key when its merchant no longer exists', async () => {
    prisma.apiKey.findMany.mockResolvedValue([
      {
        id: 'key-1',
        prefix: 'ph_live_1234567',
        keyHash: 'hash',
        merchantId: 'm-1',
        environment: 'LIVE',
      },
    ]);
    prisma.merchant.findUnique.mockResolvedValue(null);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    await expect(
      guard.canActivate(context({ authorization: 'Bearer ph_live_123456789' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.apiKey.update).not.toHaveBeenCalled();
  });

  it('authenticates a valid key for an active merchant', async () => {
    const request: any = { headers: { authorization: 'Bearer ph_live_123456789' } };
    prisma.apiKey.findMany.mockResolvedValue([
      {
        id: 'key-1',
        prefix: 'ph_live_1234567',
        keyHash: 'hash',
        merchantId: 'm-1',
        environment: 'LIVE',
      },
    ]);
    prisma.merchant.findUnique.mockResolvedValue({ status: 'ACTIVE' });
    prisma.apiKey.update.mockResolvedValue({});
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await guard.canActivate(
      ({ switchToHttp: () => ({ getRequest: () => request }) }) as any,
    );

    expect(result).toBe(true);
    expect(prisma.merchant.findUnique).toHaveBeenCalledWith({
      where: { id: 'm-1' },
      select: { status: true },
    });
    expect(prisma.apiKey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'key-1' },
        data: { lastUsedAt: expect.any(Date) },
      }),
    );
    expect(request.user).toEqual(
      expect.objectContaining({
        merchantId: 'm-1',
        apiKeyId: 'key-1',
        role: 'API_KEY',
        type: 'api_key',
        environment: 'LIVE',
      }),
    );
  });
});
