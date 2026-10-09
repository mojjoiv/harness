import { PaymentsService } from './payments.service';
import { ProviderRegistry } from '../payment-providers/provider-registry';

describe('PaymentsService', () => {
  const prisma = {
    payment: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
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

  const paypalPaymentService = {
    createOrder: jest.fn(),
    captureOrder: jest.fn(),
    queryOrder: jest.fn(),
  } as any;
  const pesapalPaymentService = {
    createOrder: jest.fn(),
    queryOrder: jest.fn(),
  } as any;
  const auditLogs = { create: jest.fn() } as any;
  const webhooks = { forwardToUrl: jest.fn() } as any;
  const providers = new ProviderRegistry();
  const ledger = { postPaymentSettlement: jest.fn(), postPayoutSettlement: jest.fn() } as any;
  const fraudRisk = {
    assess: jest.fn(),
    attachPayment: jest.fn(),
    listAssessments: jest.fn(),
  } as any;
  let service: PaymentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockImplementation((key: string) =>
      key === 'DATABASE_URL' ? 'postgresql://localhost/payharness' : undefined,
    );
    prisma.merchantSettings.findUnique.mockResolvedValue({
      webhookForwardingUrl: 'https://merchant.example/webhook',
    });
    prisma.payment.updateMany.mockResolvedValue({ count: 1 });
    ledger.postPaymentSettlement.mockResolvedValue({ id: 'journal-1' });
    webhooks.forwardToUrl.mockResolvedValue({ delivered: true });
    fraudRisk.assess.mockResolvedValue({
      id: 'assessment-default',
      decision: 'ALLOW',
      score: 0,
      reasons: [],
    });
    fraudRisk.attachPayment.mockResolvedValue(undefined);
    fraudRisk.listAssessments.mockResolvedValue([]);
    jest.spyOn(providers, 'supportsEnvironment').mockReturnValue(true);
    jest.spyOn(providers, 'getAdapter').mockImplementation((provider: any) => {
      if (provider === 'MPESA') {
        return {
          createPayment: async (input: any) => {
            const result = await mpesaVerification.initiateStkPush(input);
            return {
              providerReference: result.checkoutRequestId,
              providerStatus: result.responseCode,
              status: 'PENDING',
              resultDesc: result.responseDescription,
            };
          },
          queryPayment: async (input: any) => {
            const result = await mpesaVerification.queryStkStatus(input);
            return {
              providerReference: input.providerReference,
              status: result.status,
              providerStatus: result.resultCode,
              resultDesc: result.resultDesc,
            };
          },
        } as any;
      }
      return {
        createPayment: jest.fn(),
        queryPayment: jest.fn(),
      } as any;
    });
    service = new PaymentsService(
      prisma,
      config,
      crypto,
      mpesa,
      paypalPaymentService,
      pesapalPaymentService,
      auditLogs,
      webhooks,
      providers,
      ledger,
      fraudRisk,
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
    ).resolves.toEqual(expect.objectContaining({ paymentId: 'payment-1' }));
    await expect(
      service.createPayment('merchant-1', 'user-1', {
        provider: 'STRIPE',
        amountCents: 1000,
        currency: 'USD',
        environment: 'SANDBOX',
      } as any),
    ).resolves.toEqual(expect.objectContaining({ paymentId: 'payment-2' }));
    await expect(
      service.createPayment('merchant-1', 'user-1', {
        provider: 'PAYPAL',
        amountCents: 1000,
        currency: 'USD',
        environment: 'SANDBOX',
      } as any),
    ).resolves.toEqual(expect.objectContaining({ paymentId: 'payment-3' }));

    expect(createMpesaSpy).toHaveBeenCalled();
    expect(createStripeSpy).toHaveBeenCalled();
    expect(createPaypalSpy).toHaveBeenCalled();
  });


  it('blocks a payment before the provider handler when risk is high', async () => {
    fraudRisk.assess.mockResolvedValue({
      id: 'assessment-blocked',
      decision: 'BLOCK',
      score: 85,
      reasons: ['Extreme IP transaction velocity'],
    });

    const createMpesaSpy = jest
      .spyOn(service, 'createMpesaStk')
      .mockResolvedValue({ paymentId: 'payment-never-created' } as any);

    await expect(
      service.createPayment('merchant-1', 'user-1', {
        provider: 'MPESA',
        amountCents: 1000,
        currency: 'KES',
        environment: 'SANDBOX',
      } as any),
    ).rejects.toThrow('Payment blocked by PayHarness risk engine');

    expect(createMpesaSpy).not.toHaveBeenCalled();
    expect(fraudRisk.attachPayment).not.toHaveBeenCalled();
  });

  it('returns the risk decision with an allowed payment', async () => {
    fraudRisk.assess.mockResolvedValue({
      id: 'assessment-allow',
      decision: 'ALLOW',
      score: 10,
      reasons: ['High transaction amount'],
    });

    jest.spyOn(service, 'createStripeIntent').mockResolvedValue({
      paymentId: 'payment-1',
      provider: 'STRIPE',
      environment: 'SANDBOX',
      status: 'PENDING',
    } as any);

    await expect(
      service.createPayment('merchant-1', 'user-1', {
        provider: 'STRIPE',
        amountCents: 1000,
        currency: 'USD',
        environment: 'SANDBOX',
      } as any),
    ).resolves.toEqual(
      expect.objectContaining({
        paymentId: 'payment-1',
        fraudRisk: {
          decision: 'ALLOW',
          score: 10,
          reasons: ['High transaction amount'],
        },
      }),
    );

    expect(fraudRisk.attachPayment).toHaveBeenCalledWith('assessment-allow', 'payment-1');
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

    await expect(service.queryPayment('merchant-1', 'user-1', 'payment-paypal')).resolves.toEqual({
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

    await expect(service.queryPayment('merchant-1', 'user-1', 'payment-pending')).resolves.toEqual({
      paymentId: 'payment-pending',
      status: 'PENDING',
    });
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it('does not expose another merchant payment', async () => {
    prisma.payment.findFirst.mockResolvedValue(null);

    await expect(service.queryPayment('merchant-2', 'user-2', 'payment-1')).rejects.toThrow(
      'Payment not found',
    );
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
    prisma.payment.updateMany.mockResolvedValue({ count: 1 });

    await (service as any).settlePendingPayment(
      'merchant-1',
      'user-1',
      payment,
      'SUCCEEDED',
      undefined,
      'corr-success',
    );

    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'payment-1', status: 'PENDING' },
      data: { status: 'SUCCEEDED' },
    });
    expect(ledger.postPaymentSettlement).toHaveBeenCalledWith({
      merchantId: 'merchant-1',
      paymentId: 'payment-1',
      amountCents: 2500,
      currency: 'KES',
    });
    expect(webhooks.forwardToUrl).toHaveBeenCalledWith(
      'https://merchant.example/webhook',
      'payment.succeeded',
      expect.objectContaining({ paymentId: 'payment-1', status: 'SUCCEEDED' }),
    );
  });

  it('does not duplicate settlement side effects when another request wins the status transition', async () => {
    const payment = {
      id: 'payment-race',
      merchantId: 'merchant-1',
      provider: 'MPESA',
      environment: 'SANDBOX',
      amountCents: 2500,
      currency: 'KES',
      status: 'PENDING',
      checkoutSessionId: 'session-race',
    } as any;
    prisma.payment.updateMany.mockResolvedValue({ count: 0 });

    await (service as any).settlePendingPayment(
      'merchant-1',
      'user-1',
      payment,
      'SUCCEEDED',
      undefined,
      'corr-race',
    );

    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'payment-race', status: 'PENDING' },
      data: { status: 'SUCCEEDED' },
    });
    expect(prisma.transaction.updateMany).not.toHaveBeenCalled();
    expect(ledger.postPaymentSettlement).not.toHaveBeenCalled();
    expect(auditLogs.create).not.toHaveBeenCalled();
    expect(prisma.checkoutSession.update).not.toHaveBeenCalled();
    expect(webhooks.forwardToUrl).not.toHaveBeenCalled();
  });

  it('records failed settlement without posting a success ledger entry', async () => {
    const payment = {
      id: 'payment-failed',
      merchantId: 'merchant-1',
      provider: 'MPESA',
      environment: 'SANDBOX',
      amountCents: 2500,
      currency: 'KES',
      status: 'PENDING',
      checkoutSessionId: 'session-failed',
    } as any;
    prisma.checkoutSession.update.mockResolvedValue({ id: 'session-failed' });

    await (service as any).settlePendingPayment(
      'merchant-1',
      'user-1',
      payment,
      'FAILED',
      'Provider declined payment',
      'corr-failed',
    );

    expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
      where: { paymentId: 'payment-failed', status: 'PENDING' },
      data: { status: 'FAILED' },
    });
    expect(ledger.postPaymentSettlement).not.toHaveBeenCalled();
    expect(auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId: 'merchant-1',
        userId: 'user-1',
        action: 'payment.settled',
        entityId: 'payment-failed',
        metadata: { status: 'FAILED', reason: 'Provider declined payment' },
      }),
    );
    expect(webhooks.forwardToUrl).toHaveBeenCalledWith(
      'https://merchant.example/webhook',
      'payment.failed',
      expect.objectContaining({ paymentId: 'payment-failed', status: 'FAILED' }),
    );
  });

});
