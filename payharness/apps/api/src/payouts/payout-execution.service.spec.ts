import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Environment, Provider } from '@prisma/client';
import { PayoutExecutionService } from './payout-execution.service';

const payout = {
  id: 'payout-1',
  merchantId: 'merchant-1',
  amountCents: 5000,
  currency: 'KES',
  provider: Provider.MPESA,
  environment: Environment.SANDBOX,
  status: 'PENDING',
  recipientType: 'mobile_money',
  recipientPhone: '254700000000',
  recipientName: 'Test Recipient',
  providerReference: null,
  metadata: {},
  failureReason: null,
  idempotencyKey: 'idem-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('PayoutExecutionService', () => {
  it('moves a pending payout to succeeded after provider execution', async () => {
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([payout])
        .mockResolvedValueOnce([
          { ...payout, status: 'SUCCEEDED', providerReference: 'mpesa-123' },
        ]),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    const providers = {
      execute: jest.fn().mockResolvedValue({ providerReference: 'mpesa-123' }),
    };
    const service = new PayoutExecutionService(prisma as never, providers as never);

    await expect(service.executePayout('merchant-1', 'payout-1')).resolves.toMatchObject({
      status: 'SUCCEEDED',
      providerReference: 'mpesa-123',
    });

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
    expect(providers.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        payoutId: 'payout-1',
        merchantId: 'merchant-1',
        amountCents: 5000,
        provider: Provider.MPESA,
      }),
    );
  });

  it('marks a payout failed when provider execution throws', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValueOnce([payout]),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    const providers = {
      execute: jest.fn().mockRejectedValue(new Error('provider unavailable')),
    };
    const service = new PayoutExecutionService(prisma as never, providers as never);

    await expect(service.executePayout('merchant-1', 'payout-1')).rejects.toThrow(
      'provider unavailable',
    );

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
    expect(prisma.$executeRaw.mock.calls[1][0].values).toContain('provider unavailable');
  });

  it('rejects a payout that is already processing', async () => {
    const processing = { ...payout, status: 'PROCESSING' };
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValueOnce([processing]),
      $executeRaw: jest.fn(),
    };
    const providers = { execute: jest.fn() };
    const service = new PayoutExecutionService(prisma as never, providers as never);

    await expect(service.executePayout('merchant-1', 'payout-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(providers.execute).not.toHaveBeenCalled();
  });

  it('returns an already succeeded payout without calling the provider', async () => {
    const succeeded = { ...payout, status: 'SUCCEEDED', providerReference: 'mpesa-123' };
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValueOnce([succeeded]),
      $executeRaw: jest.fn(),
    };
    const providers = { execute: jest.fn() };
    const service = new PayoutExecutionService(prisma as never, providers as never);

    await expect(service.executePayout('merchant-1', 'payout-1')).resolves.toEqual(succeeded);
    expect(providers.execute).not.toHaveBeenCalled();
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('does not allow another merchant to execute a payout', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValueOnce([]),
      $executeRaw: jest.fn(),
    };
    const providers = { execute: jest.fn() };
    const service = new PayoutExecutionService(prisma as never, providers as never);

    await expect(service.executePayout('merchant-2', 'payout-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(providers.execute).not.toHaveBeenCalled();
  });
});
