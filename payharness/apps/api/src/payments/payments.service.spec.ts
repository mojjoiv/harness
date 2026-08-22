import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  const prisma = {
    payment: {
      findFirst: jest.fn(),
    },
  } as any;

  const config = {
    get: jest.fn(),
  } as any;

  const crypto = {
    decrypt: jest.fn(),
  } as any;

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
  });

  it('blocks LIVE M-Pesa STK requests before loading credentials', async () => {
    await expect(
      service.createMpesaStk('merchant-1', 'user-1', {
        environment: 'LIVE',
        amountCents: 1000,
        phoneNumber: '254700000000',
      } as any),
    ).rejects.toThrow();

    expect(prisma.payment.findFirst).not.toHaveBeenCalled();
  });

  it('uses the simulated path when no phone number is supplied', async () => {
    mpesa.createStkPush.mockResolvedValue({ checkoutRequestId: 'simulated' });

    const processSpy = jest.spyOn(service as any, 'process').mockResolvedValue({ status: 'PENDING' });

    await service.createMpesaStk('merchant-1', undefined, {
      environment: 'SANDBOX',
      amountCents: 1000,
    } as any);

    expect(processSpy).toHaveBeenCalled();
  });
});
