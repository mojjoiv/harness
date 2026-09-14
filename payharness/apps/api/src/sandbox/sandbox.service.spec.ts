import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { SandboxService } from './sandbox.service';

describe('SandboxService', () => {
  const prisma = {
    payment: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    transaction: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    checkoutSession: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    merchantSettings: {
      findUnique: jest.fn(),
    },
  } as any;
  const auditLogs = { create: jest.fn() } as any;
  const idempotency = {
    claim: jest.fn(),
    complete: jest.fn(),
    releaseForClientError: jest.fn(),
  } as any;
  const webhooks = { forwardToUrl: jest.fn() } as any;

  let service: SandboxService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.checkoutSession.findFirst.mockResolvedValue(null);
    prisma.merchantSettings.findUnique.mockResolvedValue(null);
    auditLogs.create.mockResolvedValue(undefined);
    webhooks.forwardToUrl.mockResolvedValue({ delivered: true });
    service = new SandboxService(prisma, auditLogs, idempotency, webhooks);
  });

  it('rejects JWT/live credentials from sandbox endpoints', () => {
    expect(() => service.assertSandboxApiKey({ type: 'merchant', environment: 'SANDBOX' })).toThrow(
      UnauthorizedException,
    );
    expect(() => service.assertSandboxApiKey({ type: 'api_key', environment: 'LIVE' })).toThrow(
      UnauthorizedException,
    );
  });

  it('creates a succeeded payment without provider credentials', async () => {
    prisma.payment.create.mockResolvedValue({ id: 'payment-1', transactions: [] });

    const result = await service.createPayment('merchant-1', undefined, {
      amountCents: 1500,
      currency: 'KES',
      provider: 'STRIPE',
    });

    expect(result.environment).toBe('SANDBOX');
    expect(result.status).toBe('SUCCEEDED');
    expect(result.providerReference).toMatch(/^sandbox_stripe_/);
    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ environment: 'SANDBOX' }) }),
    );
  });

  it('supports deterministic failed outcomes', async () => {
    prisma.payment.create.mockResolvedValue({ id: 'payment-2', transactions: [] });

    const result = await service.createPayment('merchant-1', undefined, {
      amountCents: 900,
      currency: 'USD',
      provider: 'MPESA',
      simulateOutcome: 'FAILED',
    });

    expect(result.status).toBe('FAILED');
  });

  it('rejects invalid payment amounts', async () => {
    await expect(
      service.createPayment('merchant-1', undefined, {
        amountCents: 0,
        currency: 'KES',
        provider: 'PAYPAL',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates sandbox refunds and records a transaction', async () => {
    prisma.payment.findFirst.mockResolvedValue({
      id: 'payment-1',
      provider: 'STRIPE',
      environment: 'SANDBOX',
      status: 'SUCCEEDED',
      amountCents: 1500,
      currency: 'KES',
    });
    prisma.transaction.findMany.mockResolvedValue([]);
    prisma.transaction.create.mockResolvedValue({});
    idempotency.claim.mockResolvedValue({ claim: { id: 'claim-1' } });

    const result = (await service.refund(
      'merchant-1',
      undefined,
      'payment-1',
      500,
      'refund-key-1',
    )) as {
      status: string;
      environment: string;
      remainingAmountCents: number;
    };

    expect(result.status).toBe('PARTIALLY_REFUNDED');
    expect(result.environment).toBe('SANDBOX');
    expect(result.remainingAmountCents).toBe(1000);
    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'REFUND', status: 'SUCCEEDED' }) }),
    );
    expect(idempotency.complete).toHaveBeenCalled();
  });

  it('replays an idempotent sandbox refund', async () => {
    prisma.payment.findFirst.mockResolvedValue({
      id: 'payment-1',
      provider: 'PAYPAL',
      environment: 'SANDBOX',
      status: 'SUCCEEDED',
      amountCents: 1000,
      currency: 'KES',
    });
    prisma.transaction.findMany.mockResolvedValue([]);
    idempotency.claim.mockResolvedValue({
      claim: { id: 'claim-1' },
      replay: { paymentId: 'payment-1', status: 'REFUNDED', idempotent: true },
    });

    const result = await service.refund('merchant-1', undefined, 'payment-1', 1000, 'refund-key-1');

    expect(result).toEqual({ paymentId: 'payment-1', status: 'REFUNDED', idempotent: true });
    expect(prisma.transaction.create).not.toHaveBeenCalled();
  });
});
