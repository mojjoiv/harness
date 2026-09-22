import { WebhookDeliveriesService } from './webhook-deliveries.service';

describe('WebhookDeliveriesService', () => {
  function createService() {
    const prisma: any = {
      webhookDelivery: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      backgroundJob: {
        updateMany: jest.fn(),
      },
      $queryRaw: jest.fn(),
    };
    const deliveryService = { deliver: jest.fn() };
    const webhooksService = { processProviderPaymentEvent: jest.fn() };
    const service = new WebhookDeliveriesService(
      prisma,
      deliveryService as any,
      webhooksService as any,
    );
    return { service, prisma, deliveryService, webhooksService };
  }

  it('claims and completes a provider webhook job', async () => {
    const { service, prisma, webhooksService } = createService();
    prisma.$queryRaw.mockResolvedValueOnce([
      {
        id: 'job-1',
        type: 'provider.webhook.process',
        payload: {
          provider: 'STRIPE',
          payload: { id: 'evt-1', type: 'payment_intent.succeeded' },
        },
        attempts: 1,
        max_attempts: 5,
      },
    ]);
    prisma.$queryRaw.mockResolvedValueOnce([]);
    prisma.webhookDelivery.findMany.mockResolvedValue([]);
    prisma.backgroundJob.updateMany.mockResolvedValue({ count: 1 });

    await service.retryPending();

    expect(webhooksService.processProviderPaymentEvent).toHaveBeenCalledWith(
      'STRIPE',
      expect.objectContaining({ id: 'evt-1' }),
    );
    expect(prisma.backgroundJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-1', status: 'PROCESSING', attempts: 1 },
        data: expect.objectContaining({ status: 'SUCCEEDED' }),
      }),
    );
  });

  it('requeues a failed provider webhook job with backoff', async () => {
    const { service, prisma, webhooksService } = createService();
    prisma.$queryRaw.mockResolvedValueOnce([
      {
        id: 'job-1',
        type: 'provider.webhook.process',
        payload: { provider: 'MPESA', payload: { id: 'evt-1' } },
        attempts: 1,
        max_attempts: 5,
      },
    ]);
    prisma.$queryRaw.mockResolvedValueOnce([]);
    prisma.webhookDelivery.findMany.mockResolvedValue([]);
    webhooksService.processProviderPaymentEvent.mockRejectedValue(new Error('temporary failure'));
    prisma.backgroundJob.updateMany.mockResolvedValue({ count: 1 });

    await service.retryPending();

    expect(prisma.backgroundJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-1', status: 'PROCESSING', attempts: 1 },
        data: expect.objectContaining({ status: 'PENDING', lastError: 'temporary failure' }),
      }),
    );
  });
});
