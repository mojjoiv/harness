import { Injectable } from '@nestjs/common';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../common/prisma.service';
import { UpdateMerchantSettingsDto } from './dto/update-merchant-settings.dto';

export const DEFAULT_SETTINGS = {
  defaultCurrency: 'KES',
  defaultEnvironment: 'SANDBOX' as const,
  receiptEmailsEnabled: true,
  webhookRetriesEnabled: true,
  retryCount: 3,
  paymentTimeoutMinutes: 30,
  requireCustomerEmail: false,
  requireCustomerPhone: false,
};

@Injectable()
export class MerchantSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async get(merchantId: string) {
    const settings = await this.prisma.merchantSettings.findUnique({ where: { merchantId } });
    return settings || { merchantId, ...DEFAULT_SETTINGS };
  }

  async update(merchantId: string, userId: string, dto: UpdateMerchantSettingsDto) {
    const settings = await this.prisma.merchantSettings.upsert({
      where: { merchantId },
      update: dto,
      create: { merchantId, ...DEFAULT_SETTINGS, ...dto },
    });

    await this.auditLogs.create({
      merchantId,
      userId,
      action: 'merchant_settings.updated',
      entity: 'merchant_settings',
      entityId: settings.id,
    });

    return settings;
  }
}
