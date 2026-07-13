import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PlanStatus } from '@prisma/client';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import { PrismaService } from '../../common/prisma.service';
import { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';

@Injectable()
export class PlatformPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  list() {
    return this.prisma.subscriptionPlan.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { subscriptions: true } } },
    });
  }

  async create(dto: CreatePlanDto, platformUserId: string) {
    const plan = await this.handleUniqueCode(() =>
      this.prisma.subscriptionPlan.create({
        data: {
          name: dto.name,
          code: dto.code,
          priceCents: dto.priceCents,
          annualPriceCents: dto.annualPriceCents,
          currency: dto.currency || 'USD',
          apiRequestLimit: dto.apiRequestLimit,
          transactionLimit: dto.transactionLimit,
          userLimit: dto.userLimit,
          storageLimitMb: dto.storageLimitMb,
          webhookLimit: dto.webhookLimit,
          allowedProviders: dto.allowedProviders || [],
        },
      }),
    );

    await this.auditLogs.create({
      action: 'platform.plan.created',
      entity: 'subscription_plan',
      entityId: plan.id,
      metadata: { platformUserId, code: plan.code },
    });

    return plan;
  }

  async update(id: string, dto: UpdatePlanDto, platformUserId: string) {
    await this.getOrThrow(id);

    const plan = await this.handleUniqueCode(() =>
      this.prisma.subscriptionPlan.update({
        where: { id },
        data: {
          ...dto,
        },
      }),
    );

    await this.auditLogs.create({
      action: 'platform.plan.updated',
      entity: 'subscription_plan',
      entityId: id,
      metadata: { platformUserId, changes: dto },
    });

    return plan;
  }

  async suspend(id: string, platformUserId: string) {
    await this.getOrThrow(id);

    const plan = await this.prisma.subscriptionPlan.update({
      where: { id },
      data: { status: PlanStatus.SUSPENDED },
    });

    await this.auditLogs.create({
      action: 'platform.plan.suspended',
      entity: 'subscription_plan',
      entityId: id,
      metadata: { platformUserId },
    });

    return plan;
  }

  async reactivate(id: string, platformUserId: string) {
    await this.getOrThrow(id);

    const plan = await this.prisma.subscriptionPlan.update({
      where: { id },
      data: { status: PlanStatus.ACTIVE },
    });

    await this.auditLogs.create({
      action: 'platform.plan.reactivated',
      entity: 'subscription_plan',
      entityId: id,
      metadata: { platformUserId },
    });

    return plan;
  }

  async remove(id: string, platformUserId: string) {
    await this.getOrThrow(id);

    const activeSubscribers = await this.prisma.merchantSubscription.count({
      where: { planId: id, status: 'ACTIVE' },
    });

    if (activeSubscribers > 0) {
      throw new ConflictException('Plan has active subscribers and cannot be deleted');
    }

    await this.prisma.subscriptionPlan.delete({ where: { id } });

    await this.auditLogs.create({
      action: 'platform.plan.deleted',
      entity: 'subscription_plan',
      entityId: id,
      metadata: { platformUserId },
    });

    return { id, deleted: true };
  }

  private async getOrThrow(id: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }
    return plan;
  }

  private async handleUniqueCode<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Plan code already exists');
      }
      throw error;
    }
  }
}
