import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  const prisma = {
    payment: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    transaction: { updateMany: jest.fn() },
    checkoutSession: { update: jest.fn() },
    merchantSettings: { findUnique: jest.fn() },
  } as any;
  const config = { get: jest.fn() } as any;
  const crypto = { decrypt: jest.fn() } as any;
  const mpesa = { createStkPush: jest.fn() } as any;
  const mpesaVerification = { queryStkStatus: jest.fn(), initiateStkPush: jest.fn() } as any;
  const stripe = { createPaymentIntent: jest.fn() } as any;
  const paypal = { createOrder: jest.fn() } as any;
  const auditLogs = { create: jest.fn() } as any;
  const webhooks = { forwardToUrl: jest.fn() } as any;
  let service: PaymentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockImplementation((key: string) => (key === 'DATABASE_URL' ? 'postgresql://localhost/payharness' : undefined));
    prisma.merchantSettings.findUnique.mockResolvedValue({ webhookForwardingUrl: 'https://merchant.example/webhook' });
    webhooks.forwardToUrl.mockResolvedValue({ delivered: true });
    service = new PaymentsService(prisma, config, crypto, mpesa, mpesaVerification, stripe, paypal, auditLogs, webhooks);
    jest.spyOn(service as any, 'getActiveCredential').mockResolvedValue({
      id: 'credential-1', provider: 'MPESA', environment: 'SANDBOX', verificationStatus: 'PENDING',
      oauthVerified: false, accountVerified: false, webhookVerified: false, environmentVerified: false,
      publicConfig: { shortcode: '174379' }, encryptedSecretConfig: {},
    });
  });

  it('blocks LIVE M-Pesa STK requests when the credential is not fully verified', async () => {
    const credentialSpy = jest.spyOn(service as any, 'getActiveCredential');
    await expect(service.createMpesaStk('merchant-1', 'user-1', { environment: 'LIVE', amountCents: 1000, phoneNumber: '254700000000' } as any)).rejects.toThrow('fully verified provider credential');
    expect(credentialSpy).toHaveBeenCalledWith('merchant-1', 'MPESA', 'LIVE');
    expect(mpesaVerification.initiateStkPush).not.toHaveBeenCalled();
  });

  it('allows LIVE M-Pesa only after every verification gate passes', async () => {
    jest.spyOn(service as any, 'getActiveCredential').mockResolvedValue({
      id: 'credential-1', provider: 'MPESA', environment: 'LIVE', verificationStatus: 'VERIFIED',
      oauthVerified: true, accountVerified: true, webhookVerified: true, environmentVerified: true,
      publicConfig: { shortcode: '600000', businessType: 'PAYBILL' }, encryptedSecretConfig: {},
    });
    jest.spyOn(service as any, 'getAndValidateSession').mockResolvedValue(null);
    crypto.decrypt.mockReturnValue({ consumerKey: 'key', consumerSecret: 'secret', passkey: 'passkey' });
    mpesaVerification.initiateStkPush.mockResolvedValue({ checkoutRequestId: 'ws_CO_live_1' });
    prisma.payment.create.mockResolvedValue({ id: 'payment-live-1', status: 'PENDING' });
    const result = await service.createMpesaStk('merchant-1', 'user-1', { environment: 'LIVE', amountCents: 1000, phoneNumber: '254700000000' } as any);
    expect(result).toEqual(expect.objectContaining({ paymentId: 'payment-live-1', provider: 'MPESA', environment: 'LIVE', status: 'PENDING', checkoutRequestId: 'ws_CO_live_1' }));
    expect(mpesaVerification.initiateStkPush).toHaveBeenCalledWith(expect.objectContaining({ environment: 'LIVE' }));
  });

  it('uses the simulated path when no phone number is supplied', async () => {
    const processSpy = jest.spyOn(service as any, 'process').mockResolvedValue({ status: 'PENDING' });
    await service.createMpesaStk('merchant-1', undefined, { environment: 'SANDBOX', amountCents: 1000 } as any);
    expect(processSpy).toHaveBeenCalledWith('merchant-1', undefined, 'MPESA', expect.objectContaining({ environment: 'SANDBOX', amountCents: 1000 }), expect.any(Function));
  });

  it('never logs decrypted M-Pesa credentials', async () => {
    const secrets = { consumerKey: 'consumer-key-secret', consumerSecret: 'consumer-secret-secret', passkey: 'passkey-secret' };
    crypto.decrypt.mockReturnValue(secrets);
    prisma.payment.findFirst.mockResolvedValue({ id: 'payment-1', merchantId: 'merchant-1', provider: 'MPESA', environment: 'SANDBOX', status: 'PENDING', providerReference: 'ws_CO_123' });
    mpesaVerification.queryStkStatus.mockResolvedValue({ status: 'PENDING' });
    const loggerLogSpy = jest.spyOn((service as any).logger, 'log');
    const loggerErrorSpy = jest.spyOn((service as any).logger, 'error');
    await service.queryPayment('merchant-1', 'user-1', 'payment-1');
    const loggedText = loggerLogSpy.mock.calls.flat().join(' ');
    const errorText = loggerErrorSpy.mock.calls.flat().join(' ');
    expect(loggedText).not.toContain(secrets.consumerKey);
    expect(loggedText).not.toContain(secrets.consumerSecret);
    expect(loggedText).not.toContain(secrets.passkey);
    expect(errorText).not.toContain(secrets.consumerKey);
    expect(errorText).not.toContain(secrets.consumerSecret);
    expect(errorText).not.toContain(secrets.passkey);
  });

  it('returns the provider response from the STK processing path', async () => {
    crypto.decrypt.mockReturnValue({ consumerKey: 'test-key', consumerSecret: 'test-secret', passkey: 'test-passkey' });
    jest.spyOn(service as any, 'getAndValidateSession').mockResolvedValue({ id: 'session-1', merchantId: 'merchant-1' } as any);
    mpesaVerification.initiateStkPush.mockResolvedValue({ checkoutRequestId: 'ws_CO_456' });
    prisma.payment.create.mockResolvedValue({ id: 'payment-1', status: 'PENDING' });
    const result = await service.createMpesaStk('merchant-1', 'user-1', { environment: 'SANDBOX', amountCents: 2500, phoneNumber: '254711111111' } as any);
    expect(result).toEqual(expect.objectContaining({ paymentId: 'payment-1', provider: 'MPESA', environment: 'SANDBOX', status: 'PENDING', checkoutRequestId: 'ws_CO_456' }));
    expect(mpesaVerification.initiateStkPush).toHaveBeenCalled();
  });

  it('propagates a processing failure instead of masking it', async () => {
    jest.spyOn(service as any, 'getAndValidateSession').mockResolvedValue({ id: 'session-1', merchantId: 'merchant-1' } as any);
    crypto.decrypt.mockReturnValue({ consumerKey: 'test-key', consumerSecret: 'test-secret', passkey: 'test-passkey' });
    mpesaVerification.initiateStkPush.mockRejectedValue(new Error('M-Pesa provider unavailable'));
    await expect(service.createMpesaStk('merchant-1', 'user-1', { environment: 'SANDBOX', amountCents: 2500, phoneNumber: '254711111111' } as any)).rejects.toThrow('M-Pesa provider unavailable');
  });

  it('settles a pending payment as SUCCEEDED and forwards payment.succeeded', async () => {
    const payment = { id: 'payment-1', merchantId: 'merchant-1', provider: 'MPESA', environment: 'SANDBOX', amountCents: 2500, currency: 'KES', status: 'PENDING', checkoutSessionId: 'session-1' } as any;
    prisma.checkoutSession.update.mockResolvedValue({ id: 'session-1' });
    await (service as any).settlePendingPayment('merchant-1', 'user-1', payment, 'SUCCEEDED', undefined, 'corr-success');
    expect(prisma.payment.update).toHaveBeenCalledWith({ where: { id: 'payment-1' }, data: { status: 'SUCCEEDED' } });
    expect(prisma.transaction.updateMany).toHaveBeenCalledWith({ where: { paymentId: 'payment-1' }, data: { status: 'SUCCEEDED' } });
    expect(prisma.checkoutSession.update).toHaveBeenCalledWith({ where: { id: 'session-1' }, data: { status: 'SUCCEEDED' } });
    expect(webhooks.forwardToUrl).toHaveBeenCalledWith(
      'https://merchant.example/webhook',
      'payment.succeeded',
      expect.objectContaining({ event: 'payment.succeeded', paymentId: 'payment-1', checkoutSessionId: 'session-1', status: 'SUCCEEDED' }),
    );
  });

  it('settles a pending payment as FAILED and forwards payment.failed', async () => {
    const payment = { id: 'payment-2', merchantId: 'merchant-1', provider: 'MPESA', environment: 'SANDBOX', amountCents: 2500, currency: 'KES', status: 'PENDING', checkoutSessionId: 'session-2' } as any;
    prisma.checkoutSession.update.mockResolvedValue({ id: 'session-2' });
    await (service as any).settlePendingPayment('merchant-1', 'user-1', payment, 'FAILED', 'Customer cancelled', 'corr-failed');
    expect(prisma.payment.update).toHaveBeenCalledWith({ where: { id: 'payment-2' }, data: { status: 'FAILED' } });
    expect(prisma.transaction.updateMany).toHaveBeenCalledWith({ where: { paymentId: 'payment-2' }, data: { status: 'FAILED' } });
    expect(prisma.checkoutSession.update).toHaveBeenCalledWith({ where: { id: 'session-2' }, data: { status: 'FAILED' } });
    expect(webhooks.forwardToUrl).toHaveBeenCalledWith(
      'https://merchant.example/webhook',
      'payment.failed',
      expect.objectContaining({ event: 'payment.failed', paymentId: 'payment-2', status: 'FAILED' }),
    );
  });

  it('keeps a pending payment pending when the provider reports PENDING', async () => {
    prisma.payment.findFirst.mockResolvedValue({ id: 'payment-pending', merchantId: 'merchant-1', provider: 'MPESA', environment: 'SANDBOX', status: 'PENDING', providerReference: 'ws_CO_pending' });
    jest.spyOn(service as any, 'getActiveCredential').mockResolvedValue({ id: 'credential-1', provider: 'MPESA', environment: 'SANDBOX', publicConfig: { shortcode: '174379' }, encryptedSecretConfig: {} });
    crypto.decrypt.mockReturnValue({ consumerKey: 'key', consumerSecret: 'secret', passkey: 'passkey' });
    mpesaVerification.queryStkStatus.mockResolvedValue({ status: 'PENDING' });
    const result = await service.queryPayment('merchant-1', 'user-1', 'payment-pending');
    expect(result).toEqual({ paymentId: 'payment-pending', status: 'PENDING' });
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(prisma.transaction.updateMany).not.toHaveBeenCalled();
    expect(prisma.checkoutSession.update).not.toHaveBeenCalled();
    expect(webhooks.forwardToUrl).not.toHaveBeenCalled();
  });

  it('does not expose another merchant\'s payment during status queries', async () => {
    prisma.payment.findFirst.mockResolvedValue(null);
    await expect(service.queryPayment('merchant-2', 'user-2', 'payment-1')).rejects.toThrow('Payment not found');
    expect(prisma.payment.findFirst).toHaveBeenCalledWith({ where: { id: 'payment-1', merchantId: 'merchant-2' } });
    expect(mpesaVerification.queryStkStatus).not.toHaveBeenCalled();
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it('does not roll back payment settlement when webhook forwarding fails', async () => {
    const payment = { id: 'payment-webhook-failure', merchantId: 'merchant-1', provider: 'MPESA', environment: 'SANDBOX', amountCents: 2500, currency: 'KES', status: 'PENDING', checkoutSessionId: 'session-webhook-failure' } as any;
    prisma.checkoutSession.update.mockResolvedValue({ id: 'session-webhook-failure' });
    webhooks.forwardToUrl.mockRejectedValue(new Error('Webhook delivery failed'));
    await expect((service as any).settlePendingPayment('merchant-1', 'user-1', payment, 'SUCCEEDED', undefined, 'corr-webhook-failure')).rejects.toThrow('Webhook delivery failed');
    expect(prisma.payment.update).toHaveBeenCalledWith({ where: { id: 'payment-webhook-failure' }, data: { status: 'SUCCEEDED' } });
    expect(prisma.transaction.updateMany).toHaveBeenCalledWith({ where: { paymentId: 'payment-webhook-failure' }, data: { status: 'SUCCEEDED' } });
    expect(prisma.checkoutSession.update).toHaveBeenCalledWith({ where: { id: 'session-webhook-failure' }, data: { status: 'SUCCEEDED' } });
  });
});
