import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class PlatformSubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.merchantSubscription.findMany({
      orderBy: { startedAt: 'desc' },
      include: { merchant: true, plan: true },
    });
  }
}
