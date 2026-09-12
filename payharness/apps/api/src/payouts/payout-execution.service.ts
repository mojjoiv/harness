import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import {
  PayoutExecutionInput,
  PayoutExecutionResult,
} from './payout-provider.interface';
import { PayoutProviderRegistry } from './payout-provider.registry';
import { PayoutRecord } from './payouts.service';

@Injectable()
export class PayoutExecutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: PayoutProviderRegistry,
  ) {}

  async executePayout(merchantId: string, payoutId: string): Promise<PayoutRecord> {
    const payout = await this.findPayout(merchantId, payoutId);
    if (!payout) throw new NotFoundException('Payout not found');

    if (payout.status === 'SUCCEEDED') return payout;
    if (payout.status === 'PROCESSING') {
      throw new BadRequestException('Payout is already processing');
    }
    if (payout.status !== 'PENDING') {
      throw new BadRequestException(`Payout cannot be executed from status ${payout.status}`);
    }

    const claimed = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE payouts
      SET status = 'PROCESSING', updated_at = CURRENT_TIMESTAMP
      WHERE id = ${payoutId}
        AND merchant_id = ${merchantId}
        AND status = 'PENDING'
    `);

    if (claimed !== 1) {
      const current = await this.findPayout(merchantId, payoutId);
      if (!current) throw new NotFoundException('Payout not found');
      if (current.status === 'SUCCEEDED') return current;
      if (current.status === 'PROCESSING') {
        throw new BadRequestException('Payout is already processing');
      }
      throw new BadRequestException(`Payout cannot be executed from status ${current.status}`);
    }

    const input: PayoutExecutionInput = {
      payoutId: payout.id,
      merchantId: payout.merchantId,
      amountCents: payout.amountCents,
      currency: payout.currency,
      provider: payout.provider,
      environment: payout.environment,
      recipientType: payout.recipientType,
      recipientPhone: payout.recipientPhone,
      recipientName: payout.recipientName,
      metadata: payout.metadata,
    };

    try {
      const result = await this.providers.execute(input);
      return this.markSucceeded(merchantId, payoutId, result);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Payout provider execution failed';
      await this.markFailed(merchantId, payoutId, reason);
      throw error;
    }
  }

  private async markSucceeded(
    merchantId: string,
    payoutId: string,
    result: PayoutExecutionResult,
  ): Promise<PayoutRecord> {
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE payouts
      SET
        status = 'SUCCEEDED',
        provider_reference = ${result.providerReference},
        failure_reason = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${payoutId} AND merchant_id = ${merchantId}
    `);

    const payout = await this.findPayout(merchantId, payoutId);
    if (!payout) throw new NotFoundException('Payout not found');
    return payout;
  }

  private async markFailed(
    merchantId: string,
    payoutId: string,
    reason: string,
  ): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE payouts
      SET
        status = 'FAILED',
        failure_reason = ${reason},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${payoutId}
        AND merchant_id = ${merchantId}
        AND status = 'PROCESSING'
    `);
  }

  private async findPayout(
    merchantId: string,
    payoutId: string,
  ): Promise<PayoutRecord | null> {
    const rows = await this.prisma.$queryRaw<PayoutRecord[]>(Prisma.sql`
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
      WHERE id = ${payoutId} AND merchant_id = ${merchantId}
      LIMIT 1
    `);
    return rows[0] || null;
  }
}
