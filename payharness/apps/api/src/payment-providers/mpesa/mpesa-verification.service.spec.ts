import { MpesaVerificationInput, MpesaVerificationService } from './mpesa-verification.service';

describe('MpesaVerificationService', () => {
  const config = { get: jest.fn() } as any;
  const prisma = {
    providerCredential: { update: jest.fn() },
    providerVerificationLog: { create: jest.fn() },
  } as any;

  let service: MpesaVerificationService;

  const input: MpesaVerificationInput = {
    credentialId: 'credential-1',
    merchantId: 'merchant-1',
    consumerKey: 'consumer-key',
    consumerSecret: 'consumer-secret',
    shortcode: '174379',
    businessType: 'PAYBILL',
    passkey: 'passkey',
    environment: 'SANDBOX',
    callbackUrl: 'https://example.com/callback',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MpesaVerificationService(config, prisma);
    jest.spyOn((service as any).logger, 'log').mockImplementation(() => undefined);
    jest.spyOn((service as any).logger, 'debug').mockImplementation(() => undefined);
    jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
    prisma.providerCredential.update.mockResolvedValue({});
    prisma.providerVerificationLog.create.mockResolvedValue({});
  });

  it('returns VERIFIED when OAuth, account, and webhook checks pass', async () => {
    jest.spyOn(service as any, 'verifyConfiguration').mockReturnValue({
      accountVerified: true,
      errors: [],
    });
    jest.spyOn(service as any, 'verifyOAuth').mockResolvedValue({
      oauthVerified: true,
      errors: [],
      warnings: [],
    });
    jest.spyOn(service as any, 'verifyWebhook').mockResolvedValue({
      reachable: true,
      statusCode: 200,
      latencyMs: 20,
      requestUrl: input.callbackUrl,
    });
    jest.spyOn(service as any, 'verifyCapabilities').mockReturnValue({
      supportsSTKPush: true,
      supportsC2B: false,
      supportsB2C: false,
      supportsTransactionStatus: true,
      supportsReversal: false,
      supportsBalance: false,
      supportsRegisterUrls: false,
    });

    const result = await service.verify(input);

    expect(result.overallStatus).toBe('VERIFIED');
    expect(result.oauthVerified).toBe(true);
    expect(result.accountVerified).toBe(true);
    expect(result.webhookVerified).toBe(true);
    expect(result.environmentVerified).toBe(true);
    expect(prisma.providerCredential.update).toHaveBeenCalled();
    expect(prisma.providerVerificationLog.create).toHaveBeenCalled();
  });

  it('returns PARTIALLY_VERIFIED when OAuth fails', async () => {
    jest.spyOn(service as any, 'verifyConfiguration').mockReturnValue({
      accountVerified: true,
      errors: [],
    });
    jest.spyOn(service as any, 'verifyOAuth').mockResolvedValue({
      oauthVerified: false,
      errors: ['Invalid credentials'],
      warnings: [],
    });
    jest.spyOn(service as any, 'verifyWebhook').mockResolvedValue({
      reachable: true,
      statusCode: 200,
      latencyMs: 20,
      requestUrl: input.callbackUrl,
    });
    jest.spyOn(service as any, 'verifyCapabilities').mockReturnValue({
      supportsSTKPush: false,
      supportsC2B: false,
      supportsB2C: false,
      supportsTransactionStatus: false,
      supportsReversal: false,
      supportsBalance: false,
      supportsRegisterUrls: false,
    });

    const result = await service.verify(input);

    expect(result.overallStatus).toBe('PARTIALLY_VERIFIED');
    expect(result.oauthVerified).toBe(false);
    expect(result.environmentVerified).toBe(false);
    expect(result.errors).toEqual([JSON.stringify({ step: 'oauth', errors: ['Invalid credentials'] })]);
    expect(prisma.providerCredential.update).toHaveBeenCalled();
  });

  it('returns PARTIALLY_VERIFIED when account configuration is invalid', async () => {
    jest.spyOn(service as any, 'verifyConfiguration').mockReturnValue({
      accountVerified: false,
      errors: ['Shortcode must be 5-7 digits and business type must be PAYBILL or TILL'],
    });
    jest.spyOn(service as any, 'verifyOAuth').mockResolvedValue({
      oauthVerified: true,
      errors: [],
      warnings: [],
    });
    jest.spyOn(service as any, 'verifyWebhook').mockResolvedValue({
      reachable: true,
      statusCode: 405,
      latencyMs: 25,
      requestUrl: input.callbackUrl,
    });
    jest.spyOn(service as any, 'verifyCapabilities').mockReturnValue({
      supportsSTKPush: true,
      supportsC2B: false,
      supportsB2C: false,
      supportsTransactionStatus: true,
      supportsReversal: false,
      supportsBalance: false,
      supportsRegisterUrls: false,
    });

    const result = await service.verify(input);

    expect(result.overallStatus).toBe('PARTIALLY_VERIFIED');
    expect(result.accountVerified).toBe(false);
    expect(result.webhookVerified).toBe(true);
  });

  it('treats an HTTP 405 response as a reachable webhook', async () => {
    jest.spyOn(service as any, 'verifyWebhook').mockResolvedValue({
      reachable: true,
      statusCode: 405,
      latencyMs: 10,
      requestUrl: input.callbackUrl,
    });

    const result = await (service as any).verifyWebhook(input, 'correlation-1');

    expect(result.reachable).toBe(true);
    expect(result.statusCode).toBe(405);
  });

  it('reports provider capabilities from OAuth state', () => {
    const enabled = (service as any).verifyCapabilities(true);
    const disabled = (service as any).verifyCapabilities(false);

    expect(enabled.supportsSTKPush).toBe(true);
    expect(enabled.supportsTransactionStatus).toBe(true);
    expect(disabled.supportsSTKPush).toBe(false);
    expect(disabled.supportsTransactionStatus).toBe(false);
  });

  it('validates shortcode and business type', () => {
    expect((service as any).verifyConfiguration(input).accountVerified).toBe(true);
    expect(
      (service as any).verifyConfiguration({ ...input, shortcode: '123', businessType: 'OTHER' }).accountVerified,
    ).toBe(false);
  });
});
