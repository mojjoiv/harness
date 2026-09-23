import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { CheckoutSessionsService } from './checkout-sessions.service';

describe('CheckoutSessionsService', () => {
  const branding = {
    merchantName: 'Test Merchant',
    logoUrl: null,
    faviconUrl: null,
    primaryColor: '#2563eb',
    secondaryColor: '#0f172a',
    buttonColor: '#2563eb',
    successPageMessage: null,
    cancelPageMessage: null,
    receiptFooter: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const buildService = (overrides: { settings?: Record<string, unknown> | null; nodeEnv?: string; checkoutUrl?: string } = {}) => {
    const prisma = {
      merchantSettings: {
        findUnique: jest.fn().mockResolvedValue(overrides.settings ?? null),
      },
      customer: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'customer-1' }),
      },
      checkoutSession: {
        create: jest.fn().mockResolvedValue({
          id: 'session-1',
          merchantId: 'merchant-1',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        }),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      payment: {
        findFirst: jest.fn(),
      },
    };
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'NODE_ENV') return overrides.nodeEnv ?? 'test';
        if (key === 'CHECKOUT_URL') return overrides.checkoutUrl ?? 'https://checkout.example.com';
        return undefined;
      }),
    };
    const auditLogs = { create: jest.fn().mockResolvedValue(undefined) };
    const brandingService = { get: jest.fn().mockResolvedValue(branding) };

    return {
      service: new CheckoutSessionsService(prisma as any, config as any, auditLogs as any, brandingService as any, { queryPayment: jest.fn().mockResolvedValue({ status: 'SUCCEEDED' }) } as any),
      prisma,
      auditLogs,
    };
  };

  it('reconciles a pending hosted payment through the provider query before returning status', async () => {
    const { service, prisma } = buildService();
    prisma.checkoutSession.findUnique = jest.fn()
      .mockResolvedValueOnce({
        id: 'session-1',
        merchantId: 'merchant-1',
        status: 'PENDING',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      })
      .mockResolvedValueOnce({
        id: 'session-1',
        merchantId: 'merchant-1',
        status: 'SUCCEEDED',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      });
    prisma.payment.findFirst.mockResolvedValue({
      id: 'payment-1',
      merchantId: 'merchant-1',
      checkoutSessionId: 'session-1',
      status: 'PENDING',
    });

    const result = await service.reconcilePublicPayment('session-1');

    expect(prisma.payment.findFirst).toHaveBeenCalledWith({
      where: { checkoutSessionId: 'session-1', merchantId: 'merchant-1', status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    expect(result.status).toBe('SUCCEEDED');
  });

  it('uses per-session success and cancel URLs when supplied', async () => {
    const { service, prisma } = buildService({
      settings: { successUrl: 'https://merchant.example/success', cancelUrl: 'https://merchant.example/cancel' },
    });

    await service.create('merchant-1', undefined, {
      amountCents: 50000,
      currency: 'KES',
      successUrl: 'https://devfinder.example/jobs/1/payment?payment=success',
      cancelUrl: 'https://devfinder.example/jobs/1/payment?payment=cancelled',
    });

    expect(prisma.checkoutSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          successUrl: 'https://devfinder.example/jobs/1/payment?payment=success',
          cancelUrl: 'https://devfinder.example/jobs/1/payment?payment=cancelled',
        }),
      }),
    );
  });

  it('falls back to merchant dashboard URLs when per-session URLs are omitted', async () => {
    const { service, prisma } = buildService({
      settings: { successUrl: 'https://merchant.example/success', cancelUrl: 'https://merchant.example/cancel' },
    });

    await service.create('merchant-1', undefined, {
      amountCents: 50000,
      currency: 'KES',
    });

    expect(prisma.checkoutSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          successUrl: 'https://merchant.example/success',
          cancelUrl: 'https://merchant.example/cancel',
        }),
      }),
    );
  });

  it('rejects checkout creation when a redirect URL is missing', async () => {
    const { service, prisma } = buildService();

    await expect(
      service.create('merchant-1', undefined, {
        amountCents: 50000,
        currency: 'KES',
        successUrl: 'https://example.com/success',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.checkoutSession.create).not.toHaveBeenCalled();
  });

  it('rejects invalid merchant redirect URLs', async () => {
    const { service, prisma } = buildService({
      settings: { successUrl: 'javascript:alert(1)', cancelUrl: 'https://example.com/cancel' },
    });

    await expect(
      service.create('merchant-1', undefined, {
        amountCents: 50000,
        currency: 'KES',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.checkoutSession.create).not.toHaveBeenCalled();
  });

  it('does not silently return localhost checkout URLs in production', async () => {
    const { service } = buildService({ nodeEnv: 'production', checkoutUrl: '' });

    await expect(
      service.create('merchant-1', undefined, {
        amountCents: 50000,
        currency: 'KES',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
