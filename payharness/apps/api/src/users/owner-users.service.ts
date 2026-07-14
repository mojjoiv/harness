import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { compareRoles } from '../common/authz/roles';
import { PrismaService } from '../common/prisma.service';
import { MailerService } from '../mailer/mailer.service';
import { CreateOwnerUserDto, UpdateOwnerUserDto } from './dto/owner-user.dto';

@Injectable()
export class OwnerUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
    private readonly mailer: MailerService,
  ) {}

  list(merchantId: string) {
    return this.prisma.merchantUser.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  async create(merchantId: string, actorUserId: string, actorRole: string, dto: CreateOwnerUserDto) {
    if (actorRole !== UserRole.OWNER && compareRoles(actorRole, dto.role) <= 0) {
      throw new ForbiddenException("You can't assign a role equal to or higher than your own");
    }

    let user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    let tempPassword: string | null = null;

    if (user) {
      const existingLink = await this.prisma.merchantUser.findUnique({
        where: { merchantId_userId: { merchantId, userId: user.id } },
      });
      if (existingLink) {
        throw new ConflictException('This person is already part of your team');
      }
    } else {
      tempPassword = this.generateTempPassword();
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      user = await this.prisma.user.create({
        data: { name: dto.name, email: dto.email, passwordHash },
      });
    }

    const merchantUser = await this.prisma.merchantUser.create({
      data: { merchantId, userId: user.id, role: dto.role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    const merchant = await this.prisma.merchant.findUnique({ where: { id: merchantId }, select: { name: true } });

    await this.auditLogs.create({
      merchantId,
      userId: actorUserId,
      action: 'notification.user_invited',
      entity: 'merchant_user',
      entityId: merchantUser.id,
      metadata: { invitedEmail: dto.email, role: dto.role },
    });

    if (tempPassword) {
      await this.mailer.send({
        to: dto.email,
        subject: `You've been added to ${merchant?.name || 'a team'} on PayHarness`,
        text:
          `Hi ${dto.name},\n\n` +
          `You've been added as a ${dto.role} to ${merchant?.name || 'an organization'} on PayHarness.\n\n` +
          `Your temporary password is: ${tempPassword}\n\n` +
          `Please log in and change your password as soon as possible.`,
        html:
          `<p>Hi ${dto.name},</p>` +
          `<p>You've been added as a <strong>${dto.role}</strong> to <strong>${merchant?.name || 'an organization'}</strong> on PayHarness.</p>` +
          `<p>Your temporary password is: <code>${tempPassword}</code></p>` +
          `<p>Please log in and change your password as soon as possible.</p>`,
      });
    } else {
      await this.mailer.send({
        to: dto.email,
        subject: `You've been added to ${merchant?.name || 'a team'} on PayHarness`,
        text:
          `Hi ${dto.name},\n\n` +
          `You've been added as a ${dto.role} to ${merchant?.name || 'an organization'} on PayHarness. ` +
          `You can log in with your existing PayHarness account.`,
      });
    }

    return merchantUser;
  }

  async update(merchantId: string, actorUserId: string, actorRole: string, targetId: string, dto: UpdateOwnerUserDto) {
    const target = await this.getOwnedMerchantUserOrThrow(merchantId, targetId);
    this.assertCanManageTarget(actorRole, target.role);

    if (dto.role && actorRole !== UserRole.OWNER && compareRoles(actorRole, dto.role) <= 0) {
      throw new ForbiddenException("You can't assign a role equal to or higher than your own");
    }

    const updated = await this.prisma.merchantUser.update({
      where: { id: target.id },
      data: { role: dto.role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    if (dto.name) {
      await this.prisma.user.update({ where: { id: target.userId }, data: { name: dto.name } });
    }

    await this.auditLogs.create({
      merchantId,
      userId: actorUserId,
      action: 'merchant_user.updated',
      entity: 'merchant_user',
      entityId: target.id,
      metadata: { changes: dto },
    });

    return updated;
  }

  async setStatus(
    merchantId: string,
    actorUserId: string,
    actorRole: string,
    targetId: string,
    status: 'ACTIVE' | 'DEACTIVATED',
  ) {
    const target = await this.getOwnedMerchantUserOrThrow(merchantId, targetId);
    this.assertCanManageTarget(actorRole, target.role);

    if (target.userId === actorUserId) {
      throw new BadRequestException('You cannot deactivate your own account');
    }

    if (status === 'DEACTIVATED' && target.role === UserRole.OWNER) {
      await this.assertNotLastOwner(merchantId, target.id);
    }

    const updated = await this.prisma.merchantUser.update({
      where: { id: target.id },
      data: { status },
    });

    await this.auditLogs.create({
      merchantId,
      userId: actorUserId,
      action: status === 'DEACTIVATED' ? 'merchant_user.deactivated' : 'merchant_user.reactivated',
      entity: 'merchant_user',
      entityId: target.id,
    });

    return updated;
  }

  async resetPassword(merchantId: string, actorUserId: string, actorRole: string, targetId: string) {
    const target = await this.getOwnedMerchantUserOrThrow(merchantId, targetId);
    this.assertCanManageTarget(actorRole, target.role);

    const tempPassword = this.generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    const user = await this.prisma.user.update({ where: { id: target.userId }, data: { passwordHash } });

    await this.auditLogs.create({
      merchantId,
      userId: actorUserId,
      action: 'merchant_user.password_reset',
      entity: 'merchant_user',
      entityId: target.id,
    });

    await this.mailer.send({
      to: user.email,
      subject: 'Your PayHarness password has been reset',
      text:
        `Hi ${user.name},\n\n` +
        `Your password was just reset by an administrator on your team.\n\n` +
        `Your new temporary password is: ${tempPassword}\n\n` +
        `Please log in and change it as soon as possible. If you didn't expect this, contact your ` +
        `organization's administrator right away.`,
      html:
        `<p>Hi ${user.name},</p>` +
        `<p>Your password was just reset by an administrator on your team.</p>` +
        `<p>Your new temporary password is: <code>${tempPassword}</code></p>` +
        `<p>Please log in and change it as soon as possible. If you didn't expect this, contact your ` +
        `organization's administrator right away.</p>`,
    });

    // Also returned once in the API response -- never stored or logged anywhere else.
    return { temporaryPassword: tempPassword };
  }

  async remove(merchantId: string, actorUserId: string, actorRole: string, targetId: string) {
    const target = await this.getOwnedMerchantUserOrThrow(merchantId, targetId);
    this.assertCanManageTarget(actorRole, target.role);

    if (target.userId === actorUserId) {
      throw new BadRequestException('You cannot remove your own account');
    }

    if (target.role === UserRole.OWNER) {
      await this.assertNotLastOwner(merchantId, target.id);
    }

    await this.prisma.merchantUser.delete({ where: { id: target.id } });

    await this.auditLogs.create({
      merchantId,
      userId: actorUserId,
      action: 'merchant_user.removed',
      entity: 'merchant_user',
      entityId: target.id,
    });

    return { id: target.id, removed: true };
  }

  private async getOwnedMerchantUserOrThrow(merchantId: string, targetId: string) {
    const target = await this.prisma.merchantUser.findFirst({ where: { id: targetId, merchantId } });
    if (!target) {
      throw new NotFoundException('Team member not found');
    }
    return target;
  }

  private assertCanManageTarget(actorRole: string, targetRole: string) {
    // Owners can manage anyone. Everyone else can only manage people ranked
    // strictly below them (an Admin can manage a Developer/Viewer, but not
    // another Admin or an Owner).
    if (actorRole === UserRole.OWNER) {
      return;
    }
    if (compareRoles(actorRole, targetRole) <= 0) {
      throw new ForbiddenException("You don't have permission to manage this team member");
    }
  }

  private async assertNotLastOwner(merchantId: string, excludingMerchantUserId: string) {
    const otherOwners = await this.prisma.merchantUser.count({
      where: { merchantId, role: UserRole.OWNER, id: { not: excludingMerchantUserId } },
    });
    if (otherOwners === 0) {
      throw new BadRequestException('A merchant must always have at least one owner');
    }
  }

  private generateTempPassword() {
    return crypto.randomBytes(9).toString('base64url');
  }
}
