import { PaymentReconciliationService } from './payment-reconciliation.service';

describe('PaymentReconciliationService', () => {
  it('queries stale pending payments and reports successful reconciliation', async () => {
    const prisma = {
      payment: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'payment-1', merchantId: 'merchant-1' },
          { id: 'payment-2', merchantId: 'merchant-2' },
        ]),
      },
    };
    const payments = {
      queryPayment: jest
        .fn()
        .mockResolvedValueOnce({ paymentId: 'payment-1', status: 'SUCCEEDED' })
        .mockResolvedValueOnce({ paymentId: 'payment-2', status: 'PENDING' }),
    };

    const service = new PaymentReconciliationService(prisma as any, payments as any);
    await expect(service.reconcilePendingPayments()).resolves.toEqual({
      scanned: 2,
      reconciled: 1,
      failed: 0,
    });
    expect(payments.queryPayment).toHaveBeenNthCalledWith(1, 'merchant-1', undefined, 'payment-1');
    expect(payments.queryPayment).toHaveBeenNthCalledWith(2, 'merchant-2', undefined, 'payment-2');
  });

  it('continues the batch when one payment cannot be reconciled', async () => {
    const prisma = {
      payment: {
        findMany: jest.fn().mockResolvedValue([{ id: 'payment-1', merchantId: 'merchant-1' }]),
      },
    };
    const payments = {
      queryPayment: jest.fn().mockRejectedValue(new Error('provider unavailable')),
    };

    const service = new PaymentReconciliationService(prisma as any, payments as any);
    await expect(service.reconcilePendingPayments()).resolves.toEqual({
      scanned: 1,
      reconciled: 0,
      failed: 1,
    });
  });

  it('prevents overlapping reconciliation runs', async () => {
    let release: (() => void) | undefined;
    const prisma = {
      payment: {
        findMany: jest.fn().mockReturnValue(
          new Promise((resolve) => {
            release = () => resolve([]);
          }),
        ),
      },
    };
    const payments = { queryPayment: jest.fn() };
    const service = new PaymentReconciliationService(prisma as any, payments as any);

    const first = service.reconcilePendingPayments();
    await expect(service.reconcilePendingPayments()).resolves.toEqual({
      scanned: 0,
      reconciled: 0,
      failed: 0,
    });
    release?.();
    await expect(first).resolves.toEqual({ scanned: 0, reconciled: 0, failed: 0 });
  });
});
