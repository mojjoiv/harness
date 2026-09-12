import { BadRequestException } from '@nestjs/common';
import { Environment, Provider } from '@prisma/client';
import { PayoutsController } from './payouts.controller';

describe('PayoutsController', () => {
  const reconciliationService = { reconcileStalePayouts: jest.fn() };

  it('requires an idempotency key when creating a payout', async () => {
    const service = { createPayout: jest.fn() };
    const executionService = { executePayout: jest.fn() };
    const controller = new PayoutsController(
      service as never,
      executionService as never,
      reconciliationService as never,
    );

    expect(() =>
      controller.create(
        { merchantId: 'merchant-1' } as never,
        {
          amountCents: 5000,
          currency: 'KES',
          provider: Provider.MPESA,
          environment: Environment.SANDBOX,
          recipientType: 'mobile_money',
        },
        undefined,
      ),
    ).toThrow(BadRequestException);
  });

  it('passes the merchant id and idempotency key to the service', async () => {
    const payout = { id: 'payout-1', status: 'PENDING' };
    const service = { createPayout: jest.fn().mockResolvedValue(payout) };
    const executionService = { executePayout: jest.fn() };
    const controller = new PayoutsController(
      service as never,
      executionService as never,
      reconciliationService as never,
    );
    const dto = {
      amountCents: 5000,
      currency: 'KES',
      provider: Provider.MPESA,
      environment: Environment.SANDBOX,
      recipientType: 'mobile_money',
    };

    await expect(
      controller.create(
        { merchantId: 'merchant-1' } as never,
        dto,
        'payout-1',
      ),
    ).resolves.toEqual(payout);

    expect(service.createPayout).toHaveBeenCalledWith(
      'merchant-1',
      dto,
      'payout-1',
    );
  });

  it('lists payouts for the authenticated merchant', async () => {
    const result = { data: [], total: 0, page: 1, pageSize: 25, totalPages: 0 };
    const service = { listPayouts: jest.fn().mockResolvedValue(result) };
    const controller = new PayoutsController(
      service as never,
      { executePayout: jest.fn() } as never,
      reconciliationService as never,
    );
    const query = { status: 'SUCCEEDED', page: 1, pageSize: 25 };

    await expect(
      controller.list({ merchantId: 'merchant-1' } as never, query as never),
    ).resolves.toEqual(result);

    expect(service.listPayouts).toHaveBeenCalledWith('merchant-1', query);
  });

  it('reports payouts for the authenticated merchant', async () => {
    const result = {
      totalCount: 2,
      totalVolumeCents: 10000,
      successfulCount: 1,
      successfulVolumeCents: 6000,
      failedCount: 1,
      failedVolumeCents: 4000,
      pendingCount: 0,
      pendingVolumeCents: 0,
      successRate: 50,
      byStatus: {},
      byProvider: {},
      byCurrency: {},
    };
    const service = { reportPayouts: jest.fn().mockResolvedValue(result) };
    const controller = new PayoutsController(
      service as never,
      { executePayout: jest.fn() } as never,
      reconciliationService as never,
    );
    const query = {
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2026-09-12T23:59:59.999Z',
    };

    await expect(
      controller.report({ merchantId: 'merchant-1' } as never, query),
    ).resolves.toEqual(result);

    expect(service.reportPayouts).toHaveBeenCalledWith('merchant-1', query);
  });

  it('executes a payout for the authenticated merchant', async () => {
    const payout = { id: 'payout-1', status: 'SUCCEEDED' };
    const service = { createPayout: jest.fn() };
    const executionService = { executePayout: jest.fn().mockResolvedValue(payout) };
    const controller = new PayoutsController(
      service as never,
      executionService as never,
      reconciliationService as never,
    );

    await expect(
      controller.execute({ merchantId: 'merchant-1' } as never, 'payout-1'),
    ).resolves.toEqual(payout);

    expect(executionService.executePayout).toHaveBeenCalledWith(
      'merchant-1',
      'payout-1',
    );
  });

  it('runs stale payout reconciliation for the authenticated merchant', async () => {
    const summary = { scanned: 2, claimed: 1, succeeded: 1, failed: 0, unresolved: 0 };
    reconciliationService.reconcileStalePayouts.mockResolvedValue(summary);
    const controller = new PayoutsController(
      { createPayout: jest.fn() } as never,
      { executePayout: jest.fn() } as never,
      reconciliationService as never,
    );

    await expect(
      controller.reconcile({ merchantId: 'merchant-1' } as never),
    ).resolves.toEqual(summary);

    expect(reconciliationService.reconcileStalePayouts).toHaveBeenCalledWith('merchant-1');
  });
});
