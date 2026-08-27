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

  it('rejects a provider disabled platform-wide', async () => {
    gateways.isEnabled.mockResolvedValue(false);

    await expect(
      service.save('merchant-1', 'user-1', Provider.STRIPE, {
        environment: Environment.SANDBOX,
        publicConfig: { publishableKey: 'pk_test' },
        secretConfig: { secretKey: 'sk_test' },
      } as never),
    ).rejects.toThrow(
      new ForbiddenException('This payment provider is currently disabled platform-wide'),
    );
    expect(prisma.providerCredential.upsert).not.toHaveBeenCalled();
  });

  it('rejects a provider unavailable in the merchant country', async () => {
    prisma.merchant.findUnique.mockResolvedValue({ profile: { country: 'KE' } });
    availability.isAvailable.mockResolvedValue(false);

    await expect(
      service.save('merchant-1', 'user-1', Provider.STRIPE, {
        environment: Environment.SANDBOX,
        publicConfig: { publishableKey: 'pk_test' },
        secretConfig: { secretKey: 'sk_test' },
      } as never),
    ).rejects.toThrow(new ForbiddenException('STRIPE is not available in your country'));
  });

  it('saves, encrypts, verifies, and masks a Stripe credential', async () => {
    const credential = makeCredential();
    const verified = makeCredential({
      verificationStatus: 'VERIFIED',
      oauthVerified: true,
      accountVerified: true,
      webhookVerified: true,
      environmentVerified: true,
      lastVerifiedAt: new Date(),
    });
    prisma.providerCredential.upsert.mockResolvedValue(credential);
    prisma.providerCredential.findFirst.mockResolvedValue(credential);
    prisma.providerCredential.update.mockResolvedValue(verified);
    prisma.providerCredential.findUniqueOrThrow.mockResolvedValue(verified);
    jest.spyOn(service as any, 'checkWebhookReachable').mockResolvedValue(true);

    const result = await service.save('merchant-1', 'user-1', Provider.STRIPE, {
      environment: Environment.SANDBOX,
      label: 'checkout',
      publicConfig: { publishableKey: 'pk_test' },
      secretConfig: { secretKey: 'sk_test' },
    } as never);

    expect(result).toEqual(
      expect.objectContaining({
        provider: Provider.STRIPE,
        secretConfig: { secretKey: '***test' },
      }),
    );
    expect(crypto.encrypt).toHaveBeenCalledWith({ secretKey: 'sk_test' });
    expect(prisma.providerCredential.upsert).toHaveBeenCalled();
    expect(auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'provider_credentials.updated' }),
    );
  });

  it('uses the default label when none is supplied', async () => {
    const credential = makeCredential();
    prisma.providerCredential.upsert.mockResolvedValue(credential);
    prisma.providerCredential.findFirst.mockResolvedValue(credential);
    jest.spyOn(service as any, 'checkWebhookReachable').mockResolvedValue(true);

    await service.save('merchant-1', 'user-1', Provider.STRIPE, {
      environment: Environment.SANDBOX,
      label: undefined,
      publicConfig: { publishableKey: 'pk_test' },
      secretConfig: { secretKey: 'sk_test' },
    } as never);

    expect(prisma.providerCredential.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          merchantId_provider_environment_label: expect.objectContaining({ label: 'default' }),
        }),
      }),
    );
  });

  it('lists credentials with masked secrets', async () => {
    prisma.providerCredential.findMany.mockResolvedValue([makeCredential()]);

    await expect(service.list('merchant-1')).resolves.toEqual([
      expect.objectContaining({
        id: 'credential-1',
        secretConfig: { secretKey: '***test', clientSecret: '***cret' },
      }),
    ]);
  });

  it('uses a safe secret fallback when decryption fails', async () => {
    crypto.decrypt.mockImplementation(() => {
      throw new Error('bad ciphertext');
    });
    prisma.providerCredential.findMany.mockResolvedValue([makeCredential()]);

    await expect(service.list('merchant-1')).resolves.toEqual([
      expect.objectContaining({ secretConfig: { secretConfig: '********' } }),
    ]);
  });

  it('rejects verification for an unknown credential', async () => {
    prisma.providerCredential.findFirst.mockResolvedValue(null);

    await expect(service.verify('merchant-1', 'missing')).rejects.toThrow(
      new NotFoundException('Provider credential not found'),
    );
  });

  it('records failed Stripe verification when the secret is missing', async () => {
    const credential = makeCredential();
    prisma.providerCredential.findFirst.mockResolvedValue(credential);
    crypto.decrypt.mockReturnValue({});
    jest.spyOn(service as any, 'checkWebhookReachable').mockResolvedValue(true);
    prisma.providerCredential.update.mockResolvedValue(
      makeCredential({
        verificationStatus: 'FAILED',
        lastVerificationError: 'Stripe secret key is missing',
        failedVerificationCount: 1,
      }),
    );

    await expect(service.verify('merchant-1', credential.id)).resolves.toEqual(
      expect.objectContaining({ verified: false, message: 'Stripe secret key is missing' }),
    );
    expect(prisma.providerVerificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ success: false }) }),
    );
  });

  it('records verified Stripe credentials when the secret and webhook are valid', async () => {
    const credential = makeCredential();
    prisma.providerCredential.findFirst.mockResolvedValue(credential);
    crypto.decrypt.mockReturnValue({ secretKey: 'sk_test' });
    jest.spyOn(service as any, 'checkWebhookReachable').mockResolvedValue(true);
    prisma.providerCredential.update.mockResolvedValue(
      makeCredential({
        verificationStatus: 'VERIFIED',
        oauthVerified: true,
        accountVerified: true,
        webhookVerified: true,
        environmentVerified: true,
        lastVerifiedAt: new Date(),
      }),
    );

    await expect(service.verify('merchant-1', credential.id)).resolves.toEqual(
      expect.objectContaining({ verified: true, message: 'Credentials look valid' }),
    );
    expect(prisma.providerVerificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ success: true }) }),
    );
  });

  it('returns disabled health for revoked credentials', async () => {
    prisma.providerCredential.findFirst.mockResolvedValue(
      makeCredential({ status: 'REVOKED', verificationStatus: 'VERIFIED' }),
    );

    await expect(service.health('merchant-1', 'credential-1')).resolves.toEqual(
      expect.objectContaining({ status: 'DISABLED', verificationStatus: 'VERIFIED' }),
    );
  });

  it('returns invalid health and a repair action after verification failure', async () => {
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

  it('disconnects a credential and audits the action', async () => {
    prisma.providerCredential.findFirst.mockResolvedValue(makeCredential());
    prisma.providerCredential.update.mockResolvedValue(
      makeCredential({ status: 'REVOKED', isDefault: false }),
    );

    await expect(service.disconnect('merchant-1', 'user-1', 'credential-1')).resolves.toEqual(
      expect.objectContaining({ status: 'REVOKED' }),
    );
    expect(auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'provider_credentials.disconnected', userId: 'user-1' }),
    );
  });

  it('force disconnects a credential and records the platform user', async () => {
    prisma.providerCredential.findFirst.mockResolvedValue(makeCredential());
    prisma.providerCredential.update.mockResolvedValue(
      makeCredential({ status: 'REVOKED', isDefault: false }),
    );

    await service.forceDisconnect('merchant-1', 'credential-1', 'platform-user-1');

    expect(auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'platform.provider_credentials.force_disconnected',
        metadata: expect.objectContaining({ platformUserId: 'platform-user-1' }),
      }),
    );
  });

  it('rejects setting a revoked credential as default', async () => {
    prisma.providerCredential.findFirst.mockResolvedValue(makeCredential({ status: 'REVOKED' }));

    await expect(service.setDefault('merchant-1', 'user-1', 'credential-1')).rejects.toThrow(
      new ForbiddenException('Only an active, connected provider can be set as default'),
    );
  });

  it('clears existing defaults, sets the credential, and audits the change', async () => {
    const credential = makeCredential();
    const tx = {
      providerCredential: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({ ...credential, isDefault: true }),
      },
    };
    prisma.providerCredential.findFirst.mockResolvedValue(credential);
    prisma.$transaction.mockImplementation((callback: (value: typeof tx) => unknown) =>
      callback(tx),
    );

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

  it('limits verification history to 100 entries', async () => {
    await service.verificationHistory('merchant-1', 'credential-1', 250);

    expect(prisma.providerVerificationLog.findMany).toHaveBeenCalledWith({
      where: { credentialId: 'credential-1', merchantId: 'merchant-1' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  });

  it('builds webhook URLs from APP_URL and falls back to localhost', () => {
    const webhookUrl = (service as any).webhookUrl(Provider.PAYPAL, 'merchant-1');
    expect(webhookUrl).toBe('https://example.com/webhooks/provider/paypal/merchant-1');

    config.get.mockReturnValue(undefined);
    expect((service as any).webhookUrl(Provider.MPESA, 'merchant-1')).toBe(
      'http://localhost:3000/webhooks/provider/mpesa/merchant-1',
    );
  });

  it.each([
    ['REVOKED', 'VERIFIED', 'DISABLED'],
    ['ACTIVE', 'FAILED', 'INVALID'],
    ['ACTIVE', 'PENDING', 'PENDING'],
    ['ACTIVE', 'PARTIALLY_VERIFIED', 'PARTIALLY_VERIFIED'],
    ['ACTIVE', 'VERIFIED', 'VERIFIED'],
  ])('maps %s/%s to health status %s', (status, verificationStatus, expected) => {
    expect((service as any).healthStatus({ status, verificationStatus })).toBe(expected);
  });

  it('returns the correct recommended actions', () => {
    expect(
      (service as any).nextRecommendedAction({
        status: 'REVOKED',
        verificationStatus: 'FAILED',
        oauthVerified: false,
        webhookVerified: false,
        lastVerificationError: null,
      }),
    ).toBe('Reconnect this provider to use it again');

    expect(
      (service as any).nextRecommendedAction({
        status: 'ACTIVE',
        verificationStatus: 'PENDING',
        oauthVerified: false,
        webhookVerified: false,
        lastVerificationError: null,
      }),
    ).toBe('Run verification to check these credentials');

    expect(
      (service as any).nextRecommendedAction({
        status: 'ACTIVE',
        verificationStatus: 'PARTIALLY_VERIFIED',
        oauthVerified: true,
        webhookVerified: false,
        lastVerificationError: null,
      }),
    ).toContain('publicly reachable');

    expect(
      (service as any).nextRecommendedAction({
        status: 'ACTIVE',
        verificationStatus: 'VERIFIED',
        oauthVerified: true,
        webhookVerified: true,
        lastVerificationError: null,
      }),
    ).toBe('No action needed');
  });

  it('delegates M-Pesa verification to the adapter', async () => {
    const credential = makeCredential({ provider: Provider.MPESA });
    prisma.providerCredential.findFirst.mockResolvedValue(credential);
    crypto.decrypt.mockReturnValue({
      consumerKey: 'key',
      consumerSecret: 'secret',
      passkey: 'pass',
    });
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
      makeCredential({ provider: Provider.MPESA, verificationStatus: 'VERIFIED' }),
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
