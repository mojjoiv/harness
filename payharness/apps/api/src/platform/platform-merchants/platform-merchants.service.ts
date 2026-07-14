import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { MerchantStatus } from '@prisma/client';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import { PrismaService } from '../../common/prisma.service';
import { MailerService } from '../../mailer/mailer.service';

@Injectable()
export class PlatformMerchantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
    private readonly mailer: MailerService,
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

  async assignPlan(id: string, planId: string, platformUserId: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id },
      include: { users: { where: { role: 'OWNER' }, include: { user: true }, take: 1 } },
    });
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }
    if (plan.status !== 'ACTIVE') {
      throw new ConflictException('Plan is not available for assignment');
    }

    const subscription = await this.prisma.merchantSubscription.create({
      data: {
        merchantId: id,
        planId,
      },
      include: { plan: true },
    });

    const ownerEmail = merchant.users[0]?.user.email;
    const ownerName = merchant.users[0]?.user.name || 'there';

    await this.auditLogs.create({
      merchantId: id,
      action: 'notification.subscription_changed',
      entity: 'merchant_subscription',
      entityId: subscription.id,
      metadata: {
        platformUserId,
        planId,
        planCode: plan.code,
        ownerEmail,
      },
    });

    if (ownerEmail) {
      await this.mailer.send({
        to: ownerEmail,
        subject: `Your PayHarness plan has changed`,
        text: `Hi ${ownerName},\n\n${merchant.name} is now on the ${plan.name} plan.`,
        html: `<p>Hi ${ownerName},</p><p>${merchant.name} is now on the <strong>${plan.name}</strong> plan.</p>`,
      });
    }

    return subscription;
  }

  private async updateStatus(id: string, status: MerchantStatus, action: string, platformUserId: string) {
    const merchant = await this.prisma.merchant.findFirst({
      where: { id },
      include: {
        users: { where: { role: 'OWNER' }, include: { user: true }, take: 1 },
      },
    });
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

    const ownerEmail = merchant.users[0]?.user.email;
    const ownerName = merchant.users[0]?.user.name || 'there';
    const notificationEvent = action.replace('platform.merchant.', 'notification.merchant_');
    await this.auditLogs.create({
      merchantId: id,
      action: notificationEvent,
      entity: 'merchant',
      entityId: id,
      metadata: { ownerEmail, status },
    });

    if (ownerEmail) {
      const copy = this.statusEmailCopy(status, merchant.name);
      await this.mailer.send({
        to: ownerEmail,
        subject: copy.subject,
        text: `Hi ${ownerName},\n\n${copy.body}`,
        html: `<p>Hi ${ownerName},</p><p>${copy.body}</p>`,
      });
    }

    return updated;
  }

  private statusEmailCopy(status: MerchantStatus, merchantName: string): { subject: string; body: string } {
    switch (status) {
      case MerchantStatus.ACTIVE:
        return {
          subject: `${merchantName} is now active on PayHarness`,
          body: `Your organization ${merchantName} has been approved and is now active on PayHarness. You can log in and start using the platform.`,
        };
      case MerchantStatus.REJECTED:
        return {
          subject: `Your PayHarness registration was not approved`,
          body: `Your registration for ${merchantName} was not approved. Please contact PayHarness support if you have questions.`,
        };
      case MerchantStatus.SUSPENDED:
        return {
          subject: `${merchantName} has been suspended on PayHarness`,
          body: `Your organization ${merchantName} has been suspended. Please contact PayHarness support for more information.`,
        };
      default:
        return {
          subject: `An update to your PayHarness account`,
          body: `There has been an update to ${merchantName}'s status on PayHarness.`,
        };
    }
  }
}
