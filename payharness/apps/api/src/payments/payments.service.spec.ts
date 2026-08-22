import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  const prisma = {
    payment: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  } as any;

  const config = { get: jest.fn() } as any;
  const crypto = { decrypt: jest.fn() } as any;
  const mpesa = { createStkPush: jest.fn() } as any;
  const mpesaVerification = {
    queryStkStatus: jest.fn(),
    initiateStkPush: jest.fn(),
  } as any;
  const stripe = { createPaymentIntent: jest.fn() } as any;
  const paypal = { createOrder: jest.fn() } as any;
  const auditLogs = { create: jest.fn() } as any;

  let service: PaymentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockImplementation((key: string) => (key === 'DATABASE_URL' ? 'postgresql://localhost/payharness' : undefined));
    service = new PaymentsService(
      prisma,
      config,
      crypto,
      mpesa,
      mpesaVerification,
      stripe,
      paypal,
      auditLogs,
    );
    jest.spyOn(service as any, 'getActiveCredential').mockResolvedValue({
      id: 'credential-1',
      provider: 'MPESA',
      environment: 'SANDBOX',
      publicConfig: { shortcode: '174379' },
      encryptedSecretConfig: {},
    });
  });

  it('blocks LIVE M-Pesa STK requests before loading credentials', async () => {
    const credentialSpy = jest.spyOn(service as any, 'getActiveCredential');

    await expect(
      service.createMpesaStk('merchant-1', 'user-1', {
        environment: 'LIVE',
        amountCents: 1000,
        phoneNumber: '254700000000',
      } as any),
    ).rejects.toThrow();

    expect(credentialSpy).not.toHaveBeenCalled();
  });

  it('uses the simulated path when no phone number is supplied', async () => {
    const processSpy = jest.spyOn(service as any, 'process').mockResolvedValue({ status: 'PENDING' });

    await service.createMpesaStk('merchant-1', undefined, {
      environment: 'SANDBOX',
      amountCents: 1000,
    } as any);

    expect(processSpy).toHaveBeenCalledWith(
      'merchant-1',
      undefined,
      'MPESA',
      expect.objectContaining({ environment: 'SANDBOX', amountCents: 1000 }),
      expect.any(Function),
    );
  });

  it('never logs decrypted M-Pesa credentials', async () => {
    const secrets = {
      consumerKey: 'consumer-key-secret',
      consumerSecret: 'consumer-secret-secret',
      passkey: 'passkey-secret',
    };
    crypto.decrypt.mockReturnValue(secrets);
    prisma.payment.findFirst.mockResolvedValue({
      id: 'payment-1',
      merchantId: 'merchant-1',
      provider: 'MPESA',
      environment: 'SANDBOX',
      status: 'PENDING',
      providerReference: 'ws_CO_123',
    });
    mpesaVerification.queryStkStatus.mockResolvedValue({ status: 'PENDING' });

    const loggerLogSpy = jest.spyOn((service as any).logger, 'log');
    const loggerErrorSpy = jest.spyOn((service as any).logger, 'error');

    await service.queryPayment('merchant-1', 'user-1', 'payment-1');

    const loggedText = loggerLogSpy.mock.calls.flat().join(' ');
    const errorText = loggerErrorSpy.mock.calls.flat().join(' ');

    expect(loggedText).toContain('M-Pesa credentials decrypted successfully (values redacted)');
    expect(loggedText).not.toContain(secrets.consumerKey);
    expect(loggedText).not.toContain(secrets.consumerSecret);
    expect(loggedText).not.toContain(secrets.passkey);
    expect(errorText).not.toContain(secrets.consumerKey);
    expect(errorText).not.toContain(secrets.consumerSecret);
    expect(errorText).not.toContain(secrets.passkey);
  });

  it('returns the provider response from the STK processing path', async () => {
    const secrets = {
      consumerKey: 'test-key',
      consumerSecret: 'test-secret',
      passkey: 'test-passkey',
    };

    jest.spyOn(service as any, 'getAndValidateSession').mockResolvedValue({
      id: 'session-1',
      merchantId: 'merchant-1',
    } as any);
    crypto.decrypt.mockReturnValue(secrets);
    mpesaVerification.initiateStkPush.mockResolvedValue({
      checkoutRequestId: 'ws_CO_456',
    });
    prisma.payment.create.mockResolvedValue({
      id: 'payment-1',
      status: 'PENDING',
    });

    const result = await service.createMpesaStk('merchant-1', 'user-1', {
      environment: 'SANDBOX',
      amountCents: 2500,
      phoneNumber: '254711111111',
    } as any);

    expect(result).toEqual(expect.objectContaining({
      paymentId: 'payment-1',
      provider: 'MPESA',
      environment: 'SANDBOX',
      status: 'PENDING',
      checkoutRequestId: 'ws_CO_456',
    }));
    expect(mpesaVerification.initiateStkPush).toHaveBeenCalled();
  });

  it('propagates a processing failure instead of masking it', async () => {
    const failure = new Error('M-Pesa provider unavailable');
    jest.spyOn(service as any, 'getAndValidateSession').mockResolvedValue({
      id: 'session-1',
      merchantId: 'merchant-1',
    } as any);
    crypto.decrypt.mockReturnValue({
      consumerKey: 'test-key',
      consumerSecret: 'test-secret',
      passkey: 'test-passkey',
    });
    mpesaVerification.initiateStkPush.mockRejectedValue(failure);

    await expect(
      service.createMpesaStk('merchant-1', 'user-1', {
        environment: 'SANDBOX',
        amountCents: 2500,
        phoneNumber: '254711111111',
      } as any),
    ).rejects.toThrow('M-Pesa provider unavailable');
  });
});
