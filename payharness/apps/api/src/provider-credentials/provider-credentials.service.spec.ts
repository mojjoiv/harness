import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Environment, Provider } from '@prisma/client';
import { ProviderCredentialsService } from './provider-credentials.service';

const makeCredential = (overrides: Record<string, unknown> = {}) => ({
  id: 'credential-1',
  merchantId: 'merchant-1',
  provider: Provider.STRIPE,
  environment: Environment.SANDBOX,
  label: 'default',
  publicConfig: { publishableKey: 'pk_test' },
  encryptedSecretConfig: { ciphertext: 'encrypted' },
  status: 'ACTIVE',
  isDefault: false,
  verificationStatus: 'PENDING',
  oauthVerified: false,
  accountVerified: false,
  webhookVerified: false,
  environmentVerified: false,
  verificationLatencyMs: null,
  verificationWarnings: [],
  verificationErrors: [],
  lastVerifiedAt: null,
  lastVerificationError: null,
  failedVerificationCount: 0,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

describe('ProviderCredentialsService', () => {
  const prisma = {
    merchant: { findUnique: jest.fn() },
    providerCredential: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    providerVerificationLog: { create: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const crypto = {
    encrypt: jest.fn(),
    decrypt: jest.fn(),
    mask: jest.fn(),
  };
  const auditLogs = { create: jest.fn() };
  const gateways = { isEnabled: jest.fn() };
  const availability = { isAvailable: jest.fn() };
  const config = { get: jest.fn() };
  const mpesaVerification = { verify: jest.fn() };

  const service = new ProviderCredentialsService(
    prisma as never,
    crypto as never,
    auditLogs as never,
    gateways as never,
    availability as never,
    config as never,
    mpesaVerification as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    gateways.isEnabled.mockResolvedValue(true);
    availability.isAvailable.mockResolvedValue(true);
    config.get.mockReturnValue('https://example.com/');
    crypto.encrypt.mockReturnValue({ ciphertext: 'encrypted' });
    crypto.decrypt.mockReturnValue({ secretKey: 'sk_test', clientSecret: 'client-secret' });
    crypto.mask.mockImplementation((value: unknown) => `***${String(value).slice(-4)}`);
    auditLogs.create.mockResolvedValue(undefined);
    prisma.providerCredential.findMany.mockResolvedValue([]);
    prisma.providerCredential.findFirst.mockResolvedValue(makeCredential());
    prisma.providerCredential.findUniqueOrThrow.mockResolvedValue(makeCredential());
    prisma.providerCredential.update.mockResolvedValue(makeCredential());
    prisma.providerVerificationLog.create.mockResolvedValue({ id: 'log-1' });
    prisma.providerVerificationLog.findMany.mockResolvedValue([]);
  });

  describe('save', () => {
    const dto = {
      environment: Environment.SANDBOX,
      label: 'checkout',
      publicConfig: { publishableKey: 'pk_test' },
      secretConfig: { secretKey: 'sk_test' },
    };

    it('rejects a provider disabled platform-wide', async () => {
      gateways.isEnabled.mockResolvedValue(false);

      await expect(
        service.save('merchant-1', 'user-1', Provider.STRIPE, dto as never),
      ).rejects.toThrow(new ForbiddenException('This payment provider is currently disabled platform-wide'));
      expect(prisma.providerCredential.upsert).not.toHaveBeenCalled();
    });

    it('rejects a provider unavailable in the merchant country', async () => {
      prisma.merchant.findUnique.mockResolvedValue({ profile: { country: 'KE' } });
      availability.isAvailable.mockResolvedValue(false);

      await expect(
        service.save('merchant-1', 'user-1', Provider.STRIPE, dto as never),
      ).rejects.toThrow(new ForbiddenException('STRIPE is not available in your country'));
    });

    it('encrypts the secret, upserts the credential, verifies it, and masks the response', async () => {
      const credential = makeCredential({ label: dto.label });
      prisma.merchant.findUnique.mockResolvedValue({ profile: { country: 'KE' } });
      prisma.providerCredential.upsert.mockResolvedValue(credential);
      prisma.providerCredential.findFirst.mockResolvedValue(credential);
      prisma.providerCredential.update.mockResolvedValue(
        makeCredential({ verificationStatus: 'VERIFIED', oauthVerified: true, accountVerified: true, environmentVerified: true }),
      );
      jest.spyOn(service as never, 'checkWebhookReachable').mockResolvedValue(true);

      await expect(service.save('merchant-1', 'user-1', Provider.STRIPE, dto as never)).resolves.toEqual(
        expect.objectContaining({ provider: Provider.STRIPE, secretConfig: expect.any(Object) }),
      );
      expect(crypto.encrypt).toHaveBeenCalledWith(dto.secretConfig);
      expect(prisma.providerCredential.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            merchantId_provider_environment_label: expect.objectContaining({
              merchantId: 'merchant-1',
              provider: Provider.STRIPE,
              label: 'checkout',
            }),
          }),
        }),
      );
      expect(auditLogs.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'provider_credentials.updated' }),
      );
    });

    it('uses the default label when none is supplied', async () => {
      const credential = makeCredential();
      prisma.providerCredential.upsert.mockResolvedValue(credential);
      prisma.providerCredential.findFirst.mockResolvedValue(credential);
      jest.spyOn(service as never, 'checkWebhookReachable').mockResolvedValue(true);

      await service.save(
        'merchant-1',
        'user-1',
        Provider.STRIPE,
        { ...dto, label: undefined } as never,
      );

      expect(prisma.providerCredential.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            merchantId_provider_environment_label: expect.objectContaining({ label: 'default' }),
          }),
        }),
      );
    });
  });

  describe('list', () => {
    it('returns credentials with masked secrets', async () => {
      const credential = makeCredential();
      prisma.providerCredential.findMany.mockResolvedValue([credential]);

      await expect(service.list('merchant-1')).resolves.toEqual([
        expect.objectContaining({
          id: credential.id,
          secretConfig: { secretKey: '***test', clientSecret: '***cret' },
        }),
      ]);
      expect(prisma.providerCredential.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { merchantId: 'merchant-1' } }),
      );
    });

    it('uses a safe fallback when stored secrets cannot be decrypted', async () => {
      crypto.decrypt.mockImplementation(() => {
        throw new Error('bad ciphertext');
      });
      prisma.providerCredential.findMany.mockResolvedValue([makeCredential()]);

      await expect(service.list('merchant-1')).resolves.toEqual([
        expect.objectContaining({ secretConfig: { secretConfig: '********' } }),
      ]);
    });
  });

  describe('verify and health', () => {
    it('returns a not-found error for an unknown credential', async () => {
      prisma.providerCredential.findFirst.mockResolvedValue(null);

      await expect(service.verify('merchant-1', 'missing')).rejects.toThrow(
        new NotFoundException('Provider credential not found'),
      );
    });

    it('verifies Stripe credentials and records a failed verification when the secret is missing', async () => {
      const credential = makeCredential({ encryptedSecretConfig: { ciphertext: 'x' } });
      prisma.providerCredential.findFirst.mockResolvedValue(credential);
      crypto.decrypt.mockReturnValue({});
      jest.spyOn(service as never, 'checkWebhookReachable').mockResolvedValue(true);
      prisma.providerCredential.update.mockResolvedValue(
        makeCredential({ verificationStatus: 'FAILED', lastVerificationError: 'Stripe secret key is missing', failedVerificationCount: 1 }),
      );

      await expect(service.verify('merchant-1', credential.id)).resolves.toEqual(
        expect.objectContaining({ verified: false, message: 'Stripe secret key is missing' }),
      );
      expect(prisma.providerVerificationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ success: false }) }),
      );
    });

    it('records a verified Stripe credential when the secret exists and webhook is reachable', async () => {
      const credential = makeCredential();
      prisma.providerCredential.findFirst.mockResolvedValue(credential);
      crypto.decrypt.mockReturnValue({ secretKey: 'sk_test' });
      jest.spyOn(service as never, 'checkWebhookReachable').mockResolvedValue(true);
      prisma.providerCredential.update.mockResolvedValue(
        makeCredential({ verificationStatus: 'VERIFIED', oauthVerified: true, accountVerified: true, webhookVerified: true, environmentVerified: true, lastVerifiedAt: new Date() }),
      );

      await expect(service.verify('merchant-1', credential.id)).resolves.toEqual(
        expect.objectContaining({ verified: true, message: 'Credentials look valid' }),
      );
      expect(prisma.providerVerificationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ success: true, oauthSucceeded: true }) }),
      );
    });

    it('returns disabled health for a revoked credential', async () => {
      prisma.providerCredential.findFirst.mockResolvedValue(
        makeCredential({ status: 'REVOKED', verificationStatus: 'VERIFIED' }),
      );

      await expect(service.health('merchant-1', 'credential-1')).resolves.toEqual(
        expect.objectContaining({ status: 'DISABLED', verificationStatus: 'VERIFIED' }),
      );
    });

    it('returns invalid health and the recommended credential action after failure', async () => {
      prisma.providerCredential.findFirst.mockResolvedValue(
        makeCredential({ verificationStatus: 'FAILED', lastVerificationError: 'bad key' }),
      );

      await expect(service.health('merchant-1', 'credential-1')).resolves.toEqual(
        expect.objectContaining({
          status: 'INVALID',
          nextRecommendedAction: 'Fix credentials: bad key',
        }),
      );
    });
  });

  describe('disconnect and forceDisconnect', () => {
    it('disconnects a merchant credential and audits the action', async () => {
      const updated = makeCredential({ status: 'REVOKED', isDefault: false });
      prisma.providerCredential.findFirst.mockResolvedValue(makeCredential());
      prisma.providerCredential.update.mockResolvedValue(updated);

      await expect(service.disconnect('merchant-1', 'user-1', 'credential-1')).resolves.toEqual(
        expect.objectContaining({ status: 'REVOKED', secretConfig: expect.any(Object) }),
      );
      expect(auditLogs.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'provider_credentials.disconnected', userId: 'user-1' }),
      );
    });

    it('force disconnects a credential and records the platform user in metadata', async () => {
      const updated = makeCredential({ status: 'REVOKED', isDefault: false });
      prisma.providerCredential.update.mockResolvedValue(updated);

      await service.forceDisconnect('merchant-1', 'credential-1', 'platform-user-1');

      expect(auditLogs.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'platform.provider_credentials.force_disconnected',
          metadata: expect.objectContaining({ platformUserId: 'platform-user-1' }),
        }),
      );
    });
  });

  describe('setDefault', () => {
    it('rejects revoked credentials', async () => {
      prisma.providerCredential.findFirst.mockResolvedValue(makeCredential({ status: 'REVOKED' }));

      await expect(service.setDefault('merchant-1', 'user-1', 'credential-1')).rejects.toThrow(
        new ForbiddenException('Only an active, connected provider can be set as default'),
      );
    });

    it('clears other defaults, sets the credential, and audits the change', async () => {
      const credential = makeCredential({ provider: Provider.STRIPE, status: 'ACTIVE' });
      const tx = {
        providerCredential: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          update: jest.fn().mockResolvedValue({ ...credential, isDefault: true }),
        },
      };
      prisma.providerCredential.findFirst.mockResolvedValue(credential);
      prisma.$transaction.mockImplementation((callback: (value: typeof tx) => unknown) => callback(tx));

      await expect(service.setDefault('merchant-1', 'user-1', 'credential-1')).resolves.toEqual(
        expect.objectContaining({ isDefault: true }),
      );
      expect(tx.providerCredential.updateMany).toHaveBeenCalledWith({
        where: { merchantId: 'merchant-1', provider: Provider.STRIPE, id: { not: 'credential-1' } },
        data: { isDefault: false },
      });
      expect(auditLogs.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'provider_credentials.set_default' }),
      );
    });
  });

  describe('verification history and helpers', () => {
    it('limits verification history to 100 entries', async () => {
      await service.verificationHistory('merchant-1', 'credential-1', 250);

      expect(prisma.providerVerificationLog.findMany).toHaveBeenCalledWith({
        where: { credentialId: 'credential-1', merchantId: 'merchant-1' },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
    });

    it('builds the provider webhook URL from APP_URL', () => {
      const url = (service as unknown as { webhookUrl: (provider: Provider, merchantId: string) => string }).webhookUrl(
        Provider.PAYPAL,
        'merchant-1',
      );
      expect(url).toBe('https://example.com/webhooks/provider/paypal/merchant-1');
    });

    it('uses localhost when APP_URL is absent', () => {
      config.get.mockReturnValue(undefined);
      const url = (service as unknown as { webhookUrl: (provider: Provider, merchantId: string) => string }).webhookUrl(
        Provider.MPESA,
        'merchant-1',
      );
      expect(url).toBe('http://localhost:3000/webhooks/provider/mpesa/merchant-1');
    });

    it.each([
      ['REVOKED', 'VERIFIED', 'DISABLED'],
      ['ACTIVE', 'FAILED', 'INVALID'],
      ['ACTIVE', 'PENDING', 'PENDING'],
      ['ACTIVE', 'PARTIALLY_VERIFIED', 'PARTIALLY_VERIFIED'],
      ['ACTIVE', 'VERIFIED', 'VERIFIED'],
    ])('maps %s/%s to health status %s', (status, verificationStatus, expected) => {
      const healthStatus = (service as unknown as { healthStatus: (credential: { status: string; verificationStatus: string }) => string }).healthStatus({
        status,
        verificationStatus,
      });
      expect(healthStatus).toBe(expected);
    });

    it('recommends reconnecting revoked credentials', () => {
      const next = (service as unknown as { nextRecommendedAction: (credential: { status: string; verificationStatus: string; oauthVerified: boolean; webhookVerified: boolean; lastVerificationError: string | null }) => string }).nextRecommendedAction({
        status: 'REVOKED',
        verificationStatus: 'FAILED',
        oauthVerified: false,
        webhookVerified: false,
        lastVerificationError: null,
      });
      expect(next).toBe('Reconnect this provider to use it again');
    });

    it('recommends verification when OAuth has not run', () => {
      const next = (service as unknown as { nextRecommendedAction: (credential: { status: string; verificationStatus: string; oauthVerified: boolean; webhookVerified: boolean; lastVerificationError: string | null }) => string }).nextRecommendedAction({
        status: 'ACTIVE',
        verificationStatus: 'PENDING',
        oauthVerified: false,
        webhookVerified: false,
        lastVerificationError: null,
      });
      expect(next).toBe('Run verification to check these credentials');
    });

    it('recommends checking the webhook when OAuth succeeds but webhook does not', () => {
      const next = (service as unknown as { nextRecommendedAction: (credential: { status: string; verificationStatus: string; oauthVerified: boolean; webhookVerified: boolean; lastVerificationError: string | null }) => string }).nextRecommendedAction({
        status: 'ACTIVE',
        verificationStatus: 'PARTIALLY_VERIFIED',
        oauthVerified: true,
        webhookVerified: false,
        lastVerificationError: null,
      });
      expect(next).toContain('publicly reachable');
    });

    it('recommends no action for a fully verified credential', () => {
      const next = (service as unknown as { nextRecommendedAction: (credential: { status: string; verificationStatus: string; oauthVerified: boolean; webhookVerified: boolean; lastVerificationError: string | null }) => string }).nextRecommendedAction({
        status: 'ACTIVE',
        verificationStatus: 'VERIFIED',
        oauthVerified: true,
        webhookVerified: true,
        lastVerificationError: null,
      });
      expect(next).toBe('No action needed');
    });
  });

  describe('M-Pesa verification', () => {
    it('delegates M-Pesa verification to the adapter and returns persisted status', async () => {
      const credential = makeCredential({ provider: Provider.MPESA, environment: Environment.SANDBOX });
      prisma.providerCredential.findFirst.mockResolvedValue(credential);
      crypto.decrypt.mockReturnValue({ consumerKey: 'key', consumerSecret: 'secret', passkey: 'pass' });
      mpesaVerification.verify.mockResolvedValue({
        provider: 'MPESA',
        overallStatus: 'VERIFIED',
        oauthVerified: true,
        accountVerified: true,
        webhookVerified: true,
        environmentVerified: true,
        latencyMs: 42,
        verifiedAt: new Date(),
        errors: [],
        warnings: [],
      });
      prisma.providerCredential.findUniqueOrThrow.mockResolvedValue(
        makeCredential({ provider: Provider.MPESA, verificationStatus: 'VERIFIED', lastVerifiedAt: new Date() }),
      );

      await expect(service.verify('merchant-1', 'credential-1')).resolves.toEqual(
        expect.objectContaining({ verified: true, healthStatus: 'VERIFIED' }),
      );
      expect(mpesaVerification.verify).toHaveBeenCalledWith(
        expect.objectContaining({
          credentialId: 'credential-1',
          merchantId: 'merchant-1',
          consumerKey: 'key',
          consumerSecret: 'secret',
          passkey: 'pass',
        }),
      );
    });
  });
});
