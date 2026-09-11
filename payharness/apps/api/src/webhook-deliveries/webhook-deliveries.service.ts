import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { WebhookDeliveryService } from '../webhooks/webhook-delivery.service';

const RETRY_SWEEP_INTERVAL_MS = 30_000;

@Injectable()
export class WebhookDeliveriesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WebhookDeliveriesService.name);
  private sweepTimer?: NodeJS.Timeout;
  private sweepInProgress = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly deliveryService: WebhookDeliveryService,
  ) {}

  onModuleInit() {
    this.sweepTimer = setInterval(() => void this.retryPending(), RETRY_SWEEP_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
  }

  listPending() {
    return this.prisma.webhookDelivery.findMany({
      where: { status: 'PENDING', endpoint: { isNot: null } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async retryPending() {
    if (this.sweepInProgress) return;
    this.sweepInProgress = true;

    try {
      const pending = await this.listPending();
      for (const delivery of pending) {
        try {
          await this.deliveryService.deliver(delivery.id);
        } catch (error) {
          this.logger.warn(
            `Pending webhook delivery ${delivery.id} could not be recovered: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    } finally {
      this.sweepInProgress = false;
    }
  }
}
