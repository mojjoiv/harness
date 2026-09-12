import { Injectable, NotFoundException } from '@nestjs/common';
import { Environment, Prisma, Provider } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { CreatePayoutDto } from './dto/create-payout.dto';
import { ListPayoutsDto } from './dto/list-payouts.dto';
import { PayoutReportDto } from './dto/payout-report.dto';

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

export type PayoutListResult = {
  data: PayoutRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type PayoutReportBreakdown = {
  count: number;
  volumeCents: number;
};

export type PayoutReportResult = {
  totalCount: number;
  totalVolumeCents: number;
  successfulCount: number;
  successfulVolumeCents: number;
  failedCount: number;
  failedVolumeCents: number;
  pendingCount: number;
  pendingVolumeCents: number;
  successRate: number;
  byStatus: Record<string, PayoutReportBreakdown>;
  byProvider: Record<string, PayoutReportBreakdown>;
  byCurrency: Record<string, PayoutReportBreakdown>;
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

  async listPayouts(
    merchantId: string,
    dto: ListPayoutsDto,
  ): Promise<PayoutListResult> {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 25;
    const offset = (page - 1) * pageSize;

    const filters = [Prisma.sql`merchant_id = ${merchantId}`];

    if (dto.status) filters.push(Prisma.sql`status = ${dto.status}`);
    if (dto.provider) {
      filters.push(Prisma.sql`provider = ${dto.provider}::"Provider"`);
    }
    if (dto.environment) {
      filters.push(
        Prisma.sql`environment = ${dto.environment}::"Environment"`,
      );
    }
    if (dto.currency) {
      filters.push(Prisma.sql`currency = ${dto.currency.toUpperCase()}`);
    }
    if (dto.startDate) {
      filters.push(Prisma.sql`created_at >= ${new Date(dto.startDate)}`);
    }
    if (dto.endDate) {
      filters.push(Prisma.sql`created_at <= ${new Date(dto.endDate)}`);
    }
    if (dto.search) {
      const search = `%${dto.search}%`;
      filters.push(
        Prisma.sql`(
          id::text ILIKE ${search}
          OR provider_reference ILIKE ${search}
          OR recipient_phone ILIKE ${search}
        )`,
      );
    }

    const where = Prisma.join(filters, ' AND ');
    const rows = await this.prisma.$queryRaw<
      (PayoutRecord & { total: bigint })[]
    >(Prisma.sql`
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
        updated_at AS "updatedAt",
        COUNT(*) OVER() AS total
      FROM payouts
      WHERE ${where}
      ORDER BY created_at DESC, id DESC
      LIMIT ${pageSize}
      OFFSET ${offset}
    `);

    const total = rows.length > 0 ? Number(rows[0].total) : 0;

    return {
      data: rows.map(({ total: _total, ...payout }) => payout),
      total,
      page,
      pageSize,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async reportPayouts(
    merchantId: string,
    dto: PayoutReportDto,
  ): Promise<PayoutReportResult> {
    const filters = [Prisma.sql`merchant_id = ${merchantId}`];

    if (dto.startDate) {
      filters.push(Prisma.sql`created_at >= ${new Date(dto.startDate)}`);
    }
    if (dto.endDate) {
      filters.push(Prisma.sql`created_at <= ${new Date(dto.endDate)}`);
    }

    const where = Prisma.join(filters, ' AND ');
    const rows = await this.prisma.$queryRaw<
      Array<{
        totalCount: bigint;
        totalVolumeCents: bigint | null;
        successfulCount: bigint;
        successfulVolumeCents: bigint | null;
        failedCount: bigint;
        failedVolumeCents: bigint | null;
        pendingCount: bigint;
        pendingVolumeCents: bigint | null;
        successRate: number;
        byStatus: Record<string, { count: number; volumeCents: number }> | null;
        byProvider: Record<string, { count: number; volumeCents: number }> | null;
        byCurrency: Record<string, { count: number; volumeCents: number }> | null;
      }
    >`(Prisma.sql`
      WITH filtered AS (
        SELECT status, provider, currency, amount_cents
        FROM payouts
        WHERE ${where}
      ),
      overall AS (
        SELECT
          COUNT(*) AS "totalCount",
          COALESCE(SUM(amount_cents), 0) AS "totalVolumeCents",
          COUNT(*) FILTER (WHERE status = 'SUCCEEDED') AS "successfulCount",
          COALESCE(SUM(amount_cents) FILTER (WHERE status = 'SUCCEEDED'), 0) AS "successfulVolumeCents",
          COUNT(*) FILTER (WHERE status = 'FAILED') AS "failedCount",
          COALESCE(SUM(amount_cents) FILTER (WHERE status = 'FAILED'), 0) AS "failedVolumeCents",
          COUNT(*) FILTER (WHERE status IN ('PENDING', 'PROCESSING')) AS "pendingCount",
          COALESCE(SUM(amount_cents) FILTER (WHERE status IN ('PENDING', 'PROCESSING')), 0) AS "pendingVolumeCents",
          CASE
            WHEN COUNT(*) = 0 THEN 0
            ELSE ROUND(
              COUNT(*) FILTER (WHERE status = 'SUCCEEDED')::numeric * 100 / COUNT(*),
              2
            )
          END AS "successRate"
        FROM filtered
      ),
      status_breakdown AS (
        SELECT jsonb_object_agg(
          status,
          jsonb_build_object('count', count, 'volumeCents', volume_cents)
        ) AS value
        FROM (
          SELECT status, COUNT(*) AS count, COALESCE(SUM(amount_cents), 0) AS volume_cents
          FROM filtered
          GROUP BY status
        ) grouped
      ),
      provider_breakdown AS (
        SELECT jsonb_object_agg(
          provider::text,
          jsonb_build_object('count', count, 'volumeCents', volume_cents)
        ) AS value
        FROM (
          SELECT provider, COUNT(*) AS count, COALESCE(SUM(amount_cents), 0) AS volume_cents
          FROM filtered
          GROUP BY provider
        ) grouped
      ),
      currency_breakdown AS (
        SELECT jsonb_object_agg(
          currency,
          jsonb_build_object('count', count, 'volumeCents', volume_cents)
        ) AS value
        FROM (
          SELECT currency, COUNT(*) AS count, COALESCE(SUM(amount_cents), 0) AS volume_cents
          FROM filtered
          GROUP BY currency
        ) grouped
      )
      SELECT
        overall.*,
        COALESCE(status_breakdown.value, '{}'::jsonb) AS "byStatus",
        COALESCE(provider_breakdown.value, '{}'::jsonb) AS "byProvider",
        COALESCE(currency_breakdown.value, '{}'::jsonb) AS "byCurrency"
      FROM overall
      CROSS JOIN status_breakdown
      CROSS JOIN provider_breakdown
      CROSS JOIN currency_breakdown
    `);

    const row = rows[0];
    if (!row) {
      return {
        totalCount: 0,
        totalVolumeCents: 0,
        successfulCount: 0,
        successfulVolumeCents: 0,
        failedCount: 0,
        failedVolumeCents: 0,
        pendingCount: 0,
        pendingVolumeCents: 0,
        successRate: 0,
        byStatus: {},
        byProvider: {},
        byCurrency: {},
      };
    }

    return {
      totalCount: Number(row.totalCount),
      totalVolumeCents: Number(row.totalVolumeCents ?? 0),
      successfulCount: Number(row.successfulCount),
      successfulVolumeCents: Number(row.successfulVolumeCents ?? 0),
      failedCount: Number(row.failedCount),
      failedVolumeCents: Number(row.failedVolumeCents ?? 0),
      pendingCount: Number(row.pendingCount),
      pendingVolumeCents: Number(row.pendingVolumeCents ?? 0),
      successRate: Number(row.successRate),
      byStatus: row.byStatus ?? {},
      byProvider: row.byProvider ?? {},
      byCurrency: row.byCurrency ?? {},
    };
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
