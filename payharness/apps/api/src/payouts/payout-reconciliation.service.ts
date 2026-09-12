import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { PayoutExecutionInput } from './payout-provider.interface';
import { PayoutProviderRegistry } from './payout-provider.registry';
import { PayoutRecord } from './payouts.service';

export type PayoutReconciliationSummary = {
  scanned: number;
  claimed: number;
  succeeded: number;
  failed: number;
  unresolved: number;
};

@Injectable()
export class PayoutReconciliationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PayoutReconciliationService.name);
  private interval: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: PayoutProviderRegistry,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    if (!this.enabled()) return;

    this.interval = setInterval(() => {
      void this.reconcileStalePayouts().catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Automatic payout reconciliation failed: ${message}`);
      });
    }, this.intervalMs());
  }

  onModuleDestroy(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async reconcileStalePayouts(merchantId?: string): Promise<PayoutReconciliationSummary> {
    const staleAfterMs = this.staleAfterMs();
    const cutoff = new Date(Date.now() - staleAfterMs);
    const merchantClause = merchantId
      ? Prisma.sql`AND merchant_id = ${merchantId}`
      : Prisma.empty;

    const candidates = await this.prisma.$queryRaw<PayoutRecord[]>(Prisma.sql`
      SELECT
        id,
        merchant_id AS "merchantId",
        amount_cents AS "amountCents",
        currency,
        provider,
        environment,
        status,
        recipient_type AS "recipientType",
        recipient_phone AS "recipientPhone",
        recipient_name AS "recipientName",
        provider_reference AS "providerReference",
        metadata,
        failure_reason AS "failureReason",
        idempotency_key AS "idempotencyKey",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM payouts
      WHERE status = 'PROCESSING'
        AND updated_at < ${cutoff}
        ${merchantClause}
      ORDER BY updated_at ASC
      LIMIT 100
    `);

    const summary: PayoutReconciliationSummary = {
      scanned: candidates.length,
      claimed: 0,
      succeeded: 0,
      failed: 0,
      unresolved: 0,
    };

    for (const payout of candidates) {
      const claimed = await this.claim(payout, cutoff);
      if (!claimed) continue;
      summary.claimed += 1;

      try {
        const result = await this.providers.reconcile(this.input(payout));
        await this.recordAttempt(payout, result.status, result.providerStatus, result.details);

        if (result.status === 'SUCCEEDED') {
          await this.finalize(payout, 'SUCCEEDED', null);
          summary.succeeded += 1;
        } else if (result.status === 'FAILED') {
          const reason =
            result.details?.failureReason && typeof result.details.failureReason === 'string'
              ? result.details.failureReason
              : result.providerStatus || 'Provider reported payout failure';
          await this.finalize(payout, 'FAILED', reason);
          summary.failed += 1;
        } else {
          await this.clearClaim(payout, result.status, result.providerStatus, result.details);
          summary.unresolved += 1;
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Reconciliation failed';
        this.logger.error(
          `Payout reconciliation failed payoutId=${payout.id} merchantId=${payout.merchantId}: ${reason}`,
        );
        await this.recordAttempt(payout, 'UNKNOWN', undefined, { error: reason });
        await this.clearClaim(payout, 'UNKNOWN', undefined, { error: reason });
        summary.unresolved += 1;
      }
    }

    return summary;
  }

  private async claim(payout: PayoutRecord, cutoff: Date): Promise<boolean> {
    const claimUntil = new Date(Date.now() + this.claimTtlMs()).toISOString();
    const result = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE payouts
      SET
        metadata = metadata || ${JSON.stringify({
          reconciliationClaimedAt: new Date().toISOString(),
          reconciliationClaimUntil: claimUntil,
        })}::jsonb,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${payout.id}
        AND status = 'PROCESSING'
        AND updated_at < ${cutoff}
        AND (
          metadata->>'reconciliationClaimUntil' IS NULL
          OR (metadata->>'reconciliationClaimUntil')::timestamptz < CURRENT_TIMESTAMP
        )
    `);
    return result === 1;
  }

  private async finalize(
    payout: PayoutRecord,
    status: 'SUCCEEDED' | 'FAILED',
    failureReason: string | null,
  ): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE payouts
      SET
        status = ${status},
        failure_reason = ${failureReason},
        metadata = metadata - 'reconciliationClaimedAt' - 'reconciliationClaimUntil',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${payout.id}
        AND merchant_id = ${payout.merchantId}
        AND status = 'PROCESSING'
    `);
  }

  private async clearClaim(
    payout: PayoutRecord,
    status: string,
    providerStatus?: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    const reconciliation = {
      status,
      ...(providerStatus ? { providerStatus } : {}),
      ...(details || {}),
      checkedAt: new Date().toISOString(),
    };

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE payouts
      SET
        metadata = (metadata - 'reconciliationClaimedAt' - 'reconciliationClaimUntil')
          || ${JSON.stringify({ reconciliation })}::jsonb,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${payout.id}
        AND merchant_id = ${payout.merchantId}
        AND status = 'PROCESSING'
    `);
  }

  private async recordAttempt(
    payout: PayoutRecord,
    outcome: string,
    providerStatus?: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO payout_reconciliation_attempts (
        id,
        payout_id,
        merchant_id,
        provider,
        outcome,
        provider_status,
        details
      ) VALUES (
        ${randomUUID()},
        ${payout.id},
        ${payout.merchantId},
        ${payout.provider}::"Provider",
        ${outcome},
        ${providerStatus || null},
        ${JSON.stringify(details || {})}::jsonb
      )
    `);
  }

  private input(payout: PayoutRecord): PayoutExecutionInput {
    return {
      payoutId: payout.id,
      merchantId: payout.merchantId,
      amountCents: payout.amountCents,
      currency: payout.currency,
      provider: payout.provider,
      environment: payout.environment,
      recipientType: payout.recipientType,
      recipientPhone: payout.recipientPhone,
      recipientName: payout.recipientName,
      providerReference: payout.providerReference,
      metadata: payout.metadata,
    };
  }

  private enabled(): boolean {
    return String(this.config.get<string>('PAYOUT_RECONCILIATION_ENABLED') ?? 'true') === 'true';
  }

  private intervalMs(): number {
    const configured = Number(
      this.config.get<string>('PAYOUT_RECONCILIATION_INTERVAL_MS') || 300000,
    );
    return Number.isFinite(configured) && configured > 0 ? configured : 300000;
  }

  private staleAfterMs(): number {
    const configured = Number(
      this.config.get<string>('PAYOUT_RECONCILIATION_STALE_MS') || 900000,
    );
    return Number.isFinite(configured) && configured > 0 ? configured : 900000;
  }

  private claimTtlMs(): number {
    const configured = Number(
      this.config.get<string>('PAYOUT_RECONCILIATION_CLAIM_TTL_MS') || 300000,
    );
    return Number.isFinite(configured) && configured > 0 ? configured : 300000;
  }
}
