import { Provider } from '@prisma/client';
import { WebhooksService } from './webhooks.service';

describe('WebhooksService', () => {
  function mocks() {
    return {
      prisma: {
        webhookEndpoint: {
          create: jest.fn(),
          findMany: jest.fn(),
          count: jest.fn(),
          findFirst: jest.fn(),
          update: jest.fn(),
        },
        webhookDelivery: {
          create: jest.fn(),
          findFirst: jest.fn(),
        },
        merchant: {
          findUnique: jest.fn(),
        },
      },
      auditLogs: { create: jest.fn() },
      deliveryService: {
        deliver: jest.fn(),
        deliverToUrl: jest.fn(),
      },
    };
  }

  it('creates an endpoint, audits it, and never returns the secret hash', async () => {
    const { prisma, auditLogs, deliveryService } = mocks();
    prisma.webhookEndpoint.create.mockResolvedValue({
      id: 'endpoint-1',
      merchantId: 'merchant-1',
      url: 'https://merchant.example/webhook',
      events: ['payment.succeeded'],
      secretHash: 'hashed-secret',
    });
    auditLogs.create.mockResolvedValue({});

    const service = new WebhooksService(prisma as any, auditLogs as any, deliveryService as any);
    const result = await service.createEndpoint('merchant-1', 'user-1', {
      url: 'https://merchant.example/webhook',
      events: ['payment.succeeded'],
    });

    expect(result.id).toBe('endpoint-1');
    expect(result.secret).toMatch(/^whsec_/);
    expect(result.secretHash).toBeUndefined();
    expect(auditLogs.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'webhook.created',
      entityId: 'endpoint-1',
    }));
  });

  it('lists endpoints with pagination and removes secret hashes', async () => {
    const { prisma, auditLogs, deliveryService } = mocks();
    prisma.webhookEndpoint.findMany.mockResolvedValue([
      { id: 'endpoint-1', url: 'https://merchant.example/1', secretHash: 'secret-1' },
    ]);
    prisma.webhookEndpoint.count.mockResolvedValue(3);

    const service = new WebhooksService(prisma as any, auditLogs as any, deliveryService as any);
    const result = await service.listEndpoints('merchant-1', { page: 1, limit: 2, sort: 'url', order: 'asc' } as any);

    expect(result.items).toEqual([{ id: 'endpoint-1', url: 'https://merchant.example/1' }]);
    expect(result.meta).toEqual(expect.objectContaining({ page: 1, limit: 2, total: 3, totalPages: 2 }));
    expect(prisma.webhookEndpoint.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { merchantId: 'merchant-1' },
      orderBy: { url: 'asc' },
      skip: 0,
      take: 2,
    }));
  });

  it('disables an existing endpoint', async () => {
    const { prisma, auditLogs, deliveryService } = mocks();
    prisma.webhookEndpoint.findFirst.mockResolvedValue({ id: 'endpoint-1', merchantId: 'merchant-1' });
    prisma.webhookEndpoint.update.mockResolvedValue({ id: 'endpoint-1', status: 'INACTIVE', secretHash: 'secret' });

    const service = new WebhooksService(prisma as any, auditLogs as any, deliveryService as any);
    const result = await service.disableEndpoint('merchant-1', 'endpoint-1');

    expect(result).toEqual({ id: 'endpoint-1', status: 'INACTIVE' });
  });

  it('rejects disabling an unknown endpoint', async () => {
    const { prisma, auditLogs, deliveryService } = mocks();
    prisma.webhookEndpoint.findFirst.mockResolvedValue(null);

    const service = new WebhooksService(prisma as any, auditLogs as any, deliveryService as any);

    await expect(service.disableEndpoint('merchant-1', 'missing')).rejects.toThrow('Webhook endpoint not found');
  });

  it('creates and delivers a test webhook', async () => {
    const { prisma, auditLogs, deliveryService } = mocks();
    prisma.webhookEndpoint.findFirst.mockResolvedValue({ id: 'endpoint-1' });
    prisma.webhookDelivery.create.mockResolvedValue({ id: 'delivery-1' });
    deliveryService.deliver.mockResolvedValue({ delivered: true, deliveryId: 'delivery-1' });

    const service = new WebhooksService(prisma as any, auditLogs as any, deliveryService as any);
    const result = await service.testEndpoint('merchant-1', 'endpoint-1');

    expect(result).toEqual(expect.objectContaining({
      delivered: true,
      deliveryId: 'delivery-1',
      payload: expect.objectContaining({ type: 'webhook.test', endpointId: 'endpoint-1' }),
    }));
  });

  it('retries an existing delivery', async () => {
    const { prisma, auditLogs, deliveryService } = mocks();
    prisma.webhookDelivery.findFirst.mockResolvedValue({ id: 'delivery-1' });
    deliveryService.deliver.mockResolvedValue({ delivered: true, deliveryId: 'delivery-1' });

    const service = new WebhooksService(prisma as any, auditLogs as any, deliveryService as any);
    await expect(service.retryDelivery('merchant-1', 'delivery-1')).resolves.toEqual({
      delivered: true,
      deliveryId: 'delivery-1',
    });
  });

  it('forwards an event to a URL', async () => {
    const { prisma, auditLogs, deliveryService } = mocks();
    deliveryService.deliverToUrl.mockResolvedValue({ delivered: true, deliveryId: 'delivery-1' });

    const service = new WebhooksService(prisma as any, auditLogs as any, deliveryService as any);
    await expect(service.forwardToUrl(
      'https://merchant.example/webhook',
      'payment.succeeded',
      { paymentId: 'payment-1' },
    )).resolves.toEqual({ delivered: true, deliveryId: 'delivery-1' });
  });

  it('receives a provider webhook and records its event type', async () => {
    const { prisma, auditLogs, deliveryService } = mocks();
    prisma.webhookDelivery.create.mockResolvedValue({ id: 'delivery-1' });

    const service = new WebhooksService(prisma as any, auditLogs as any, deliveryService as any);
    await expect(service.receive(Provider.MPESA, { type: 'payment.succeeded' })).resolves.toEqual({
      received: true,
      deliveryId: 'delivery-1',
    });
    expect(prisma.webhookDelivery.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ provider: Provider.MPESA, eventType: 'payment.succeeded' }),
    }));
  });

  it('receives a merchant webhook after validating the merchant', async () => {
    const { prisma, auditLogs, deliveryService } = mocks();
    prisma.merchant.findUnique.mockResolvedValue({ id: 'merchant-1' });
    prisma.webhookDelivery.create.mockResolvedValue({ id: 'delivery-1' });

    const service = new WebhooksService(prisma as any, auditLogs as any, deliveryService as any);
    const result = await service.receiveForMerchant('stripe', 'merchant-1', { event: 'payment.succeeded' });

    expect(result).toEqual({ received: true, deliveryId: 'delivery-1' });
    expect(prisma.webhookDelivery.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ provider: Provider.STRIPE, eventType: 'payment.succeeded' }),
    }));
  });

  it('rejects a webhook for an unknown merchant', async () => {
    const { prisma, auditLogs, deliveryService } = mocks();
    prisma.merchant.findUnique.mockResolvedValue(null);

    const service = new WebhooksService(prisma as any, auditLogs as any, deliveryService as any);

    await expect(service.receiveForMerchant('stripe', 'missing', {})).rejects.toThrow('Unknown merchant');
  });
});
