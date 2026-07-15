import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Provider } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CredentialCryptoService } from '../common/crypto/credential-crypto.service';
import { PrismaService } from '../common/prisma.service';
import { PlatformGatewaysService } from '../platform/platform-gateways/platform-gateways.service';
import { ProviderAvailabilityService } from '../provider-availability/provider-availability.service';
import { SaveProviderCredentialDto } from './dto/provider-credential.dto';

type VerifierResult = { ok: boolean; error?: string };

/**
 * One verifier function per provider. Each currently does a basic shape
 * check only (decryptable, required keys present) and does NOT call the
 * real provider API yet -- that comes in the Checkout Engine phase. The
 * point of keeping these as separate, swappable functions per provider
 * (rather than one big verify() with if/else branches) is so that phase can
 * plug in real Stripe/M-Pesa/PayPal API calls here without touching the
 * controller or the rest of this service.
 */
const VERIFIERS: Record<Provider, (secretConfig: Record<string, unknown>) => VerifierResult> = {
  MPESA: (secretConfig) => {
    if (!secretConfig.consumerKey || !secretConfig.consumerSecret || !secretConfig.passkey) {
      return { ok: false, error: 'M-Pesa credentials are missing required fields' };
    }
    return { ok: true };
  },
  STRIPE: (secretConfig) => {
    if (!secretConfig.secretKey) {
      return { ok: false, error: 'Stripe secret key is missing' };
    }
    return { ok: true };
  },
  PAYPAL: (secretConfig) => {
    if (!secretConfig.clientSecret) {
      return { ok: false, error: 'PayPal client secret is missing' };
    }
    return { ok: true };
  },
};

@Injectable()
export class ProviderCredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CredentialCryptoService,
    private readonly auditLogs: AuditLogsService,
    private readonly gateways: PlatformGatewaysService,
    private readonly availability: ProviderAvailabilityService,
    private readonly config: ConfigService,
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
        // Saved credentials need re-verifying -- clear any stale result
        // from a previous connection rather than implying these new
        // credentials were already checked.
        lastVerifiedAt: null,
        lastVerificationError: null,
        failedVerificationCount: 0,
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
    const credential = await this.getOwnedOrThrow(merchantId, id);

    let decrypted: Record<string, unknown>;
    try {
      decrypted = this.crypto.decrypt(credential.encryptedSecretConfig as any);
    } catch {
      return this.recordVerification(credential.id, { ok: false, error: 'Stored credentials could not be read' });
    }

    const result = VERIFIERS[credential.provider](decrypted);
    return this.recordVerification(credential.id, result);
  }

  async disconnect(merchantId: string, userId: string, id: string) {
    const credential = await this.getOwnedOrThrow(merchantId, id);

    const updated = await this.prisma.providerCredential.update({
      where: { id: credential.id },
      data: { status: 'REVOKED', isDefault: false },
    });

    await this.auditLogs.create({
      merchantId,
      userId,
      action: 'provider_credentials.disconnected',
      entity: 'provider_credential',
      entityId: credential.id,
      metadata: { provider: credential.provider, environment: credential.environment },
    });

    return this.maskCredential(updated);
  }

  /**
   * Same effect as disconnect(), but invoked by a SuperAdmin, not the
   * merchant's own Owner. Kept separate because AuditLog.userId is a
   * foreign key into the merchant-side User table -- a PlatformUser id
   * can't go there, so the acting admin's id is recorded in metadata
   * instead (same pattern platform-merchants.service.ts uses).
   */
  async forceDisconnect(merchantId: string, id: string, platformUserId: string) {
    const credential = await this.getOwnedOrThrow(merchantId, id);

    const updated = await this.prisma.providerCredential.update({
      where: { id: credential.id },
      data: { status: 'REVOKED', isDefault: false },
    });

    await this.auditLogs.create({
      merchantId,
      action: 'platform.provider_credentials.force_disconnected',
      entity: 'provider_credential',
      entityId: credential.id,
      metadata: { platformUserId, provider: credential.provider, environment: credential.environment },
    });

    return this.maskCredential(updated);
  }

  async setDefault(merchantId: string, userId: string, id: string) {
    const credential = await this.getOwnedOrThrow(merchantId, id);
    if (credential.status !== 'ACTIVE') {
      throw new ForbiddenException('Only an active, connected provider can be set as default');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.providerCredential.updateMany({
        where: { merchantId, provider: credential.provider, id: { not: credential.id } },
        data: { isDefault: false },
      });
      return tx.providerCredential.update({ where: { id: credential.id }, data: { isDefault: true } });
    });

    await this.auditLogs.create({
      merchantId,
      userId,
      action: 'provider_credentials.set_default',
      entity: 'provider_credential',
      entityId: credential.id,
      metadata: { provider: credential.provider, environment: credential.environment },
    });

    return this.maskCredential(updated);
  }

  private async recordVerification(credentialId: string, result: VerifierResult) {
    const updated = await this.prisma.providerCredential.update({
      where: { id: credentialId },
      data: result.ok
        ? { lastVerifiedAt: new Date(), lastVerificationError: null, failedVerificationCount: 0 }
        : { lastVerificationError: result.error || 'Verification failed', failedVerificationCount: { increment: 1 } },
    });

    return {
      verified: result.ok,
      message: result.ok ? 'Credentials look valid' : result.error || 'Verification failed',
      lastVerifiedAt: updated.lastVerifiedAt,
      failedVerificationCount: updated.failedVerificationCount,
    };
  }

  private async getOwnedOrThrow(merchantId: string, id: string) {
    const credential = await this.prisma.providerCredential.findFirst({ where: { id, merchantId } });
    if (!credential) {
      throw new NotFoundException('Provider credential not found');
    }
    return credential;
  }

  private webhookUrl(provider: Provider, merchantId: string) {
    const appUrl = this.config.get<string>('APP_URL') || 'http://localhost:3000';
    return `${appUrl.replace(/\/$/, '')}/webhooks/provider/${provider.toLowerCase()}/${merchantId}`;
  }

  private maskCredential(credential: {
    id: string;
    merchantId: string;
    provider: Provider;
    environment: string;
    label: string;
    publicConfig: unknown;
    encryptedSecretConfig: unknown;
    status: string;
    isDefault: boolean;
    lastVerifiedAt: Date | null;
    lastVerificationError: string | null;
    failedVerificationCount: number;
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
      isDefault: credential.isDefault,
      lastVerifiedAt: credential.lastVerifiedAt,
      lastVerificationError: credential.lastVerificationError,
      failedVerificationCount: credential.failedVerificationCount,
      webhookUrl: this.webhookUrl(credential.provider, credential.merchantId),
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt,
    };
  }
}
