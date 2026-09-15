import { PaymentsService } from './payments.service';

describe('PaymentsService payment lifecycle hardening', () => {
  const prisma = {
    payment: {
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    transaction: { updateMany: jest.fn() },
    checkoutSession: { update: jest.fn() },
    merchantSettings: { findUnique: jest.fn() },
  } as any;
  const config = { get: jest.fn() } as any;
  const crypto = { decrypt: jest.fn() } as any;
  const mpesa = {} as any;
  const mpesaVerification = {} as any;
  const stripe = {} as any;
  const paypalPaymentService = {} as any;
  const auditLogs = { create: jest.fn() } as any;
  const webhooks = { forwardToUrl: jest.fn() } as any;

  let service: PaymentsService;

  beforeEach(() => {
    jest.clearAllMocks();
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
    prisma.payment.updateMany.mockResolvedValue({ count: 1 });
    prisma.transaction.updateMany.mockResolvedValue({ count: 1 });
    prisma.checkoutSession.update.mockResolvedValue({ id: 'session-1' });
    prisma.merchantSettings.findUnique.mockResolvedValue(null);
    auditLogs.create.mockResolvedValue(undefined);
    webhooks.forwardToUrl.mockResolvedValue({ delivered: true });
  });

  it('does not transition a terminal payment again', async () => {
    await (service as any).settlePendingPayment(
      'merchant-1',
      'user-1',
      {
        id: 'payment-1',
        merchantId: 'merchant-1',
        provider: 'MPESA',
        environment: 'SANDBOX',
        status: 'SUCCEEDED',
        checkoutSessionId: 'session-1',
        amountCents: 1000,
        currency: 'KES',
      },
      'FAILED',
      'late callback',
    );

    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
    expect(prisma.transaction.updateMany).not.toHaveBeenCalled();
    expect(prisma.checkoutSession.update).not.toHaveBeenCalled();
    expect(auditLogs.create).not.toHaveBeenCalled();
  });

  it('only settles a payment while it is still pending', async () => {
    await (service as any).settlePendingPayment(
      'merchant-1',
      'user-1',
      {
        id: 'payment-2',
        merchantId: 'merchant-1',
        provider: 'MPESA',
        environment: 'SANDBOX',
        status: 'PENDING',
        checkoutSessionId: 'session-2',
        amountCents: 1000,
        currency: 'KES',
      },
      'SUCCEEDED',
      'customer completed payment',
    );

    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'payment-2', status: 'PENDING' },
      data: { status: 'SUCCEEDED' },
    });
    expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
      where: { paymentId: 'payment-2' },
      data: { status: 'SUCCEEDED' },
    });
    expect(prisma.checkoutSession.update).toHaveBeenCalledWith({
      where: { id: 'session-2' },
      data: { status: 'SUCCEEDED' },
    });
  });
});
