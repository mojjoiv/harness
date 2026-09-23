import { FlutterwavePaymentAdapter } from './flutterwave-payment.adapter';

describe('FlutterwavePaymentAdapter', () => {
  const flutterwave = {
    createPayment: jest.fn(),
    queryPayment: jest.fn(),
  };
  const adapter = new FlutterwavePaymentAdapter(flutterwave as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('declares live and sandbox checkout support without refunds', () => {
    expect(adapter.definition).toEqual({
      provider: 'FLUTTERWAVE',
      displayName: 'Flutterwave',
      supportsLivePayments: true,
      supportsSandboxPayments: true,
      supportsRefunds: false,
      supportsQuery: true,
    });
  });

  it('creates a hosted checkout through the provider service', async () => {
    flutterwave.createPayment.mockResolvedValue({
      txRef: 'ph_123',
      link: 'https://checkout.flutterwave.com/v3/hosted/pay/test',
    });

    await expect(
      adapter.createPayment({
        environment: 'SANDBOX',
        credentials: { secretKey: 'test-secret' },
        amountCents: 2500,
        currency: 'KES',
        txRef: 'ph_123',
        redirectUrl: 'https://merchant.example/success',
        customer: {
          email: 'customer@example.com',
          name: 'Customer',
          phone: '254700000000',
        },
      }),
    ).resolves.toEqual({
      providerReference: 'ph_123',
      providerStatus: 'PENDING',
      approvalUrl: 'https://checkout.flutterwave.com/v3/hosted/pay/test',
    });

    expect(flutterwave.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        secretKey: 'test-secret',
        amountCents: 2500,
        currency: 'KES',
        txRef: 'ph_123',
      }),
    );
  });

  it('normalizes successful and failed transaction statuses', async () => {
    flutterwave.queryPayment
      .mockResolvedValueOnce({
        txRef: 'ph_123',
        status: 'successful',
        amount: 25,
        currency: 'KES',
        paymentType: 'mpesa',
      })
      .mockResolvedValueOnce({
        txRef: 'ph_123',
        status: 'failed',
      });

    await expect(
      adapter.queryPayment({
        environment: 'SANDBOX',
        credentials: { secretKey: 'test-secret' },
        providerReference: 'ph_123',
        from: '2026-09-23',
        to: '2026-09-23',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        providerReference: 'ph_123',
        providerStatus: 'successful',
        status: 'SUCCEEDED',
      }),
    );

    await expect(
      adapter.queryPayment({
        environment: 'SANDBOX',
        credentials: { secretKey: 'test-secret' },
        providerReference: 'ph_123',
        from: '2026-09-23',
        to: '2026-09-23',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        providerReference: 'ph_123',
        providerStatus: 'failed',
        status: 'FAILED',
      }),
    );
  });
});
