import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Provider } from '@prisma/client';
import * as http from 'http';
import * as https from 'https';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CredentialCryptoService } from '../common/crypto/credential-crypto.service';
import { PrismaService } from '../common/prisma.service';
import { MpesaVerificationService } from '../payment-providers/mpesa/mpesa-verification.service';
import { PlatformGatewaysService } from '../platform/platform-gateways/platform-gateways.service';
import { ProviderAvailabilityService } from '../provider-availability/provider-availability.service';
import { SaveProviderCredentialDto } from './dto/provider-credential.dto';

type VerifierResult = {
  ok: boolean;
  error?: string;
  responseTimeMs?: number;
  httpStatus?: number;
  oauthSucceeded?: boolean;
};

interface VerifierContext {
  publicConfig: Record<string, unknown>;
  secretConfig: Record<string, unknown>;
  environment: 'SANDBOX' | 'LIVE';
  callbackUrl: string;
}

@Injectable()
export class ProviderCredentialsService {
  /**
   * One verifier function per provider. M-Pesa calls the real Safaricom
   * Daraja API (see MpesaVerificationService) -- an actual OAuth exchange,
   * not a shape check. Stripe and PayPal are still shape-checks only for
   * now (their real API integration hasn't been built yet); swapping them
   * in later is just replacing their function body here, same as M-Pesa
   * was until this phase.
   */
  private readonly verifiers: Record<Provider, (ctx: VerifierContext) => Promise<VerifierResult>>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CredentialCryptoService,
    private readonly auditLogs: AuditLogsService,
    private readonly gateways: PlatformGatewaysService,
    private readonly availability: ProviderAvailabilityService,
    private readonly config: ConfigService,
    private readonly mpesaVerification: MpesaVerificationService,
  ) {
    this.verifiers = {
      MPESA: async (ctx) => {
        const { publicConfig, secretConfig } = ctx;
        if (!secretConfig.consumerKey || !secretConfig.consumerSecret || !secretConfig.passkey) {
          return { ok: false, error: 'M-Pesa credentials are missing required fields' };
        }
        if (!publicConfig.shortcode || !publicConfig.businessType) {
          return { ok: false, error: 'Shortcode and business type are required' };
        }

        const result = await this.mpesaVerification.verifyConnection({
          consumerKey: secretConfig.consumerKey as string,
          consumerSecret: secretConfig.consumerSecret as string,
          passkey: secretConfig.passkey as string,
          shortcode: publicConfig.shortcode as string,
          businessType: publicConfig.businessType as 'PAYBILL' | 'TILL',
          environment: ctx.environment,
          callbackUrl: ctx.callbackUrl,
        });

        return {
          ok: result.ok,
          error: result.error,
          responseTimeMs: result.responseTimeMs,
          httpStatus: result.httpStatus,
          oauthSucceeded: result.oauthSucceeded,
        };
      },
      STRIPE: async ({ secretConfig }) => {
        if (!secretConfig.secretKey) {
          return { ok: false, error: 'Stripe secret key is missing' };
        }
        return { ok: true };
      },
      PAYPAL: async ({ secretConfig }) => {
        if (!secretConfig.clientSecret) {
          return { ok: false, error: 'PayPal client secret is missing' };
        }
        return { ok: true };
      },
    };
  }

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

    // Automatic verification -- the merchant shouldn't have to remember to
    // click Verify every time they change a key/secret/passkey/shortcode.
    await this.runVerification(credential);
    const refreshed = await this.getOwnedOrThrow(merchantId, credential.id);
    return this.maskCredential(refreshed);
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
    return this.runVerification(credential);
  }

  async health(merchantId: string, id: string) {
    const credential = await this.getOwnedOrThrow(merchantId, id);
    const webhookReachable = await this.checkWebhookReachable(credential.provider, credential.merchantId);
    return {
      verified: Boolean(credential.lastVerifiedAt) && credential.status === 'ACTIVE',
      environment: credential.environment,
      lastVerifiedAt: credential.lastVerifiedAt,
      status: this.healthStatus(credential),
      oauth: credential.provider === 'MPESA' ? Boolean(credential.lastVerifiedAt) : null,
      webhook: webhookReachable,
      lastError: credential.lastVerificationError,
      failedVerificationCount: credential.failedVerificationCount,
    };
  }

  /**
   * Confirms our own callback URL actually resolves and responds -- catches
   * real misconfiguration (e.g. a wrong APP_URL) rather than assuming it's
   * fine. Not the same thing as "Safaricom has actually delivered a real
   * callback here" (that needs tracking real inbound deliveries against
   * this credential, which webhooks.service.ts's receiveForMerchant()
   * stub doesn't do yet -- flagging as a natural next step, not silently
   * pretending it's covered).
   */
  private async checkWebhookReachable(provider: Provider, merchantId: string): Promise<boolean> {
    const url = this.webhookUrl(provider, merchantId);
    try {
      const parsed = new URL(url);
      const client = parsed.protocol === 'http:' ? http : https;
      return await new Promise<boolean>((resolve) => {
        const request = client.request(
          { hostname: parsed.hostname, port: parsed.port, path: parsed.pathname, method: 'HEAD', timeout: 5000 },
          (res) => {
            res.resume();
            // Any response at all -- even a 404/405 for a HEAD the route
            // doesn't explicitly support -- means something is listening.
            // Only a connection failure/timeout means unreachable.
            resolve(Boolean(res.statusCode));
          },
        );
        request.on('error', () => resolve(false));
        request.on('timeout', () => {
          request.destroy();
          resolve(false);
        });
        request.end();
      });
    } catch {
      return false;
    }
  }

  /**
   * ACTIVE + never verified = pending. ACTIVE + verified = verified.
   * ACTIVE + has a verification error = invalid. REVOKED = disabled.
   * Matches the four-state health model (verified/pending/invalid/disabled)
   * merchants see as colored badges in the dashboard.
   */
  private healthStatus(credential: {
    status: string;
    lastVerifiedAt: Date | null;
    lastVerificationError: string | null;
  }): 'VERIFIED' | 'PENDING' | 'INVALID' | 'DISABLED' {
    if (credential.status === 'REVOKED') return 'DISABLED';
    if (credential.lastVerificationError) return 'INVALID';
    if (credential.lastVerifiedAt) return 'VERIFIED';
    return 'PENDING';
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

  private async runVerification(credential: {
    id: string;
    merchantId: string;
    provider: Provider;
    environment: 'SANDBOX' | 'LIVE';
    publicConfig: unknown;
    encryptedSecretConfig: unknown;
  }) {
    let decrypted: Record<string, unknown>;
    try {
      decrypted = this.crypto.decrypt(credential.encryptedSecretConfig as any);
    } catch {
      return this.recordVerification(credential, { ok: false, error: 'Stored credentials could not be read' });
    }

    const result = await this.verifiers[credential.provider]({
      publicConfig: (credential.publicConfig as Record<string, unknown>) || {},
      secretConfig: decrypted,
      environment: credential.environment,
      callbackUrl: this.webhookUrl(credential.provider, credential.merchantId),
    });

    return this.recordVerification(credential, result);
  }

  private async recordVerification(
    credential: { id: string; merchantId: string; provider: Provider; environment: 'SANDBOX' | 'LIVE' },
    result: VerifierResult,
  ) {
    const updated = await this.prisma.providerCredential.update({
      where: { id: credential.id },
      data: result.ok
        ? { lastVerifiedAt: new Date(), lastVerificationError: null, failedVerificationCount: 0 }
        : { lastVerificationError: result.error || 'Verification failed', failedVerificationCount: { increment: 1 } },
    });

    await this.prisma.providerVerificationLog.create({
      data: {
        merchantId: credential.merchantId,
        credentialId: credential.id,
        provider: credential.provider,
        environment: credential.environment,
        success: result.ok,
        responseTimeMs: result.responseTimeMs,
        httpStatus: result.httpStatus,
        oauthSucceeded: result.oauthSucceeded,
        failureReason: result.ok ? null : result.error || 'Verification failed',
      },
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
      healthStatus: this.healthStatus(credential),
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
