import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class PlatformMerchantsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.merchant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        subscriptions: {
          include: { plan: true },
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
        _count: { select: { users: true, apiKeys: true, transactions: true } },
      },
    });
  }
}
