import { Injectable } from '@nestjs/common';
import { PaymentStatus, Status } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async get(merchantId: string) {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [
      todayRevenue,
      todayTransactions,
      successfulPayments,
      failedPayments,
      pendingPayments,
      activeApiKeys,
      connectedProviders,
      subscription,
      monthlyPayments,
      monthlyCheckoutSessions,
    ] = await Promise.all([
      this.prisma.transaction.aggregate({
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
    ]);

    return {
      todayRevenue: todayRevenue._sum.amountCents || 0,
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
