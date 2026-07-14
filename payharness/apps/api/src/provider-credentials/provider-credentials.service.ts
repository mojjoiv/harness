import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, Provider } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CredentialCryptoService } from '../common/crypto/credential-crypto.service';
import { PrismaService } from '../common/prisma.service';
import { PlatformGatewaysService } from '../platform/platform-gateways/platform-gateways.service';
import { ProviderAvailabilityService } from '../provider-availability/provider-availability.service';
import { SaveProviderCredentialDto } from './dto/provider-credential.dto';

@Injectable()
export class ProviderCredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CredentialCryptoService,
    private readonly auditLogs: AuditLogsService,
    private readonly gateways: PlatformGatewaysService,
    private readonly availability: ProviderAvailabilityService,
  ) {}

  async save(merchantId: string, userId: string, provider: Provider, dto: SaveProviderCredentialDto) {
    const enabled = await this.gateways.isEnabled(provider);
    if (!enabled) {
      throw new ForbiddenException('This payment provider is currently disabled platform-wide');
    }

    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { profile: { select: { country: true } } },
    });
    const isAvailableInCountry = await this.availability.isAvailable(provider, merchant?.profile?.country);
    if (!isAvailableInCountry) {
      throw new ForbiddenException(`${provider} is not available in your country`);
    }

    const label = dto.label || 'default';
    const publicConfig = { ...dto.publicConfig };
    const secretConfig = { ...dto.secretConfig };
    const encryptedSecretConfig = this.crypto.encrypt(secretConfig) as unknown as Prisma.InputJsonObject;
    const credential = await this.prisma.providerCredential.upsert({
      where: {
        merchantId_provider_environment_label: {
          merchantId,
          provider,
          environment: dto.environment,
          label,
        },
      },
      update: {
        publicConfig: publicConfig as Prisma.InputJsonValue,
        encryptedSecretConfig,
        status: 'ACTIVE',

      },
      create: {
        merchantId,
        provider,
        environment: dto.environment,
        label,
        publicConfig: publicConfig as Prisma.InputJsonValue,
        encryptedSecretConfig,
      },
    });
    await this.auditLogs.create({
      merchantId,
      userId,
      action: 'provider_credentials.updated',
      entity: 'provider_credential',
      entityId: credential.id,
      metadata: { provider, environment: dto.environment, label },
    });
    return this.maskCredential(credential);
  }

  async list(merchantId: string) {
    const credentials = await this.prisma.providerCredential.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
    });
    return credentials.map((credential) => this.maskCredential(credential));
  }

  async verify(merchantId: string, id: string) {
    const credential = await this.prisma.providerCredential.findFirst({
      where: { id, merchantId, status: 'ACTIVE' },
    });
    if (!credential) {
      return { verified: false, message: 'Active provider credentials were not found' };
    }

    // TODO: Replace with live provider credential checks when integrations are added.
    return {
      verified: true,
      provider: credential.provider,
      environment: credential.environment,
      message: 'Mock credential verification succeeded',
    };
  }

  private maskCredential(credential: {
    id: string;
    provider: Provider;
    environment: string;
    label: string;
    publicConfig: unknown;
    encryptedSecretConfig: unknown;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    let maskedSecretConfig: Record<string, string> = {};
    try {
      const decrypted = this.crypto.decrypt(credential.encryptedSecretConfig as any);
      maskedSecretConfig = Object.fromEntries(
        Object.entries(decrypted).map(([key, value]) => [key, this.crypto.mask(value)]),
      );
    } catch {
      maskedSecretConfig = { secretConfig: '********' };
    }

    return {
      id: credential.id,
      provider: credential.provider,
      environment: credential.environment,
      label: credential.label,
      publicConfig: credential.publicConfig,
      secretConfig: maskedSecretConfig,
      status: credential.status,
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt,
    };
  }
}
