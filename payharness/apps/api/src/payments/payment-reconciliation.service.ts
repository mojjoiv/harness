import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { PaymentsService } from './payments.service';

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_MIN_AGE_MS = 2 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 50;

@Injectable()
export class PaymentReconciliationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentReconciliationService.name);
  private interval?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
  ) {}

  onModuleInit(): void {
    if (process.env.PAYMENT_RECONCILIATION_ENABLED === 'false') {
      this.logger.log('Automatic payment reconciliation is disabled');
      return;
    }

    const intervalMs = this.readPositiveInteger(
      process.env.PAYMENT_RECONCILIATION_INTERVAL_MS,
      DEFAULT_INTERVAL_MS,
    );
    this.interval = setInterval(() => {
      void this.reconcilePendingPayments();
    }, intervalMs);
    this.interval.unref();
    this.logger.log(`Automatic payment reconciliation enabled every ${intervalMs}ms`);
  }

  onModuleDestroy(): void {
    if (this.interval) clearInterval(this.interval);
  }

  async reconcilePendingPayments(): Promise<{
    scanned: number;
    reconciled: number;
    failed: number;
  }> {
    if (this.running) return { scanned: 0, reconciled: 0, failed: 0 };
    this.running = true;

    try {
      const minAgeMs = this.readPositiveInteger(
        process.env.PAYMENT_RECONCILIATION_MIN_AGE_MS,
        DEFAULT_MIN_AGE_MS,
      );
      const batchSize = this.readPositiveInteger(
        process.env.PAYMENT_RECONCILIATION_BATCH_SIZE,
        DEFAULT_BATCH_SIZE,
      );
      const cutoff = new Date(Date.now() - minAgeMs);
      const pendingPayments = await this.prisma.payment.findMany({
        where: {
          status: PaymentStatus.PENDING,
          createdAt: { lt: cutoff },
        },
        orderBy: { createdAt: 'asc' },
        take: batchSize,
        select: { id: true, merchantId: true },
      });

      let reconciled = 0;
      let failed = 0;
      for (const payment of pendingPayments) {
        try {
          const result = await this.payments.queryPayment(
            payment.merchantId,
            undefined,
            payment.id,
          );
          if (result.status !== PaymentStatus.PENDING) reconciled += 1;
        } catch (error) {
          failed += 1;
          this.logger.warn(
            `Payment reconciliation failed paymentId=${payment.id}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }

      return { scanned: pendingPayments.length, reconciled, failed };
    } finally {
      this.running = false;
    }
  }

  private readPositiveInteger(value: string | undefined, fallback: number): number {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }
}
