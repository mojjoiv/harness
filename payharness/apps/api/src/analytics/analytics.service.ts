import { Injectable } from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { AnalyticsQueryDto } from './analytics-query.dto';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

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
