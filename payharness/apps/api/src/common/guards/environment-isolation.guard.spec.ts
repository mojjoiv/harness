import { ForbiddenException } from '@nestjs/common';
import { EnvironmentIsolationGuard } from './environment-isolation.guard';

describe('EnvironmentIsolationGuard', () => {
  const prisma = {
    payment: {
      findFirst: jest.fn(),
    },
  };
  const guard = new EnvironmentIsolationGuard(prisma as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const contextFor = (user: any, paymentId?: string) => ({
    switchToHttp: () => ({
      getRequest: () => ({
        user,
        params: paymentId ? { id: paymentId } : {},
      }),
    }),
  });

  it('allows sandbox API keys to access sandbox payments', async () => {
    prisma.payment.findFirst.mockResolvedValue({ environment: 'SANDBOX' });

    await expect(
      guard.canActivate(
        contextFor(
          { type: 'api_key', merchantId: 'merchant-1', environment: 'SANDBOX' },
          'payment-1',
        ) as any,
      ),
    ).resolves.toBe(true);
  });

  it('allows live API keys to access live payments', async () => {
    prisma.payment.findFirst.mockResolvedValue({ environment: 'LIVE' });

    await expect(
      guard.canActivate(
        contextFor(
          { type: 'api_key', merchantId: 'merchant-1', environment: 'LIVE' },
          'payment-2',
        ) as any,
      ),
    ).resolves.toBe(true);
  });

  it('rejects a sandbox API key from accessing a live payment', async () => {
    prisma.payment.findFirst.mockResolvedValue({ environment: 'LIVE' });

    await expect(
      guard.canActivate(
        contextFor(
          { type: 'api_key', merchantId: 'merchant-1', environment: 'SANDBOX' },
          'payment-live',
        ) as any,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a live API key from accessing a sandbox payment', async () => {
    prisma.payment.findFirst.mockResolvedValue({ environment: 'SANDBOX' });

    await expect(
      guard.canActivate(
        contextFor(
          { type: 'api_key', merchantId: 'merchant-1', environment: 'LIVE' },
          'payment-sandbox',
        ) as any,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not restrict dashboard JWT callers', async () => {
    await expect(
      guard.canActivate(
        contextFor({ type: 'merchant', merchantId: 'merchant-1' }, 'payment-1') as any,
      ),
    ).resolves.toBe(true);
    expect(prisma.payment.findFirst).not.toHaveBeenCalled();
  });

  it('does not leak payment existence across merchants', async () => {
    prisma.payment.findFirst.mockResolvedValue(null);

    await expect(
      guard.canActivate(
        contextFor(
          { type: 'api_key', merchantId: 'merchant-1', environment: 'SANDBOX' },
          'payment-other-merchant',
        ) as any,
      ),
    ).resolves.toBe(true);

    expect(prisma.payment.findFirst).toHaveBeenCalledWith({
      where: { id: 'payment-other-merchant', merchantId: 'merchant-1' },
      select: { environment: true },
    });
  });
});
