import { BadRequestException } from '@nestjs/common';
import { Environment, Provider } from '@prisma/client';
import { PayoutsController } from './payouts.controller';

describe('PayoutsController', () => {
  it('requires an idempotency key when creating a payout', async () => {
    const service = { createPayout: jest.fn() };
    const executionService = { executePayout: jest.fn() };
    const controller = new PayoutsController(service as never, executionService as never);

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
    const controller = new PayoutsController(service as never, executionService as never);
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

  it('executes a payout for the authenticated merchant', async () => {
    const payout = { id: 'payout-1', status: 'SUCCEEDED' };
    const service = { createPayout: jest.fn() };
    const executionService = { executePayout: jest.fn().mockResolvedValue(payout) };
    const controller = new PayoutsController(service as never, executionService as never);

    await expect(
      controller.execute({ merchantId: 'merchant-1' } as never, 'payout-1'),
    ).resolves.toEqual(payout);

    expect(executionService.executePayout).toHaveBeenCalledWith('merchant-1', 'payout-1');
  });
});
