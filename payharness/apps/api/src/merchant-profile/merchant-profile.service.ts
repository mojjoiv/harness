import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../common/prisma.service';
import { UpdateMerchantProfileDto } from './dto/update-merchant-profile.dto';

@Injectable()
export class MerchantProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async get(merchantId: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      include: { profile: true },
    });
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    return {
      businessName: merchant.profile?.businessName || merchant.name,
      legalName: merchant.profile?.legalName || merchant.name,
      registrationNumber: merchant.profile?.registrationNumber || null,
      taxPin: merchant.profile?.taxPin || null,
      country: merchant.profile?.country || 'KE',
      currency: merchant.profile?.currency || 'KES',
      timezone: merchant.profile?.timezone || 'Africa/Nairobi',
      supportEmail: merchant.profile?.supportEmail || null,
      supportPhone: merchant.profile?.supportPhone || null,
      website: merchant.profile?.website || null,
      logoUrl: merchant.profile?.logoUrl || null,
      primaryBrandColor: merchant.profile?.primaryBrandColor || '#2563eb',
      secondaryBrandColor: merchant.profile?.secondaryBrandColor || '#0f172a',
      createdAt: merchant.profile?.createdAt || merchant.createdAt,
      updatedAt: merchant.profile?.updatedAt || merchant.updatedAt,
    };
  }

  async update(merchantId: string, userId: string, dto: UpdateMerchantProfileDto) {
    const profile = await this.prisma.merchantProfile.upsert({
      where: { merchantId },
      update: dto,
      create: { merchantId, ...dto },
    });

    await this.auditLogs.create({
      merchantId,
      userId,
      action: 'merchant_profile.updated',
      entity: 'merchant_profile',
      entityId: profile.id,
    });

    return profile;
  }
}
