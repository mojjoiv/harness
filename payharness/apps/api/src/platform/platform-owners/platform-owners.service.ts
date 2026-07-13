import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class PlatformOwnersService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.merchantUser.findMany({
      where: { role: 'OWNER' },
      orderBy: { createdAt: 'desc' },
      include: {
        user: true,
        merchant: {
          include: {
            profile: true,
            subscriptions: {
              include: { plan: true },
              orderBy: { startedAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });
  }
}
