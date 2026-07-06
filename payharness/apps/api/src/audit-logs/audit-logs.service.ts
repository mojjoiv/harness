import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
}
