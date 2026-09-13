import { Injectable } from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { AdvancedReportDto } from './advanced-report.dto';
import { AnalyticsQueryDto } from './analytics-query.dto';

export type AdvancedReportSummary = {
  paymentCount: number;
  grossVolumeCents: number;
  successfulCount: number;
  successfulVolumeCents: number;
  failedCount: number;
  failedVolumeCents: number;
  refundCount: number;
  refundedVolumeCents: number;
  payoutCount: number;
  payoutVolumeCents: number;
  netVolumeCents: number;
  successRate: number;
};

export type AdvancedReportResult = {
  period: { startDate: string; endDate: string };
  summary: AdvancedReportSummary;
  byProvider: Array<{
    provider: string;
    paymentCount: number;
    grossVolumeCents: number;
    successfulCount: number;
    failedCount: number;
    successRate: number;
  }>;
  byCurrency: Array<{
    currency: string;
    grossVolumeCents: number;
    refundedVolumeCents: number;
    payoutVolumeCents: number;
    netVolumeCents: number;
  }>;
  daily: Array<{
    date: string;
    grossVolumeCents: number;
    refundedVolumeCents: number;
    payoutVolumeCents: number;
    netVolumeCents: number;
  }>;
  comparison?: {
    previousPeriod: { startDate: string; endDate: string };
    summary: AdvancedReportSummary;
    changes: {
      grossVolumePct: number | null;
      successRatePoints: number | null;
      refundedVolumePct: number | null;
      payoutVolumePct: number | null;
      netVolumePct: number | null;
    };
  };
};

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async advancedReport(
    merchantId: string,
    query: AdvancedReportDto,
  ): Promise<AdvancedReportResult> {
    const now = new Date();
    const end = query.endDate ? this.endOfDate(query.endDate) : now;
    const start = query.startDate
      ? new Date(query.startDate)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (start > end) {
      throw new Error('startDate must be before endDate');
    }

    const durationMs = end.getTime() - start.getTime();
    const previousEnd = new Date(start.getTime() - 1);
    const previousStart = new Date(previousEnd.getTime() - durationMs);
    const compare = query.compare === 'true';

    const rows = await this.prisma.$queryRaw<
      Array<{
        current_summary: unknown;
        current_providers: unknown;
        current_currencies: unknown;
        current_daily: unknown;
        previous_summary: unknown;
      }>
    >(Prisma.sql`
      WITH
      current_payments AS (
        SELECT id, provider::text AS provider, currency, amount_cents, status, created_at
        FROM payments
        WHERE merchant_id = ${merchantId}
          AND created_at >= ${start}
          AND created_at <= ${end}
      ),
      current_refunds AS (
        SELECT t.id, t.amount_cents, t.currency, t.created_at
        FROM transactions t
        WHERE t.merchant_id = ${merchantId}
          AND t.type = 'REFUND'
          AND t.status = 'SUCCEEDED'
          AND t.created_at >= ${start}
          AND t.created_at <= ${end}
      ),
      current_payouts AS (
        SELECT id, amount_cents, currency, created_at
        FROM payouts
        WHERE merchant_id = ${merchantId}
          AND created_at >= ${start}
          AND created_at <= ${end}
      ),
      current_summary AS (
        SELECT
          COUNT(*)::bigint AS "paymentCount",
          COALESCE(SUM(amount_cents), 0)::bigint AS "grossVolumeCents",
          COUNT(*) FILTER (WHERE status = 'SUCCEEDED')::bigint AS "successfulCount",
          COALESCE(SUM(amount_cents) FILTER (WHERE status = 'SUCCEEDED'), 0)::bigint AS "successfulVolumeCents",
          COUNT(*) FILTER (WHERE status = 'FAILED')::bigint AS "failedCount",
          COALESCE(SUM(amount_cents) FILTER (WHERE status = 'FAILED'), 0)::bigint AS "failedVolumeCents",
          (SELECT COUNT(*) FROM current_refunds)::bigint AS "refundCount",
          (SELECT COALESCE(SUM(amount_cents), 0) FROM current_refunds)::bigint AS "refundedVolumeCents",
          (SELECT COUNT(*) FROM current_payouts)::bigint AS "payoutCount",
          (SELECT COALESCE(SUM(amount_cents), 0) FROM current_payouts)::bigint AS "payoutVolumeCents"
        FROM current_payments
      ),
      current_providers AS (
        SELECT COALESCE(jsonb_agg(row_to_json(x) ORDER BY x.provider), '[]'::jsonb) AS value
        FROM (
          SELECT
            provider,
            COUNT(*)::bigint AS "paymentCount",
            COALESCE(SUM(amount_cents), 0)::bigint AS "grossVolumeCents",
            COUNT(*) FILTER (WHERE status = 'SUCCEEDED')::bigint AS "successfulCount",
            COUNT(*) FILTER (WHERE status = 'FAILED')::bigint AS "failedCount",
            CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND(COUNT(*) FILTER (WHERE status = 'SUCCEEDED')::numeric * 100 / COUNT(*), 2) END AS "successRate"
          FROM current_payments
          GROUP BY provider
        ) x
      ),
      current_currencies AS (
        SELECT COALESCE(jsonb_agg(row_to_json(x) ORDER BY x.currency), '[]'::jsonb) AS value
        FROM (
          SELECT
            currency,
            COALESCE(SUM(amount_cents), 0)::bigint AS "grossVolumeCents",
            COALESCE((SELECT SUM(r.amount_cents) FROM current_refunds r WHERE r.currency = p.currency), 0)::bigint AS "refundedVolumeCents",
            COALESCE((SELECT SUM(po.amount_cents) FROM current_payouts po WHERE po.currency = p.currency), 0)::bigint AS "payoutVolumeCents"
          FROM current_payments p
          GROUP BY currency
        ) x
      ),
      current_daily AS (
        SELECT COALESCE(jsonb_agg(row_to_json(x) ORDER BY x.date), '[]'::jsonb) AS value
        FROM (
          SELECT
            d.date::date AS date,
            COALESCE((SELECT SUM(p.amount_cents) FROM current_payments p WHERE p.created_at::date = d.date), 0)::bigint AS "grossVolumeCents",
            COALESCE((SELECT SUM(r.amount_cents) FROM current_refunds r WHERE r.created_at::date = d.date), 0)::bigint AS "refundedVolumeCents",
            COALESCE((SELECT SUM(po.amount_cents) FROM current_payouts po WHERE po.created_at::date = d.date), 0)::bigint AS "payoutVolumeCents"
          FROM generate_series(${start}::date, ${end}::date, interval '1 day') d(date)
        ) x
      ),
      previous_payments AS (
        SELECT amount_cents, status
        FROM payments
        WHERE merchant_id = ${merchantId}
          AND created_at >= ${previousStart}
          AND created_at <= ${previousEnd}
      ),
      previous_refunds AS (
        SELECT amount_cents
        FROM transactions
        WHERE merchant_id = ${merchantId}
          AND type = 'REFUND'
          AND status = 'SUCCEEDED'
          AND created_at >= ${previousStart}
          AND created_at <= ${previousEnd}
      ),
      previous_payouts AS (
        SELECT amount_cents
        FROM payouts
        WHERE merchant_id = ${merchantId}
          AND created_at >= ${previousStart}
          AND created_at <= ${previousEnd}
      ),
      previous_summary AS (
        SELECT jsonb_build_object(
          'paymentCount', COUNT(*),
          'grossVolumeCents', COALESCE(SUM(amount_cents), 0),
          'successfulCount', COUNT(*) FILTER (WHERE status = 'SUCCEEDED'),
          'successfulVolumeCents', COALESCE(SUM(amount_cents) FILTER (WHERE status = 'SUCCEEDED'), 0),
          'failedCount', COUNT(*) FILTER (WHERE status = 'FAILED'),
          'failedVolumeCents', COALESCE(SUM(amount_cents) FILTER (WHERE status = 'FAILED'), 0),
          'refundCount', (SELECT COUNT(*) FROM previous_refunds),
          'refundedVolumeCents', (SELECT COALESCE(SUM(amount_cents), 0) FROM previous_refunds),
          'payoutCount', (SELECT COUNT(*) FROM previous_payouts),
          'payoutVolumeCents', (SELECT COALESCE(SUM(amount_cents), 0) FROM previous_payouts)
        ) AS value
        FROM previous_payments
      )
      SELECT
        to_jsonb(current_summary.*) AS current_summary,
        (SELECT value FROM current_providers) AS current_providers,
        (SELECT value FROM current_currencies) AS current_currencies,
        (SELECT value FROM current_daily) AS current_daily,
        (SELECT value FROM previous_summary) AS previous_summary
      FROM current_summary
    `);

    const row = rows[0];
    const summary = this.normalizeSummary(row?.current_summary);
    const currencies = this.normalizeCurrencies(row?.current_currencies);
    const daily = this.normalizeDaily(row?.current_daily);

    const result: AdvancedReportResult = {
      period: { startDate: start.toISOString(), endDate: end.toISOString() },
      summary,
      byProvider: this.normalizeProviders(row?.current_providers),
      byCurrency: currencies.map((item) => ({
        ...item,
        netVolumeCents: item.grossVolumeCents - item.refundedVolumeCents - item.payoutVolumeCents,
      })),
      daily: daily.map((item) => ({
        ...item,
        netVolumeCents: item.grossVolumeCents - item.refundedVolumeCents - item.payoutVolumeCents,
      })),
    };

    if (compare) {
      const previousSummary = this.normalizeSummary(row?.previous_summary);
      result.comparison = {
        previousPeriod: {
          startDate: previousStart.toISOString(),
          endDate: previousEnd.toISOString(),
        },
        summary: previousSummary,
        changes: {
          grossVolumePct: this.percentChange(previousSummary.grossVolumeCents, summary.grossVolumeCents),
          successRatePoints: Number((summary.successRate - previousSummary.successRate).toFixed(2)),
          refundedVolumePct: this.percentChange(previousSummary.refundedVolumeCents, summary.refundedVolumeCents),
          payoutVolumePct: this.percentChange(previousSummary.payoutVolumeCents, summary.payoutVolumeCents),
          netVolumePct: this.percentChange(previousSummary.netVolumeCents, summary.netVolumeCents),
        },
      };
    }

    return result;
  }

  async revenue(merchantId: string, query: AnalyticsQueryDto) {
    const range = this.range(query);
    const transactions = await this.prisma.transaction.findMany({
      where: {
        merchantId,
        status: PaymentStatus.SUCCEEDED,
        createdAt: range,
      },
      select: { amountCents: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    return this.toSeries(transactions, (transaction) => transaction.amountCents);
  }

  async providers(merchantId: string, query: AnalyticsQueryDto) {
    const rows = await this.prisma.payment.groupBy({
      by: ['provider'],
      where: { merchantId, createdAt: this.range(query) },
      _count: { _all: true },
      _sum: { amountCents: true },
    });

    return rows.map((row) => ({
      provider: row.provider,
      count: row._count._all,
      amountCents: row._sum.amountCents || 0,
    }));
  }

  async payments(merchantId: string, query: AnalyticsQueryDto) {
    const rows = await this.prisma.payment.groupBy({
      by: ['status'],
      where: { merchantId, createdAt: this.range(query) },
      _count: { _all: true },
      _sum: { amountCents: true },
    });

    return rows.map((row) => ({
      status: row.status,
      count: row._count._all,
      amountCents: row._sum.amountCents || 0,
    }));
  }

  private normalizeSummary(value: unknown): AdvancedReportSummary {
    const item = (value ?? {}) as Record<string, unknown>;
    const grossVolumeCents = Number(item.grossVolumeCents ?? 0);
    const refundedVolumeCents = Number(item.refundedVolumeCents ?? 0);
    const payoutVolumeCents = Number(item.payoutVolumeCents ?? 0);
    const paymentCount = Number(item.paymentCount ?? 0);
    const successfulCount = Number(item.successfulCount ?? 0);
    return {
      paymentCount,
      grossVolumeCents,
      successfulCount,
      successfulVolumeCents: Number(item.successfulVolumeCents ?? 0),
      failedCount: Number(item.failedCount ?? 0),
      failedVolumeCents: Number(item.failedVolumeCents ?? 0),
      refundCount: Number(item.refundCount ?? 0),
      refundedVolumeCents,
      payoutCount: Number(item.payoutCount ?? 0),
      payoutVolumeCents,
      netVolumeCents: grossVolumeCents - refundedVolumeCents - payoutVolumeCents,
      successRate: paymentCount === 0 ? 0 : Number(((successfulCount * 100) / paymentCount).toFixed(2)),
    };
  }

  private normalizeProviders(value: unknown) {
    return Array.isArray(value)
      ? value.map((item) => {
          const row = item as Record<string, unknown>;
          return {
            provider: String(row.provider),
            paymentCount: Number(row.paymentCount ?? 0),
            grossVolumeCents: Number(row.grossVolumeCents ?? 0),
            successfulCount: Number(row.successfulCount ?? 0),
            failedCount: Number(row.failedCount ?? 0),
            successRate: Number(row.successRate ?? 0),
          };
        })
      : [];
  }

  private normalizeCurrencies(value: unknown) {
    return Array.isArray(value)
      ? value.map((item) => {
          const row = item as Record<string, unknown>;
          return {
            currency: String(row.currency),
            grossVolumeCents: Number(row.grossVolumeCents ?? 0),
            refundedVolumeCents: Number(row.refundedVolumeCents ?? 0),
            payoutVolumeCents: Number(row.payoutVolumeCents ?? 0),
          };
        })
      : [];
  }

  private normalizeDaily(value: unknown) {
    return Array.isArray(value)
      ? value.map((item) => {
          const row = item as Record<string, unknown>;
          return {
            date: String(row.date).slice(0, 10),
            grossVolumeCents: Number(row.grossVolumeCents ?? 0),
            refundedVolumeCents: Number(row.refundedVolumeCents ?? 0),
            payoutVolumeCents: Number(row.payoutVolumeCents ?? 0),
          };
        })
      : [];
  }

  private percentChange(previous: number, current: number): number | null {
    if (previous === 0) return current === 0 ? 0 : null;
    return Number((((current - previous) / Math.abs(previous)) * 100).toFixed(2));
  }

  private range(query: AnalyticsQueryDto): Prisma.DateTimeFilter {
    const now = new Date();
    const to = query.to ? this.endOfDate(query.to) : now;
    let from: Date;

    if (query.from) {
      from = new Date(query.from);
    } else if (query.period === 'weekly') {
      from = new Date(now);
      from.setDate(from.getDate() - 6);
      from.setHours(0, 0, 0, 0);
    } else if (query.period === 'monthly') {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      from = new Date(now);
      from.setHours(0, 0, 0, 0);
    }

    return { gte: from, lte: to };
  }

  private endOfDate(value: string) {
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return date;
  }

  private toSeries<T extends { createdAt: Date }>(rows: T[], value: (row: T) => number) {
    const grouped = new Map<string, number>();
    rows.forEach((row) => {
      const key = row.createdAt.toISOString().slice(0, 10);
      grouped.set(key, (grouped.get(key) || 0) + value(row));
    });
    return Array.from(grouped.entries()).map(([date, amountCents]) => ({ date, amountCents }));
  }
}
