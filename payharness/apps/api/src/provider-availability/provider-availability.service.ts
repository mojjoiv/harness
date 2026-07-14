import { Injectable, NotFoundException } from '@nestjs/common';
import { Provider } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class ProviderAvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  /** Public: which providers can a merchant in this country actually use? */
  async forCountry(countryCode: string): Promise<Provider[]> {
    const [countryRows, globalConfig] = await Promise.all([
      this.prisma.providerCountryAvailability.findMany({
        where: { countryCode: countryCode.toUpperCase(), enabled: true },
      }),
      this.prisma.platformGatewayConfig.findMany({ where: { enabled: true } }),
    ]);

    const globallyEnabled = new Set(globalConfig.map((c) => c.provider));
    return countryRows.map((row) => row.provider).filter((provider) => globallyEnabled.has(provider));
  }

  /** Admin: full country x provider matrix for the Payment Gateways page. */
  matrix() {
    return this.prisma.providerCountryAvailability.findMany({
      orderBy: [{ provider: 'asc' }, { countryCode: 'asc' }],
    });
  }

  async toggle(provider: Provider, countryCode: string, platformUserId: string) {
    const normalized = countryCode.toUpperCase();
    const existing = await this.prisma.providerCountryAvailability.findUnique({
      where: { provider_countryCode: { provider, countryCode: normalized } },
    });

    const updated = existing
      ? await this.prisma.providerCountryAvailability.update({
          where: { id: existing.id },
          data: { enabled: !existing.enabled },
        })
      : await this.prisma.providerCountryAvailability.create({
          data: { provider, countryCode: normalized, enabled: true },
        });

    await this.auditLogs.create({
      action: updated.enabled ? 'platform.provider_availability.enabled' : 'platform.provider_availability.disabled',
      entity: 'provider_country_availability',
      entityId: updated.id,
      metadata: { platformUserId, provider, countryCode: normalized },
    });

    return updated;
  }

  async isAvailable(provider: Provider, countryCode: string | null | undefined): Promise<boolean> {
    if (!countryCode) {
      // No country on file for this merchant yet -- don't block them, since
      // that would be a regression for accounts created before this feature.
      return true;
    }

    const row = await this.prisma.providerCountryAvailability.findUnique({
      where: { provider_countryCode: { provider, countryCode: countryCode.toUpperCase() } },
    });

    if (!row) {
      return false;
    }
    return row.enabled;
  }
}
