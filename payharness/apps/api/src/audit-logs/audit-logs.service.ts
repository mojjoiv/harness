import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { getPagination, paginated } from '../common/pagination/pagination';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: { merchantId?: string; userId?: string; action: string; entity: string; entityId?: string; metadata?: unknown }) {
    return this.prisma.auditLog.create({
      data: {
        ...data,
        metadata: (data.metadata || {}) as Prisma.InputJsonValue,
      },
    });
  }

  async list(merchantId: string, query: PaginationQueryDto) {
    const pagination = getPagination(query, ['createdAt', 'action', 'entity']);
    const where: Prisma.AuditLogWhereInput = { merchantId };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { [pagination.sort]: pagination.order },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return paginated(items, total, pagination);
  }

  async listAll(query: PaginationQueryDto) {
    const pagination = getPagination(query, ['createdAt', 'action', 'entity']);
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        orderBy: { [pagination.sort]: pagination.order },
        skip: pagination.skip,
        take: pagination.take,
        include: {
          user: { select: { email: true, name: true } },
          merchant: { select: { name: true } },
        },
      }),
      this.prisma.auditLog.count(),
    ]);

    return paginated(items, total, pagination);
  }
}
