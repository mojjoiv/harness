import { WebhookDeliveryService } from './webhook-delivery.service';

describe('WebhookDeliveryService', () => {
  function prismaMock() {
    return {
      webhookDelivery: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
    };
  }

  function configMock() {
    return {
      get: jest.fn((key: string) => {
        if (key === 'WEBHOOK_MAX_ATTEMPTS') return '3';
        if (key === 'WEBHOOK_RETRY_DELAYS_MS') return '0,0,0';
        return undefined;
      }),
    };
  }

  it('delivers a pending webhook, signs it, and records the response', async () => {
    const prisma = prismaMock();
    prisma.webhookDelivery.findUnique.mockResolvedValue({
      id: 'delivery-1',
      status: 'PENDING',
      attempts: 0,
      responseCode: null,
      endpoint: {
        id: 'endpoint-1',
        url: 'https://merchant.example/webhook',
        status: 'ACTIVE',
        secretHash: 'secret-hash',
      },
      eventType: 'payment.succeeded',
      payload: { type: 'payment.succeeded' },
    });
    prisma.webhookDelivery.update.mockResolvedValue({});

    const service = new WebhookDeliveryService(prisma as any, configMock() as any);
    const postJson = jest
      .spyOn(service as any, 'postJson')
      .mockResolvedValue({ statusCode: 200, body: 'ok' });

    const result = await service.deliver('delivery-1');

    expect(result).toEqual({
      delivered: true,
      deliveryId: 'delivery-1',
      attempts: 1,
      responseCode: 200,
      signatureAlgorithm: 'HMAC-SHA256',
    });
    expect(postJson).toHaveBeenCalledWith(
      'https://merchant.example/webhook',
      { type: 'payment.succeeded' },
      'secret-hash',
      'payment.succeeded',
    );
  });

  it('does not send a webhook twice after it has succeeded', async () => {
    const prisma = prismaMock();
    prisma.webhookDelivery.findUnique.mockResolvedValue({
      id: 'delivery-1',
      status: 'SUCCEEDED',
      attempts: 1,
      responseCode: 200,
      endpoint: { id: 'endpoint-1', url: 'https://merchant.example/webhook', status: 'ACTIVE' },
      payload: { type: 'payment.succeeded' },
    });

    const service = new WebhookDeliveryService(prisma as any, configMock() as any);
    const postJson = jest.spyOn(service as any, 'postJson');

    const result = await service.deliver('delivery-1');

    expect((result as any).alreadyDelivered).toBe(true);
    expect(postJson).not.toHaveBeenCalled();
    expect(prisma.webhookDelivery.update).not.toHaveBeenCalled();
  });

  it('reuses an existing payment delivery when the same event is forwarded again', async () => {
    const prisma = prismaMock();
    prisma.webhookDelivery.findUnique.mockResolvedValue({
      id: 'existing-delivery',
      status: 'SUCCEEDED',
      attempts: 1,
      responseCode: 200,
      payload: { paymentId: 'payment-1', event: 'payment.succeeded' },
    });

    const service = new WebhookDeliveryService(prisma as any, configMock() as any);
    const postJson = jest.spyOn(service as any, 'postJson');

    const result = await service.deliverToUrl(
      'https://merchant.example/webhook',
      'payment.succeeded',
      { paymentId: 'payment-1', event: 'payment.succeeded' },
    );

    expect((result as any).alreadyDelivered).toBe(true);
    expect(result.deliveryId).toBe('existing-delivery');
    expect(postJson).not.toHaveBeenCalled();
    expect(prisma.webhookDelivery.create).not.toHaveBeenCalled();
  });

  it('retries connection failures and marks delivery failed after the final attempt', async () => {
    const prisma = prismaMock();
    prisma.webhookDelivery.findUnique.mockResolvedValue({
      id: 'delivery-1',
      status: 'FAILED',
      attempts: 3,
      responseCode: 500,
      endpoint: {
        id: 'endpoint-1',
        url: 'https://merchant.example/webhook',
        status: 'ACTIVE',
        secretHash: 'secret-hash',
      },
      eventType: 'payment.failed',
      payload: { type: 'payment.failed' },
    });
    prisma.webhookDelivery.update.mockResolvedValue({});

    const service = new WebhookDeliveryService(prisma as any, configMock() as any);
    jest.spyOn(service as any, 'postJson').mockRejectedValue(new Error('connection refused'));
    jest.spyOn(service as any, 'sleep').mockResolvedValue(undefined);

    const result = await service.deliver('delivery-1');

    expect(result).toEqual({
      delivered: false,
      deliveryId: 'delivery-1',
      attempts: 3,
      error: 'connection refused',
    });
    expect((service as any).postJson).toHaveBeenCalledTimes(3);
    expect(prisma.webhookDelivery.update).toHaveBeenLastCalledWith({
      where: { id: 'delivery-1' },
      data: expect.objectContaining({ status: 'FAILED' }),
    });
  });

  it('does not retry a permanent 4xx response', async () => {
    const prisma = prismaMock();
    prisma.webhookDelivery.findUnique.mockResolvedValue({
      id: 'delivery-4xx',
      status: 'PENDING',
      attempts: 0,
      endpoint: {
        id: 'endpoint-1',
        url: 'https://merchant.example/webhook',
        status: 'ACTIVE',
        secretHash: 'secret-hash',
      },
      eventType: 'payment.failed',
      payload: { type: 'payment.failed' },
    });
    prisma.webhookDelivery.update.mockResolvedValue({});

    const service = new WebhookDeliveryService(prisma as any, configMock() as any);
    jest.spyOn(service as any, 'postJson').mockRejectedValue(new Error('Webhook endpoint responded with 400'));

    const isRetryable = jest.spyOn(service as any, 'isRetryableError').mockReturnValue(false);
    const result = await service.deliver('delivery-4xx');

    expect(result).toMatchObject({ delivered: false, deliveryId: 'delivery-4xx', attempts: 1 });
    expect((service as any).postJson).toHaveBeenCalledTimes(1);
    expect(isRetryable).toHaveBeenCalled();
  });
});
