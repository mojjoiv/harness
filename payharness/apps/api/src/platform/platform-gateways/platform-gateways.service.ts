import { Injectable, NotFoundException } from '@nestjs/common';
import { Provider } from '@prisma/client';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class PlatformGatewaysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  list() {
    return this.prisma.platformGatewayConfig.findMany({ orderBy: { provider: 'asc' } });
  }

  async toggle(provider: Provider, platformUserId: string) {
    const config = await this.prisma.platformGatewayConfig.findUnique({ where: { provider } });
    if (!config) {
      throw new NotFoundException('Gateway not found');
    }

    const updated = await this.prisma.platformGatewayConfig.update({
      where: { provider },
      data: { enabled: !config.enabled },
    });

    await this.auditLogs.create({
      action: updated.enabled ? 'platform.gateway.enabled' : 'platform.gateway.disabled',
      entity: 'platform_gateway_config',
      entityId: updated.id,
      metadata: { platformUserId, provider },
    });

    return updated;
  }

  async isEnabled(provider: Provider): Promise<boolean> {
    const config = await this.prisma.platformGatewayConfig.findUnique({ where: { provider } });
    // If no config row exists yet, default to enabled rather than blocking merchants unexpectedly.
    return config ? config.enabled : true;
  }
}
