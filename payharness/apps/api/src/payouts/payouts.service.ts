import { Injectable, NotFoundException } from '@nestjs/common';
import { Environment, Prisma, Provider } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { CreatePayoutDto } from './dto/create-payout.dto';

export type PayoutRecord = {
  id: string;
  merchantId: string;
  amountCents: number;
  currency: string;
  provider: Provider;
  environment: Environment;
  status: string;
  recipientType: string;
  recipientPhone: string | null;
  recipientName: string | null;
  providerReference: string | null;
  metadata: unknown;
  failureReason: string | null;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class PayoutsService {
  constructor(private readonly prisma: PrismaService) {}

  async createPayout(
    merchantId: string,
    dto: CreatePayoutDto,
    idempotencyKey: string,
  ): Promise<PayoutRecord> {
    const existing = await this.findByIdempotencyKey(
      merchantId,
      dto.environment,
      idempotencyKey,
    );
    if (existing) return existing;

    const id = randomUUID();

    try {
      await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO payouts (
          id,
          merchant_id,
          amount_cents,
          currency,
          provider,
          environment,
          status,
          recipient_type,
          recipient_phone,
          recipient_name,
          metadata,
          idempotency_key,
          updated_at
        ) VALUES (
          ${id},
          ${merchantId},
          ${dto.amountCents},
          ${dto.currency.toUpperCase()},
          ${dto.provider}::"Provider",
          ${dto.environment}::"Environment",
          'PENDING',
          ${dto.recipientType},
          ${dto.recipientPhone ?? null},
          ${dto.recipientName ?? null},
          ${JSON.stringify(dto.metadata ?? {})}::jsonb,
          ${idempotencyKey},
          CURRENT_TIMESTAMP
        )
      `);
    } catch (error) {
      const concurrent = await this.findByIdempotencyKey(
        merchantId,
        dto.environment,
        idempotencyKey,
      );
      if (concurrent) return concurrent;
      throw error;
    }

    const payout = await this.findById(merchantId, id);
    if (!payout) throw new NotFoundException('Payout could not be created');

    return payout;
  }

  async getPayout(merchantId: string, id: string): Promise<PayoutRecord> {
    const payout = await this.findById(merchantId, id);
    if (!payout) throw new NotFoundException('Payout not found');
    return payout;
  }

  private async findById(
    merchantId: string,
    id: string,
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
      WHERE id = ${id} AND merchant_id = ${merchantId}
      LIMIT 1
    `);
    return rows[0] || null;
  }

  private async findByIdempotencyKey(
    merchantId: string,
    environment: Environment,
    idempotencyKey: string,
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
      WHERE merchant_id = ${merchantId}
        AND environment = ${environment}::"Environment"
        AND idempotency_key = ${idempotencyKey}
      LIMIT 1
    `);
    return rows[0] || null;
  }
}
