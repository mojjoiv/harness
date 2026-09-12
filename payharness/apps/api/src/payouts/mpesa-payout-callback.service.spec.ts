import { NotFoundException } from '@nestjs/common';
import { MpesaPayoutCallbackService } from './mpesa-payout-callback.service';

const payout = {
  id: 'payout-1',
  merchantId: 'merchant-1',
  amountCents: 5000,
  currency: 'KES',
  provider: 'MPESA',
  environment: 'SANDBOX',
  status: 'PROCESSING',
  recipientType: 'mobile_money',
  recipientPhone: '254700000000',
  recipientName: 'Test Recipient',
  providerReference: '12345-abc',
  metadata: {},
  failureReason: null,
  idempotencyKey: 'idem-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('MpesaPayoutCallbackService', () => {
  it('finalizes a successful ResultURL callback', async () => {
    const finalized = {
      ...payout,
      status: 'SUCCEEDED',
      metadata: {
        mpesaCallback: {
          type: 'RESULT',
          resultCode: 0,
          transactionId: 'Q123ABC',
        },
      },
    };
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValueOnce([payout]).mockResolvedValueOnce([finalized]),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    const service = new MpesaPayoutCallbackService(prisma as never);

    await expect(
      service.handleResult('merchant-1', {
        ResultCode: 0,
        ResultDesc: 'The service request is processed successfully.',
        ConversationID: '12345-abc',
        TransactionID: 'Q123ABC',
      }),
    ).resolves.toMatchObject({ status: 'SUCCEEDED' });

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('finalizes a failed ResultURL callback', async () => {
    const finalized = {
      ...payout,
      status: 'FAILED',
      failureReason: 'Insufficient funds',
    };
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValueOnce([payout]).mockResolvedValueOnce([finalized]),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    const service = new MpesaPayoutCallbackService(prisma as never);

    await expect(
      service.handleResult('merchant-1', {
        ResultCode: 1,
        ResultDesc: 'Insufficient funds',
        ConversationID: '12345-abc',
      }),
    ).resolves.toMatchObject({ status: 'FAILED', failureReason: 'Insufficient funds' });
  });

  it('marks a QueueTimeOutURL callback as failed', async () => {
    const finalized = {
      ...payout,
      status: 'FAILED',
      failureReason: 'Request timed out',
    };
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValueOnce([payout]).mockResolvedValueOnce([finalized]),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    const service = new MpesaPayoutCallbackService(prisma as never);

    await expect(
      service.handleTimeout('merchant-1', {
        ResultCode: 1037,
        ResultDesc: 'Request timed out',
        OriginatorConversationID: '12345-abc',
      }),
    ).resolves.toMatchObject({ status: 'FAILED', failureReason: 'Request timed out' });
  });

  it('does not change an already finalized payout on a duplicate callback', async () => {
    const succeeded = { ...payout, status: 'SUCCEEDED' };
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValueOnce([succeeded]),
      $executeRaw: jest.fn(),
    };
    const service = new MpesaPayoutCallbackService(prisma as never);

    await expect(
      service.handleResult('merchant-1', {
        ResultCode: 1,
        ResultDesc: 'Late failure callback',
        ConversationID: '12345-abc',
      }),
    ).resolves.toEqual(succeeded);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('rejects an unknown provider reference', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValueOnce([]),
      $executeRaw: jest.fn(),
    };
    const service = new MpesaPayoutCallbackService(prisma as never);

    await expect(
      service.handleResult('merchant-1', {
        ResultCode: 0,
        ConversationID: 'unknown-reference',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('cannot finalize a payout belonging to another merchant', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValueOnce([]),
      $executeRaw: jest.fn(),
    };
    const service = new MpesaPayoutCallbackService(prisma as never);

    await expect(
      service.handleResult('merchant-2', {
        ResultCode: 0,
        ConversationID: '12345-abc',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
