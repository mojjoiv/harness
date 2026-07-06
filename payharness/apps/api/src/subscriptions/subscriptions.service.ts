import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  current(merchantId: string) {
    return this.prisma.merchantSubscription.findFirst({
      where: { merchantId, status: 'ACTIVE' },
      include: { plan: true },
    });
  }
}
