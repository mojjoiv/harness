import { Injectable } from '@nestjs/common';
import { Environment, Provider, Status } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class ProviderStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async list(merchantId: string) {
    const credentials = await this.prisma.providerCredential.findMany({
      where: { merchantId, status: Status.ACTIVE },
      select: { provider: true, environment: true, updatedAt: true },
    });

    return Object.values(Provider).map((provider) => {
      const providerCredentials = credentials.filter((credential) => credential.provider === provider);
      const sandboxConnected = providerCredentials.some((credential) => credential.environment === Environment.SANDBOX);
      const liveConnected = providerCredentials.some((credential) => credential.environment === Environment.LIVE);
      const lastUpdatedAt = providerCredentials
        .map((credential) => credential.updatedAt)
        .sort((a, b) => b.getTime() - a.getTime())[0];

      return {
        provider,
        connected: sandboxConnected || liveConnected,
        sandboxConnected,
        liveConnected,
        verified: sandboxConnected || liveConnected,
        lastUpdatedAt: lastUpdatedAt || null,
      };
    });
  }
}
