import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  const prisma = {
    payment: {
      findFirst: jest.fn(),
    },
  } as any;

  const config = { get: jest.fn() } as any;
  const crypto = { decrypt: jest.fn() } as any;
  const mpesa = { createStkPush: jest.fn() } as any;
  const mpesaVerification = { queryStkStatus: jest.fn() } as any;
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
      publicConfig: {},
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
});
