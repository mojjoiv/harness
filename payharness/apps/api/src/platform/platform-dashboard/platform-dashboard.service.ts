import { Injectable } from '@nestjs/common';
import { MerchantStatus, Status, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { PlatformExchangeRatesService } from '../platform-exchange-rates/platform-exchange-rates.service';

@Injectable()
export class PlatformDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exchangeRates: PlatformExchangeRatesService,
  ) {}

  async overview() {
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);

    const [
      merchantCounts,
      roleCounts,
      totalTransactions,
      activeSubscriptions,
      apiRequestsThisMonth,
      activeGateways,
    ] = await Promise.all([
      this.prisma.merchant.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.merchantUser.groupBy({ by: ['role'], _count: { _all: true } }),
      this.prisma.transaction.count(),
      this.prisma.merchantSubscription.findMany({
        where: {
          status: Status.ACTIVE,
          merchant: { status: MerchantStatus.ACTIVE },
        },
        select: { plan: { select: { priceCents: true, currency: true } } },
      }),
      this.prisma.apiUsage.count({ where: { createdAt: { gte: startOfMonth } } }),
      this.prisma.platformGatewayConfig.count({ where: { enabled: true } }),
    ]);

    const merchants = this.countsByKey(merchantCounts, Object.values(MerchantStatus));
    const users = this.countsByKey(roleCounts, Object.values(UserRole));
    const platformMrrCents = await this.calculateMrrUsdCents(activeSubscriptions);

    return {
      merchants: {
        total: Object.values(merchants).reduce((sum, count) => sum + count, 0),
        pending: merchants.PENDING || 0,
        active: merchants.ACTIVE || 0,
        suspended: merchants.SUSPENDED || 0,
        rejected: merchants.REJECTED || 0,
      },
      users: {
        total: Object.values(users).reduce((sum, count) => sum + count, 0),
        owners: users.OWNER || 0,
        admins: users.ADMIN || 0,
        developers: users.DEVELOPER || 0,
        viewers: users.VIEWER || 0,
      },
      totalTransactions,
      platformMrrCents,
      apiRequestsThisMonth,
      activeGateways,
    };
  }

  private countsByKey<T extends string>(
    grouped: Array<{ _count: { _all: number } } & Record<string, any>>,
    keys: T[],
  ): Record<T, number> {
    const result = Object.fromEntries(keys.map((key) => [key, 0])) as Record<T, number>;
    for (const row of grouped) {
      const key = (row.status ?? row.role) as T;
      result[key] = row._count._all;
    }
    return result;
  }

  private async calculateMrrUsdCents(subscriptions: Array<{ plan: { priceCents: number; currency: string } }>) {
    if (subscriptions.length === 0) {
      return 0;
    }

    let rates: Record<string, number> = {};
    try {
      rates = (await this.exchangeRates.getRates()).rates;
    } catch {
      // If rates are unavailable, fall back to treating every currency as USD
      // rather than failing the whole dashboard.
      rates = {};
    }

    return Math.round(
      subscriptions.reduce((sum, sub) => {
        const rate = sub.plan.currency === 'USD' ? 1 : rates[sub.plan.currency] || 1;
        return sum + sub.plan.priceCents / rate;
      }, 0),
    );
  }
}
