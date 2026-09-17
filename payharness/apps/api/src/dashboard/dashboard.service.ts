import { Injectable } from '@nestjs/common';
import { PaymentStatus, Status } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { DisplayCurrencyService } from '../common/currency/display-currency.service';
import { currencyForCountry } from '../common/utils/country-currency.util';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly displayCurrency: DisplayCurrencyService,
  ) {}

  async get(merchantId: string) {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [
      todayRevenueByCurrency,
      todayTransactions,
      successfulPayments,
      failedPayments,
      pendingPayments,
      activeApiKeys,
      connectedProviders,
      subscription,
      monthlyPayments,
      monthlyCheckoutSessions,
      profile,
    ] = await Promise.all([
      this.prisma.transaction.groupBy({
        by: ['currency'],
        where: { merchantId, status: PaymentStatus.SUCCEEDED, createdAt: { gte: startOfDay, lt: endOfDay } },
        _sum: { amountCents: true },
      }),
      this.prisma.transaction.count({ where: { merchantId, createdAt: { gte: startOfDay, lt: endOfDay } } }),
      this.prisma.payment.count({ where: { merchantId, status: PaymentStatus.SUCCEEDED } }),
      this.prisma.payment.count({ where: { merchantId, status: PaymentStatus.FAILED } }),
      this.prisma.payment.count({ where: { merchantId, status: PaymentStatus.PENDING } }),
      this.prisma.apiKey.count({ where: { merchantId, status: Status.ACTIVE } }),
      this.prisma.providerCredential.findMany({
        where: { merchantId, status: Status.ACTIVE },
        distinct: ['provider'],
        select: { provider: true },
      }),
      this.prisma.merchantSubscription.findFirst({
        where: { merchantId, status: Status.ACTIVE },
        include: { plan: true },
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.payment.count({ where: { merchantId, createdAt: { gte: startOfMonth, lt: endOfMonth } } }),
      this.prisma.checkoutSession.count({ where: { merchantId, createdAt: { gte: startOfMonth, lt: endOfMonth } } }),
      this.prisma.merchantProfile.findUnique({
        where: { merchantId },
        select: { country: true, currency: true },
      }),
    ]);

    const displayCurrency = profile?.currency?.trim().toUpperCase() || currencyForCountry(profile?.country);
    const convertedRevenue = await Promise.all(
      todayRevenueByCurrency.map((row) =>
        this.displayCurrency.convertAmount(row._sum.amountCents || 0, row.currency, displayCurrency),
      ),
    );
    const todayRevenue = convertedRevenue.reduce((total, conversion) => total + conversion.displayAmountCents, 0);

    return {
      todayRevenue,
      displayCurrency,
      todayTransactions,
      successfulPayments,
      failedPayments,
      pendingPayments,
      activeApiKeys,
      connectedProviders: connectedProviders.map((credential) => credential.provider),
      subscriptionPlan: subscription?.plan.code || 'FREE',
      monthlyUsage: {
        payments: monthlyPayments,
        checkoutSessions: monthlyCheckoutSessions,
      },
    };
  }
}
