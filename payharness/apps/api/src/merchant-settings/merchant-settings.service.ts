import { Injectable } from '@nestjs/common';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../common/prisma.service';
import { currencyForCountry } from '../common/utils/country-currency.util';
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
    const [settings, profile] = await Promise.all([
      this.prisma.merchantSettings.findUnique({ where: { merchantId } }),
      this.prisma.merchantProfile.findUnique({ where: { merchantId }, select: { country: true } }),
    ]);

    const country = profile?.country || 'KE';
    const defaultCurrency = currencyForCountry(country);
    return { ...(settings || { merchantId, ...DEFAULT_SETTINGS }), defaultCurrency };
  }

  async update(merchantId: string, userId: string, dto: UpdateMerchantSettingsDto) {
    const profile = await this.prisma.merchantProfile.findUnique({
      where: { merchantId },
      select: { country: true },
    });
    const defaultCurrency = currencyForCountry(profile?.country || 'KE');
    const { defaultCurrency: _ignoredCurrency, ...settingsData } = dto;

    const settings = await this.prisma.merchantSettings.upsert({
      where: { merchantId },
      update: { ...settingsData, defaultCurrency },
      create: { merchantId, ...DEFAULT_SETTINGS, ...settingsData, defaultCurrency },
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
