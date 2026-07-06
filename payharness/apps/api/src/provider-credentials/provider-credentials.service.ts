import { Injectable } from '@nestjs/common';
import { Prisma, Provider } from '@prisma/client';
import { CredentialCryptoService } from '../common/crypto/credential-crypto.service';
import { PrismaService } from '../common/prisma.service';
import { SaveProviderCredentialDto } from './dto/provider-credential.dto';

@Injectable()
export class ProviderCredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CredentialCryptoService,
  ) {}

  async save(merchantId: string, provider: Provider, dto: SaveProviderCredentialDto) {
    const publicConfig = { ...dto.publicConfig };
    const secretConfig = { ...dto.secretConfig };
    const encryptedSecretConfig = this.crypto.encrypt(secretConfig) as unknown as Prisma.InputJsonObject;
    const credential = await this.prisma.providerCredential.upsert({
      where: {
        merchantId_provider_environment: {
          merchantId,
          provider,
          environment: dto.environment,
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
        publicConfig: publicConfig as Prisma.InputJsonValue,
        encryptedSecretConfig,
      },
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
      publicConfig: credential.publicConfig,
      secretConfig: maskedSecretConfig,
      status: credential.status,
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt,
    };
  }
}
