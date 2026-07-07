import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class PlatformDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const [merchants, subscriptions, platformUsers, plans] = await Promise.all([
      this.prisma.merchant.count(),
      this.prisma.merchantSubscription.count(),
      this.prisma.platformUser.count(),
      this.prisma.subscriptionPlan.count(),
    ]);

    return { merchants, subscriptions, platformUsers, plans };
  }
}
