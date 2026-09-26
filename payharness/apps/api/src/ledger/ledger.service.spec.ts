import { LedgerService } from './ledger.service';

describe('LedgerService', () => {
  it('posts balanced, idempotent payment settlement journals', async () => {
    const journal = {
      id: 'journal-1',
      merchantId: 'merchant-1',
      sourceType: 'PAYMENT_SETTLEMENT',
      sourceId: 'payment-1',
      currency: 'KES',
      entries: [],
    };
    const tx = {
      ledgerJournal: {
        findUnique: jest.fn().mockResolvedValueOnce(null),
        create: jest.fn().mockResolvedValue(journal),
      },
      ledgerEntry: {
        groupBy: jest.fn().mockResolvedValue([
          { side: 'DEBIT', _sum: { amountCents: 2500 } },
          { side: 'CREDIT', _sum: { amountCents: 2500 } },
        ]),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new LedgerService(prisma as never);

    await expect(service.postPaymentSettlement({
      merchantId: 'merchant-1',
      paymentId: 'payment-1',
      amountCents: 2500,
      currency: 'kes',
    })).resolves.toEqual(journal);

    expect(tx.ledgerJournal.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        sourceType: 'PAYMENT_SETTLEMENT',
        sourceId: 'payment-1',
        currency: 'KES',
      }),
    }));
  });

  it('rejects unbalanced journals before writing', async () => {
    const prisma = { $transaction: jest.fn() };
    const service = new LedgerService(prisma as never);
    await expect((service as any).postJournal({
      merchantId: 'merchant-1',
      sourceType: 'TEST',
      sourceId: 'source-1',
      currency: 'KES',
      description: 'invalid',
      lines: [
        { accountCode: 'A', side: 'DEBIT', amountCents: 100 },
        { accountCode: 'B', side: 'CREDIT', amountCents: 99 },
      ],
    })).rejects.toThrow('Unbalanced ledger journal');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
