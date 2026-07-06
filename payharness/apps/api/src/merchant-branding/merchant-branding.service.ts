import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../common/prisma.service';
import { UpdateMerchantBrandingDto } from './dto/update-merchant-branding.dto';

export const DEFAULT_BRANDING = {
  primaryColor: '#2563eb',
  secondaryColor: '#0f172a',
  buttonColor: '#2563eb',
};

@Injectable()
export class MerchantBrandingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async get(merchantId: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      include: { branding: true },
    });
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    return {
      merchantName: merchant.name,
      logoUrl: merchant.branding?.logoUrl || null,
      faviconUrl: merchant.branding?.faviconUrl || null,
      primaryColor: merchant.branding?.primaryColor || DEFAULT_BRANDING.primaryColor,
      secondaryColor: merchant.branding?.secondaryColor || DEFAULT_BRANDING.secondaryColor,
      buttonColor: merchant.branding?.buttonColor || DEFAULT_BRANDING.buttonColor,
      successPageMessage: merchant.branding?.successPageMessage || null,
      cancelPageMessage: merchant.branding?.cancelPageMessage || null,
      receiptFooter: merchant.branding?.receiptFooter || null,
      createdAt: merchant.branding?.createdAt || merchant.createdAt,
      updatedAt: merchant.branding?.updatedAt || merchant.updatedAt,
    };
  }

  async update(merchantId: string, userId: string, dto: UpdateMerchantBrandingDto) {
    const branding = await this.prisma.merchantBranding.upsert({
      where: { merchantId },
      update: dto,
      create: { merchantId, ...DEFAULT_BRANDING, ...dto },
    });

    await this.auditLogs.create({
      merchantId,
      userId,
      action: 'merchant_branding.updated',
      entity: 'merchant_branding',
      entityId: branding.id,
    });

    return branding;
  }
}
