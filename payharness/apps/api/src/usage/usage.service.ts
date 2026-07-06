import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { getPagination, paginated } from '../common/pagination/pagination';
import { PrismaService } from '../common/prisma.service';
import { UsageQueryDto } from './usage-query.dto';

@Injectable()
export class UsageService {
  constructor(private readonly prisma: PrismaService) {}

  async list(merchantId: string, query: UsageQueryDto) {
    const pagination = getPagination(query, ['createdAt', 'method', 'endpoint', 'statusCode', 'responseTimeMs']);
    const where: Prisma.ApiUsageWhereInput = { merchantId };
    if (query.method) {
      where.method = query.method.toUpperCase();
    }
    if (query.endpoint) {
      where.endpoint = { contains: query.endpoint, mode: 'insensitive' };
    }
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.apiUsage.findMany({
        where,
        orderBy: { [pagination.sort]: pagination.order },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.apiUsage.count({ where }),
    ]);

    return paginated(items, total, pagination);
  }
}
