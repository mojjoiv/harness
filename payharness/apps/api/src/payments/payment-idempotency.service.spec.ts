import { ConflictException } from '@nestjs/common';
import { PaymentIdempotencyService } from './payment-idempotency.service';

function prismaMock() {
  return {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  };
}

describe('PaymentIdempotencyService', () => {
  it('claims a new key once', async () => {
    const prisma = prismaMock();
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.$executeRaw.mockResolvedValue(1);
    const service = new PaymentIdempotencyService(prisma as any);

    const result = await service.claim('merchant-1', 'SANDBOX', 'idem-key-123', {
      amountCents: 1000,
      currency: 'KES',
    });

    expect(result.claim.merchantId).toBe('merchant-1');
    expect(result.claim.environment).toBe('SANDBOX');
    expect(result.claim.key).toBe('idem-key-123');
    expect(result.replay).toBeUndefined();
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('replays a completed request with the same payload', async () => {
    const prisma = prismaMock();
    prisma.$queryRaw.mockResolvedValue([{
      id: 'claim-1',
      request_hash: 'placeholder',
      status: 'COMPLETED',
      response_json: { paymentId: 'pay-1', status: 'SUCCEEDED' },
    }]);
    const service = new PaymentIdempotencyService(prisma as any);
    const body = { amountCents: 1000, currency: 'KES' };

    const firstHash = require('crypto').createHash('sha256').update(JSON.stringify({ amountCents: 1000, currency: 'KES' })).digest('hex');
    prisma.$queryRaw.mockResolvedValueOnce([{
      id: 'claim-1',
      request_hash: firstHash,
      status: 'COMPLETED',
      response_json: { paymentId: 'pay-1', status: 'SUCCEEDED' },
    }]);

    const result = await service.claim('merchant-1', 'SANDBOX', 'idem-key-123', body);
    expect(result.replay).toEqual({ paymentId: 'pay-1', status: 'SUCCEEDED' });
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('rejects reuse of a key with a different payload', async () => {
    const prisma = prismaMock();
    prisma.$queryRaw.mockResolvedValue([{
      id: 'claim-1',
      request_hash: 'different-hash',
      status: 'COMPLETED',
      response_json: { paymentId: 'pay-1' },
    }]);
    const service = new PaymentIdempotencyService(prisma as any);

    await expect(service.claim('merchant-1', 'SANDBOX', 'idem-key-123', { amountCents: 9999 }))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a concurrent request while the original is processing', async () => {
    const prisma = prismaMock();
    prisma.$queryRaw.mockResolvedValue([{
      id: 'claim-1',
      request_hash: require('crypto').createHash('sha256').update(JSON.stringify({ amountCents: 1000 })).digest('hex'),
      status: 'PROCESSING',
      response_json: null,
    }]);
    const service = new PaymentIdempotencyService(prisma as any);

    await expect(service.claim('merchant-1', 'SANDBOX', 'idem-key-123', { amountCents: 1000 }))
      .rejects.toBeInstanceOf(ConflictException);
  });
});
