import { UnauthorizedException } from '@nestjs/common';
import { SessionService } from './session.service';

describe('SessionService', () => {
  const prisma = {
    session: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  } as any;

  const service = new SessionService(prisma);

  beforeEach(() => jest.clearAllMocks());

  it('creates a hashed refresh-token session', async () => {
    prisma.session.create.mockResolvedValue({ id: 's-1' });
    const result = await service.create({ userId: 'u-1', merchantId: 'm-1' });
    expect(result.refreshToken).toBeTruthy();
    expect(prisma.session.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'u-1', merchantId: 'm-1', refreshTokenHash: expect.any(String) }),
    }));
    expect(result.refreshToken).not.toContain('refreshTokenHash');
  });

  it('rotates a valid refresh token and revokes the old session', async () => {
    prisma.session.findUnique.mockResolvedValue({
      id: 's-1', userId: 'u-1', merchantId: 'm-1', familyId: 'f-1',
      revokedAt: null, expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.session.create.mockResolvedValue({ id: 's-2' });
    const result = await service.rotate('old-token');
    expect(result.refreshToken).toBeTruthy();
    expect(prisma.session.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 's-1' },
      data: expect.objectContaining({ revokedAt: expect.any(Date), replacedBySessionId: 's-2' }),
    }));
  });

  it('rejects expired or revoked refresh tokens', async () => {
    prisma.session.findUnique.mockResolvedValue({
      id: 's-1', revokedAt: new Date(), expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(service.rotate('old-token')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
