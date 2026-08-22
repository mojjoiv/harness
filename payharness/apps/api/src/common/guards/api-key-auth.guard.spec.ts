import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ApiKeyAuthGuard } from './api-key-auth.guard';

describe('ApiKeyAuthGuard', () => {
  const prisma = {
    apiKey: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  } as any;

  const guard = new ApiKeyAuthGuard(prisma);
  const context = (headers: Record<string, string>) => ({
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  }) as any;

  beforeEach(() => jest.clearAllMocks());

  it('rejects a missing API key', async () => {
    await expect(guard.canActivate(context({}))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.apiKey.findMany).not.toHaveBeenCalled();
  });

  it('rejects an invalid API key', async () => {
    prisma.apiKey.findMany.mockResolvedValue([{ id: 'key-1', prefix: 'ph_live_1234567', keyHash: 'hash', merchantId: 'm-1', environment: 'LIVE' }]);
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

    await expect(guard.canActivate(context({ authorization: 'Bearer ph_live_123456789' }))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.apiKey.update).not.toHaveBeenCalled();
  });

  it('authenticates a valid key, updates lastUsedAt, and populates merchant context', async () => {
    const request = { headers: { authorization: 'Bearer ph_live_123456789' } };
    prisma.apiKey.findMany.mockResolvedValue([{ id: 'key-1', prefix: 'ph_live_1234567', keyHash: 'hash', merchantId: 'm-1', environment: 'LIVE' }]);
    prisma.apiKey.update.mockResolvedValue({});
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

    const result = await guard.canActivate(({ switchToHttp: () => ({ getRequest: () => request }) }) as any);

    expect(result).toBe(true);
    expect(prisma.apiKey.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'key-1' }, data: { lastUsedAt: expect.any(Date) } }));
    expect(request.user).toEqual(expect.objectContaining({ merchantId: 'm-1', apiKeyId: 'key-1', role: 'API_KEY', type: 'api_key', environment: 'LIVE' }));
  });
});
