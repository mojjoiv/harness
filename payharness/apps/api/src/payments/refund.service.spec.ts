import { BadRequestException, ConflictException, NotFoundException, NotImplementedException } from '@nestjs/common';
import { RefundService } from './refund.service';

describe('RefundService', () => {
  const payment = {
    id: 'payment-1',
    merchantId: 'merchant-1',
    provider: 'STRIPE',
    environment: 'SANDBOX',
    amountCents: 1000,
    currency: 'USD',
    status: 'SUCCEEDED',
    providerReference: 'pi_test_123',
  } as any;

  const prisma = {
    payment: { findFirst: jest.fn() },
    transaction: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    providerCredential: { findFirst: jest.fn() },
  };
  const crypto = { decrypt: jest.fn() };
  const stripe = { refundPaymentIntent: jest.fn() };
  const paypal = { refundPayment: jest.fn() };
  const idempotency = {
    claim: jest.fn(),
    complete: jest.fn(),
    releaseForClientError: jest.fn(),
  };
  const auditLogs = { create: jest.fn() };

  let service: RefundService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RefundService(
      prisma as any,
      crypto as any,
      stripe as any,
      paypal as any,
      idempotency as any,
      auditLogs as any,
    );
    prisma.payment.findFirst.mockResolvedValue(payment);
    prisma.transaction.findFirst.mockResolvedValue(null);
    prisma.transaction.findMany.mockResolvedValue([]);
    idempotency.claim.mockResolvedValue({
      claim: {
        id: 'claim-1',
        merchantId: 'merchant-1',
        environment: 'SANDBOX',
        key: 'refund:payment:payment-1',
        requestHash: 'hash',
      },
    });
    stripe.refundPaymentIntent.mockResolvedValue({
      id: 're_test_123',
      status: 'succeeded',
      amount: 1000,
      currency: 'USD',
    });
    prisma.transaction.create.mockResolvedValue({ id: 'tx-1' });
    crypto.decrypt.mockReturnValue({ secretKey: 'sk_test' });
    prisma.providerCredential.findFirst.mockResolvedValue({
      encryptedSecretConfig: { iv: 'iv', tag: 'tag', data: 'data' },
    });
  });

  it('refunds a succeeded Stripe payment in full when no amount is supplied', async () => {
    await expect(service.refund('merchant-1', undefined, 'payment-1')).resolves.toMatchObject({
      paymentId: 'payment-1',
      status: 'REFUNDED',
      provider: 'STRIPE',
      refundId: 're_test_123',
      amountCents: 1000,
      refundedAmountCents: 1000,
      remainingAmountCents: 0,
    });
    expect(stripe.refundPaymentIntent).toHaveBeenCalledWith('sk_test', 'pi_test_123', 1000);
    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'REFUND', status: 'SUCCEEDED', amountCents: 1000 }),
      }),
    );
    expect(idempotency.complete).toHaveBeenCalled();
    expect(auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'payment.refunded', entityId: 'payment-1' }),
    );
  });

  it('creates a partial Stripe refund and reports the remaining refundable amount', async () => {
    stripe.refundPaymentIntent.mockResolvedValue({
      id: 're_partial_1',
      status: 'succeeded',
      amount: 300,
      currency: 'USD',
    });

    await expect(
      service.refund('merchant-1', undefined, 'payment-1', undefined, 300),
    ).resolves.toMatchObject({
      status: 'PARTIALLY_REFUNDED',
      refundId: 're_partial_1',
      amountCents: 300,
      refundedAmountCents: 300,
      remainingAmountCents: 700,
    });
    expect(stripe.refundPaymentIntent).toHaveBeenCalledWith('sk_test', 'pi_test_123', 300);
    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amountCents: 300 }),
      }),
    );
  });

  it('allows multiple partial refunds without exceeding the original payment', async () => {
    prisma.transaction.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ amountCents: 300 }]);
    stripe.refundPaymentIntent
      .mockResolvedValueOnce({ id: 're_partial_1', status: 'succeeded', amount: 300 })
      .mockResolvedValueOnce({ id: 're_partial_2', status: 'succeeded', amount: 700 });

    await expect(
      service.refund('merchant-1', undefined, 'payment-1', 'partial-key-1', 300),
    ).resolves.toMatchObject({ status: 'PARTIALLY_REFUNDED', remainingAmountCents: 700 });
    await expect(
      service.refund('merchant-1', undefined, 'payment-1', 'partial-key-2', 700),
    ).resolves.toMatchObject({ status: 'REFUNDED', remainingAmountCents: 0 });
  });

  it('rejects a refund that exceeds the remaining refundable amount', async () => {
    prisma.transaction.findMany.mockResolvedValue([{ amountCents: 600 }]);

    await expect(
      service.refund('merchant-1', undefined, 'payment-1', undefined, 500),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(stripe.refundPaymentIntent).not.toHaveBeenCalled();
    expect(idempotency.claim).not.toHaveBeenCalled();
  });

  it('rejects a second full refund after the payment is fully refunded', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      reference: 're_existing',
      amountCents: 1000,
      currency: 'USD',
    });
    prisma.transaction.findMany.mockResolvedValue([{ amountCents: 1000 }]);

    await expect(service.refund('merchant-1', undefined, 'payment-1')).resolves.toMatchObject({
      status: 'REFUNDED',
      refundId: 're_existing',
      idempotent: true,
    });
    expect(stripe.refundPaymentIntent).not.toHaveBeenCalled();
    expect(idempotency.claim).not.toHaveBeenCalled();
  });

  it('refunds a succeeded PayPal payment through the PayPal capture', async () => {
    prisma.payment.findFirst.mockResolvedValue({
      ...payment,
      provider: 'PAYPAL',
      providerReference: 'ORDER-1',
    });
    paypal.refundPayment.mockResolvedValue({
      refundId: 'PAYPAL-REFUND-1',
      amountCents: 1000,
    });

    await expect(service.refund('merchant-1', undefined, 'payment-1')).resolves.toMatchObject({
      status: 'REFUNDED',
      provider: 'PAYPAL',
      refundId: 'PAYPAL-REFUND-1',
    });
    expect(paypal.refundPayment).toHaveBeenCalledWith(
      'merchant-1',
      undefined,
      'payment-1',
      1000,
    );
  });

  it('rejects M-Pesa refunds until reversal automation is implemented', async () => {
    prisma.payment.findFirst.mockResolvedValue({ ...payment, provider: 'MPESA' });

    await expect(service.refund('merchant-1', undefined, 'payment-1')).rejects.toBeInstanceOf(
      NotImplementedException,
    );
    expect(stripe.refundPaymentIntent).not.toHaveBeenCalled();
    expect(paypal.refundPayment).not.toHaveBeenCalled();
    expect(idempotency.releaseForClientError).toHaveBeenCalled();
  });

  it('rejects pending or failed payments', async () => {
    prisma.payment.findFirst.mockResolvedValue({ ...payment, status: 'PENDING' });

    await expect(service.refund('merchant-1', undefined, 'payment-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(idempotency.releaseForClientError).toHaveBeenCalled();
  });

  it('does not reveal another merchant payment', async () => {
    prisma.payment.findFirst.mockResolvedValue(null);

    await expect(service.refund('merchant-2', undefined, 'payment-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(stripe.refundPaymentIntent).not.toHaveBeenCalled();
  });
});
