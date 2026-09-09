import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  const prisma = {
    payment: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    transaction: { updateMany: jest.fn() },
    checkoutSession: { update: jest.fn() },
    merchantSettings: { findUnique: jest.fn() },
  } as any;
  const config = { get: jest.fn() } as any;
  const crypto = { decrypt: jest.fn() } as any;
  const mpesa = { createStkPush: jest.fn() } as any;
  const mpesaVerification = {
    queryStkStatus: jest.fn(),
    initiateStkPush: jest.fn(),
  } as any;
  const stripe = { createPaymentIntent: jest.fn() } as any;
  const paypalPaymentService = {
    createOrder: jest.fn(),
    captureOrder: jest.fn(),
    queryOrder: jest.fn(),
  } as any;
  const auditLogs = { create: jest.fn() } as any;
  const webhooks = { forwardToUrl: jest.fn() } as any;
  let service: PaymentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockImplementation((key: string) =>
      key === 'DATABASE_URL' ? 'postgresql://localhost/payharness' : undefined,
    );
    prisma.merchantSettings.findUnique.mockResolvedValue({
      webhookForwardingUrl: 'https://merchant.example/webhook',
    });
    webhooks.forwardToUrl.mockResolvedValue({ delivered: true });
    service = new PaymentsService(
      prisma,
      config,
      crypto,
      mpesa,
      mpesaVerification,
      stripe,
      paypalPaymentService,
      auditLogs,
      webhooks,
    );
    jest.spyOn(service as any, 'getActiveCredential').mockResolvedValue({
      id: 'credential-1',
      provider: 'MPESA',
      environment: 'SANDBOX',
      verificationStatus: 'PENDING',
      oauthVerified: false,
      accountVerified: false,
      webhookVerified: false,
      environmentVerified: false,
      publicConfig: { shortcode: '174379' },
      encryptedSecretConfig: {},
    });
  });

  it('dispatches unified payment creation to each provider', async () => {
    const createMpesaSpy = jest
      .spyOn(service, 'createMpesaStk')
      .mockResolvedValue({ paymentId: 'payment-1' } as any);
    const createStripeSpy = jest
      .spyOn(service, 'createStripeIntent')
      .mockResolvedValue({ paymentId: 'payment-2' } as any);
    const createPaypalSpy = jest
      .spyOn(service, 'createPaypalOrder')
      .mockResolvedValue({ paymentId: 'payment-3' } as any);

    await expect(
      service.createPayment('merchant-1', 'user-1', {
        provider: 'MPESA',
        amountCents: 1000,
        currency: 'KES',
        environment: 'SANDBOX',
      } as any),
    ).resolves.toEqual({ paymentId: 'payment-1' });
    await expect(
      service.createPayment('merchant-1', 'user-1', {
        provider: 'STRIPE',
        amountCents: 1000,
        currency: 'USD',
        environment: 'SANDBOX',
      } as any),
    ).resolves.toEqual({ paymentId: 'payment-2' });
    await expect(
      service.createPayment('merchant-1', 'user-1', {
        provider: 'PAYPAL',
        amountCents: 1000,
        currency: 'USD',
        environment: 'SANDBOX',
      } as any),
    ).resolves.toEqual({ paymentId: 'payment-3' });

    expect(createMpesaSpy).toHaveBeenCalled();
    expect(createStripeSpy).toHaveBeenCalled();
    expect(createPaypalSpy).toHaveBeenCalled();
  });

  it('rejects simulated PayPal outcomes', async () => {
    await expect(
      service.createPayment('merchant-1', 'user-1', {
        provider: 'PAYPAL',
        amountCents: 1000,
        currency: 'USD',
        environment: 'SANDBOX',
        simulateOutcome: 'SUCCEEDED',
      } as any),
    ).rejects.toThrow('PayPal does not support simulated outcomes');
    expect(paypalPaymentService.createOrder).not.toHaveBeenCalled();
  });

  it('routes generic PayPal queries through the stored provider', async () => {
    prisma.payment.findFirst.mockResolvedValue({
      id: 'payment-paypal',
      merchantId: 'merchant-1',
      provider: 'PAYPAL',
      environment: 'SANDBOX',
    });
    paypalPaymentService.queryOrder.mockResolvedValue({
      paymentId: 'payment-paypal',
      status: 'SUCCEEDED',
      providerStatus: 'COMPLETED',
    });

    await expect(
      service.queryPayment('merchant-1', 'user-1', 'payment-paypal'),
    ).resolves.toEqual({
      paymentId: 'payment-paypal',
      status: 'SUCCEEDED',
      providerStatus: 'COMPLETED',
    });
    expect(paypalPaymentService.queryOrder).toHaveBeenCalledWith(
      'merchant-1',
      'user-1',
      'payment-paypal',
    );
  });

  it('blocks LIVE M-Pesa STK requests without full verification', async () => {
    await expect(
      service.createMpesaStk('merchant-1', 'user-1', {
        environment: 'LIVE',
        amountCents: 1000,
        phoneNumber: '254700000000',
      } as any),
    ).rejects.toThrow('fully verified provider credential');
    expect(mpesaVerification.initiateStkPush).not.toHaveBeenCalled();
  });

  it('allows LIVE M-Pesa after all verification gates pass', async () => {
    jest.spyOn(service as any, 'getActiveCredential').mockResolvedValue({
      id: 'credential-1',
      provider: 'MPESA',
      environment: 'LIVE',
      verificationStatus: 'VERIFIED',
      oauthVerified: true,
      accountVerified: true,
      webhookVerified: true,
      environmentVerified: true,
      publicConfig: { shortcode: '600000', businessType: 'PAYBILL' },
      encryptedSecretConfig: {},
    });
    jest.spyOn(service as any, 'getAndValidateSession').mockResolvedValue(null);
    crypto.decrypt.mockReturnValue({
      consumerKey: 'key',
      consumerSecret: 'secret',
      passkey: 'passkey',
    });
    mpesaVerification.initiateStkPush.mockResolvedValue({
      checkoutRequestId: 'ws_CO_live_1',
    });
    prisma.payment.create.mockResolvedValue({
      id: 'payment-live-1',
      status: 'PENDING',
    });

    const result = await service.createMpesaStk('merchant-1', 'user-1', {
      environment: 'LIVE',
      amountCents: 1000,
      phoneNumber: '254700000000',
    } as any);

    expect(result).toEqual(
      expect.objectContaining({
        paymentId: 'payment-live-1',
        provider: 'MPESA',
        environment: 'LIVE',
        status: 'PENDING',
        checkoutRequestId: 'ws_CO_live_1',
      }),
    );
    expect(mpesaVerification.initiateStkPush).toHaveBeenCalledWith(
      expect.objectContaining({ environment: 'LIVE' }),
    );
  });

  it('uses the simulated M-Pesa path when no phone number is supplied', async () => {
    const processSpy = jest
      .spyOn(service as any, 'process')
      .mockResolvedValue({ status: 'PENDING' });

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

  it('keeps a pending M-Pesa payment pending', async () => {
    prisma.payment.findFirst.mockResolvedValue({
      id: 'payment-pending',
      merchantId: 'merchant-1',
      provider: 'MPESA',
      environment: 'SANDBOX',
      status: 'PENDING',
      providerReference: 'ws_CO_pending',
    });
    jest.spyOn(service as any, 'getActiveCredential').mockResolvedValue({
      id: 'credential-1',
      provider: 'MPESA',
      environment: 'SANDBOX',
      publicConfig: { shortcode: '174379' },
      encryptedSecretConfig: {},
    });
    crypto.decrypt.mockReturnValue({
      consumerKey: 'key',
      consumerSecret: 'secret',
      passkey: 'passkey',
    });
    mpesaVerification.queryStkStatus.mockResolvedValue({ status: 'PENDING' });

    await expect(
      service.queryPayment('merchant-1', 'user-1', 'payment-pending'),
    ).resolves.toEqual({ paymentId: 'payment-pending', status: 'PENDING' });
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it('does not expose another merchant payment', async () => {
    prisma.payment.findFirst.mockResolvedValue(null);

    await expect(
      service.queryPayment('merchant-2', 'user-2', 'payment-1'),
    ).rejects.toThrow('Payment not found');
  });

  it('settles a pending payment and forwards the terminal webhook', async () => {
    const payment = {
      id: 'payment-1',
      merchantId: 'merchant-1',
      provider: 'MPESA',
      environment: 'SANDBOX',
      amountCents: 2500,
      currency: 'KES',
      status: 'PENDING',
      checkoutSessionId: 'session-1',
    } as any;
    prisma.checkoutSession.update.mockResolvedValue({ id: 'session-1' });

    await (service as any).settlePendingPayment(
      'merchant-1',
      'user-1',
      payment,
      'SUCCEEDED',
      undefined,
      'corr-success',
    );

    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: 'payment-1' },
      data: { status: 'SUCCEEDED' },
    });
    expect(webhooks.forwardToUrl).toHaveBeenCalledWith(
      'https://merchant.example/webhook',
      'payment.succeeded',
      expect.objectContaining({ paymentId: 'payment-1', status: 'SUCCEEDED' }),
    );
  });
});
