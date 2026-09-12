import { Environment, Provider } from '@prisma/client';
import { PayoutsService } from './payouts.service';

describe('PayoutsService', () => {
  const prisma = {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  };

  let service: PayoutsService;

  const payout = {
    id: 'payout-1',
    merchantId: 'merchant-1',
    amountCents: 5000,
    currency: 'KES',
    provider: Provider.MPESA,
    environment: Environment.SANDBOX,
    status: 'PENDING',
    recipientType: 'mobile_money',
    recipientPhone: '+254712345678',
    recipientName: 'John Doe',
    providerReference: null,
    metadata: {},
    failureReason: null,
    idempotencyKey: 'payout-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PayoutsService(prisma as never);
  });

  it('creates a pending payout', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([payout]);
    prisma.$executeRaw.mockResolvedValue(1);

    const result = await service.createPayout(
      'merchant-1',
      {
        amountCents: 5000,
        currency: 'kes',
        provider: Provider.MPESA,
        environment: Environment.SANDBOX,
        recipientType: 'mobile_money',
        recipientPhone: '+254712345678',
        recipientName: 'John Doe',
      },
      'payout-1',
    );

    expect(result.status).toBe('PENDING');
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('returns the existing payout for a repeated idempotency key', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([payout]);

    const result = await service.createPayout(
      'merchant-1',
      {
        amountCents: 5000,
        currency: 'KES',
        provider: Provider.MPESA,
        environment: Environment.SANDBOX,
        recipientType: 'mobile_money',
      },
      'payout-1',
    );

    expect(result).toEqual(payout);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('does not expose a payout belonging to another merchant', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]);

    await expect(
      service.getPayout('merchant-1', 'payout-2'),
    ).rejects.toThrow('Payout not found');
  });

  it('lists payouts with pagination and returns the total count', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([
      { ...payout, total: 3n },
    ]);

    const result = await service.listPayouts('merchant-1', {
      page: 2,
      pageSize: 1,
    });

    expect(result).toEqual({
      data: [payout],
      total: 3,
      page: 2,
      pageSize: 1,
      totalPages: 3,
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('returns an empty page with zero total when no payouts match', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]);

    const result = await service.listPayouts('merchant-1', {
      status: 'FAILED',
      provider: Provider.MPESA,
      environment: Environment.LIVE,
      currency: 'kes',
      search: 'missing',
      page: 1,
      pageSize: 25,
    });

    expect(result).toEqual({
      data: [],
      total: 0,
      page: 1,
      pageSize: 25,
      totalPages: 0,
    });
  });

  it('supports date range filters', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]);

    await service.listPayouts('merchant-1', {
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2026-09-12T23:59:59.999Z',
      page: 1,
      pageSize: 25,
    });

    const query = prisma.$queryRaw.mock.calls[0][0];
    expect(query.values).toEqual(
      expect.arrayContaining([
        'merchant-1',
        new Date('2026-09-01T00:00:00.000Z'),
        new Date('2026-09-12T23:59:59.999Z'),
        25,
        0,
      ]),
    );
  });
});
