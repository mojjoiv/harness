import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { WebhookDeliveryService } from '../webhooks/webhook-delivery.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { Provider } from '@prisma/client';

const RETRY_SWEEP_INTERVAL_MS = 10_000;
const JOB_LEASE_MS = 120_000;
const JOB_BATCH_SIZE = 10;

@Injectable()
export class WebhookDeliveriesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WebhookDeliveriesService.name);
  private sweepTimer?: NodeJS.Timeout;
  private sweepInProgress = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly deliveryService: WebhookDeliveryService,
    private readonly webhooksService: WebhooksService,
  ) {}

  onModuleInit() {
    this.sweepTimer = setInterval(() => void this.retryPending(), RETRY_SWEEP_INTERVAL_MS);
    void this.retryPending();
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
      await this.recoverStaleJobs();
      await this.processBackgroundJobs();
      await this.processPendingDeliveries();
    } finally {
      this.sweepInProgress = false;
    }
  }

  private async processPendingDeliveries() {
    const pending = await this.listPending();
    for (const delivery of pending) {
      const claimed = await this.prisma.webhookDelivery.updateMany({
        where: { id: delivery.id, status: 'PENDING' },
        data: { status: 'PROCESSING' },
      });
      if (claimed.count !== 1) continue;

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
  }

  private async processBackgroundJobs() {
    for (let i = 0; i < JOB_BATCH_SIZE; i += 1) {
      const jobs = await this.prisma.$queryRaw<
        Array<{ id: string; type: string; payload: unknown; attempts: number; max_attempts: number }>
      >`
        UPDATE "background_jobs"
        SET "status" = 'PROCESSING'::"Status",
            "attempts" = "attempts" + 1,
            "locked_at" = CURRENT_TIMESTAMP
        WHERE "id" = (
          SELECT "id"
          FROM "background_jobs"
          WHERE "status" = 'PENDING'::"Status"
            AND "run_at" <= CURRENT_TIMESTAMP
          ORDER BY "run_at" ASC, "created_at" ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        RETURNING "id", "type", "payload", "attempts", "max_attempts"
      `;

      const job = jobs[0];
      if (!job) return;

      try {
        await this.handleJob(job.type, job.payload);
        await this.prisma.backgroundJob.updateMany({
          where: { id: job.id, status: 'PROCESSING', attempts: job.attempts },
          data: { status: 'SUCCEEDED', lockedAt: null, lastError: null },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const exhausted = job.attempts >= job.max_attempts;
        const delaySeconds = Math.min(300, 2 ** Math.max(0, job.attempts - 1));

        await this.prisma.backgroundJob.updateMany({
          where: { id: job.id, status: 'PROCESSING', attempts: job.attempts },
          data: {
            status: exhausted ? 'FAILED' : 'PENDING',
            runAt: exhausted ? undefined : new Date(Date.now() + delaySeconds * 1000),
            lockedAt: null,
            lastError: message.slice(0, 4096),
          },
        });

        this.logger.warn(
          `Background job ${job.id} failed attempt ${job.attempts}/${job.max_attempts}: ${message}`,
        );
      }
    }
  }

  private async handleJob(type: string, payload: unknown) {
    if (type !== 'provider.webhook.process') {
      throw new Error(`Unknown background job type: ${type}`);
    }

    if (!payload || typeof payload !== 'object') {
      throw new Error('Background job payload is invalid');
    }

    const data = payload as { provider?: string; payload?: Record<string, unknown> };
    if (!data.provider || !data.payload) {
      throw new Error('Provider webhook job payload is incomplete');
    }

    await this.webhooksService.processProviderPaymentEvent(
      data.provider as Provider,
      data.payload,
    );
  }

  private async recoverStaleJobs() {
    const cutoff = new Date(Date.now() - JOB_LEASE_MS);

    await this.prisma.backgroundJob.updateMany({
      where: {
        status: 'PROCESSING',
        lockedAt: { lt: cutoff },
      },
      data: {
        status: 'PENDING',
        lockedAt: null,
        runAt: new Date(),
      },
    });
  }
}
