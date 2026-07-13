import { Injectable, NotFoundException } from '@nestjs/common';
import { MerchantStatus } from '@prisma/client';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class PlatformMerchantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  list(status?: MerchantStatus) {
    return this.prisma.merchant.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        profile: true,
        users: {
          where: { role: 'OWNER' },
          include: { user: true },
          take: 1,
        },
        subscriptions: {
          include: { plan: true },
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
        _count: { select: { users: true, apiKeys: true, transactions: true } },
      },
    });
  }

  approve(id: string, platformUserId: string) {
    return this.updateStatus(id, MerchantStatus.ACTIVE, 'platform.merchant.approved', platformUserId);
  }

  reject(id: string, platformUserId: string) {
    return this.updateStatus(id, MerchantStatus.REJECTED, 'platform.merchant.rejected', platformUserId);
  }

  suspend(id: string, platformUserId: string) {
    return this.updateStatus(id, MerchantStatus.SUSPENDED, 'platform.merchant.suspended', platformUserId);
  }

  activate(id: string, platformUserId: string) {
    return this.updateStatus(id, MerchantStatus.ACTIVE, 'platform.merchant.activated', platformUserId);
  }

  private async updateStatus(id: string, status: MerchantStatus, action: string, platformUserId: string) {
    const merchant = await this.prisma.merchant.findUnique({ where: { id } });
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    const updated = await this.prisma.merchant.update({
      where: { id },
      data: { status },
    });

    await this.auditLogs.create({
      merchantId: id,
      action,
      entity: 'merchant',
      entityId: id,
      metadata: {
        platformUserId,
        previousStatus: merchant.status,
        status,
      },
    });

    return updated;
  }
}
