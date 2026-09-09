import { PaymentStatus, Provider } from '@prisma/client';
import { PaypalWebhookService } from './paypal-webhook.service';

describe('PaypalWebhookService', () => {
  function mocks() {
    return {
      prisma: {
        providerCredential: { findMany: jest.fn() },
        webhookDelivery: { create: jest.fn() },
        payment: { findFirst: jest.fn(), update: jest.fn() },
        transaction: { updateMany: jest.fn() },
        checkoutSession: { update: jest.fn() },
        $queryRaw: jest.fn(),
      },
      crypto: { decrypt: jest.fn() },
      auditLogs: { create: jest.fn() },
    };
  }

  it('records a verified completion and settles the PayPal payment', async () => {
    const { prisma, crypto, auditLogs } = mocks();
    prisma.providerCredential.findMany.mockResolvedValue([
      { id: 'credential-1', environment: 'SANDBOX', encryptedSecretConfig: {} },
    ]);
    crypto.decrypt.mockReturnValue({ webhookId: '5MY207380F799633P' });
    prisma.$queryRaw.mockResolvedValueOnce([{ id: 'delivery-1' }]);
    prisma.payment.findFirst.mockResolvedValue({
      id: 'payment-1',
      status: PaymentStatus.PENDING,
      checkoutSessionId: 'checkout-1',
    });
    auditLogs.create.mockResolvedValue({});

    const service = new PaypalWebhookService(prisma as any, crypto as any, auditLogs as any);
    jest.spyOn(service as any, 'verifySignature').mockResolvedValue(true);

    const result = await service.handle(
      'merchant-1',
      {
        'paypal-transmission-id': 'transmission-1',
        'paypal-transmission-time': new Date().toISOString(),
        'paypal-cert-url': 'https://api-m.sandbox.paypal.com/cert',
        'paypal-transmission-sig': 'signature',
      },
      Buffer.from('{"event_type":"PAYMENT.CAPTURE.COMPLETED"}'),
      {
        id: 'WH-EVENT-1',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: {
          supplementary_data: { related_ids: { order_id: 'ORDER-1' } },
        },
      },
    );

    expect(result).toEqual({ received: true, deliveryId: 'delivery-1' });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: 'payment-1' },
      data: { status: PaymentStatus.SUCCEEDED },
    });
    expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
      where: { paymentId: 'payment-1' },
      data: { status: PaymentStatus.SUCCEEDED },
    });
    expect(prisma.checkoutSession.update).toHaveBeenCalledWith({
      where: { id: 'checkout-1' },
      data: { status: PaymentStatus.SUCCEEDED },
    });
  });

  it('returns the existing delivery for a duplicate PayPal event', async () => {
    const { prisma, crypto, auditLogs } = mocks();
    prisma.providerCredential.findMany.mockResolvedValue([
      { id: 'credential-1', environment: 'SANDBOX', encryptedSecretConfig: {} },
    ]);
    crypto.decrypt.mockReturnValue({ webhookId: '5MY207380F799633P' });
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'delivery-1' }]);

    const service = new PaypalWebhookService(prisma as any, crypto as any, auditLogs as any);
    jest.spyOn(service as any, 'verifySignature').mockResolvedValue(true);

    await expect(
      service.handle(
        'merchant-1',
        {
          'paypal-transmission-id': 'transmission-1',
          'paypal-transmission-time': new Date().toISOString(),
          'paypal-cert-url': 'https://api-m.sandbox.paypal.com/cert',
          'paypal-transmission-sig': 'signature',
        },
        Buffer.from('{}'),
        { id: 'WH-EVENT-1', event_type: 'PAYMENT.CAPTURE.COMPLETED' },
      ),
    ).resolves.toEqual({ received: true, deliveryId: 'delivery-1', duplicate: true });
    expect(prisma.payment.findFirst).not.toHaveBeenCalled();
  });

  it('rejects a webhook when no configured PayPal webhook ID verifies it', async () => {
    const { prisma, crypto, auditLogs } = mocks();
    prisma.providerCredential.findMany.mockResolvedValue([
      { id: 'credential-1', environment: 'SANDBOX', encryptedSecretConfig: {} },
    ]);
    crypto.decrypt.mockReturnValue({});

    const service = new PaypalWebhookService(prisma as any, crypto as any, auditLogs as any);

    await expect(
      service.handle('merchant-1', {}, Buffer.from('{}'), {
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
      }),
    ).rejects.toThrow('Invalid PayPal webhook signature');
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});
