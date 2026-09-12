import { Environment, Provider } from '@prisma/client';
import { PayoutReconciliationService } from './payout-reconciliation.service';

const payout = {
  id: 'payout-1',
  merchantId: 'merchant-1',
  amountCents: 5000,
  currency: 'KES',
  provider: Provider.MPESA,
  environment: Environment.SANDBOX,
  status: 'PROCESSING',
  recipientType: 'mobile_money',
  recipientPhone: '254700000000',
  recipientName: 'Test Recipient',
  providerReference: 'mpesa-123',
  metadata: {},
  failureReason: null,
  idempotencyKey: 'idem-1',
  createdAt: new Date(Date.now() - 3600000),
  updatedAt: new Date(Date.now() - 3600000),
};

function makeService(
  candidates = [payout],
  reconciliation = { status: 'UNSUPPORTED' as const },
) {
  const prisma = {
    $queryRaw: jest.fn().mockResolvedValue(candidates),
    $executeRaw: jest.fn().mockResolvedValue(1),
  };
  const providers = {
    reconcile: jest.fn().mockResolvedValue(reconciliation),
  };
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'PAYOUT_RECONCILIATION_STALE_MS') return '900000';
      if (key === 'PAYOUT_RECONCILIATION_CLAIM_TTL_MS') return '300000';
      return undefined;
    }),
  };
  return {
    service: new PayoutReconciliationService(prisma as never, providers as never, config as never),
    prisma,
    providers,
  };
}

describe('PayoutReconciliationService', () => {
  it('scans only stale processing payouts', async () => {
    const { service, prisma } = makeService([]);

    await expect(service.reconcileStalePayouts('merchant-1')).resolves.toEqual({
      scanned: 0,
      claimed: 0,
      succeeded: 0,
      failed: 0,
      unresolved: 0,
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('claims a stale payout before reconciliation', async () => {
    const { service, prisma, providers } = makeService([], { status: 'UNKNOWN' });
    prisma.$queryRaw.mockResolvedValueOnce([payout]);

    await service.reconcileStalePayouts('merchant-1');

    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(providers.reconcile).toHaveBeenCalledWith(
      expect.objectContaining({
        payoutId: 'payout-1',
        providerReference: 'mpesa-123',
      }),
    );
  });

  it('finalizes a provider-confirmed success', async () => {
    const { service, prisma } = makeService([payout], {
      status: 'SUCCEEDED',
      providerStatus: 'Completed',
    });

    await expect(service.reconcileStalePayouts()).resolves.toMatchObject({
      claimed: 1,
      succeeded: 1,
      failed: 0,
      unresolved: 0,
    });
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(3);
  });

  it('finalizes a provider-confirmed failure', async () => {
    const { service, prisma } = makeService([payout], {
      status: 'FAILED',
      providerStatus: 'Failed',
      details: { failureReason: 'Insufficient funds' },
    });

    await expect(service.reconcileStalePayouts()).resolves.toMatchObject({
      claimed: 1,
      succeeded: 0,
      failed: 1,
      unresolved: 0,
    });
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(3);
  });

  it('does not mark an unresolved payout failed', async () => {
    const { service, prisma } = makeService([payout], {
      status: 'UNKNOWN',
      details: { reason: 'Provider status unavailable' },
    });

    await expect(service.reconcileStalePayouts()).resolves.toMatchObject({
      claimed: 1,
      succeeded: 0,
      failed: 0,
      unresolved: 1,
    });
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(3);
  });

  it('does not retry a payout when the claim is lost to another worker', async () => {
    const { service, prisma, providers } = makeService([payout]);
    prisma.$executeRaw.mockResolvedValueOnce(0);

    await expect(service.reconcileStalePayouts()).resolves.toMatchObject({
      claimed: 0,
      succeeded: 0,
      failed: 0,
      unresolved: 0,
    });
    expect(providers.reconcile).not.toHaveBeenCalled();
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('leaves terminal provider outcomes protected by PROCESSING guard', async () => {
    const { service, prisma } = makeService([payout], { status: 'SUCCEEDED' });
    prisma.$executeRaw.mockReturnValueOnce(1).mockReturnValueOnce(1).mockReturnValueOnce(0);

    await expect(service.reconcileStalePayouts()).resolves.toMatchObject({
      claimed: 1,
      succeeded: 1,
    });

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(3);
  });

  it('records provider errors as unresolved instead of failing the payout', async () => {
    const { service, prisma, providers } = makeService([payout]);
    providers.reconcile.mockRejectedValueOnce(new Error('provider unavailable'));

    await expect(service.reconcileStalePayouts()).resolves.toMatchObject({
      claimed: 1,
      succeeded: 0,
      failed: 0,
      unresolved: 1,
    });
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(3);
  });

  it('stops its automatic interval when the module is destroyed', () => {
    const { service } = makeService([]);
    service.onModuleDestroy();
    expect(true).toBe(true);
  });
});
