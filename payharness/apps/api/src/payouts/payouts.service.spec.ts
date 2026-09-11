import { Environment, Provider } from '@prisma/client';
import { PayoutsService } from './payouts.service';

describe('PayoutsService', () => {
  const prisma = {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  };

  let service: PayoutsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PayoutsService(prisma as never);
  });

  it('creates a pending payout', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
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
        },
      ]);
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
    const existing = {
      id: 'payout-1',
      merchantId: 'merchant-1',
      amountCents: 5000,
      currency: 'KES',
      provider: Provider.MPESA,
      environment: Environment.SANDBOX,
      status: 'PENDING',
      recipientType: 'mobile_money',
      recipientPhone: '+254712345678',
      recipientName: null,
      providerReference: null,
      metadata: {},
      failureReason: null,
      idempotencyKey: 'payout-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prisma.$queryRaw.mockResolvedValueOnce([existing]);

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

    expect(result).toEqual(existing);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('does not expose a payout belonging to another merchant', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]);

    await expect(
      service.getPayout('merchant-1', 'payout-2'),
    ).rejects.toThrow('Payout not found');
  });
});
