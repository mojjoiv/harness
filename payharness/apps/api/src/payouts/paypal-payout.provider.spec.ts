import { Environment, Provider } from '@prisma/client';
import { PaypalPayoutProvider } from './paypal-payout.provider';

const input = {
  payoutId: 'payout-1',
  merchantId: 'merchant-1',
  amountCents: 5000,
  currency: 'USD',
  provider: Provider.PAYPAL,
  environment: Environment.SANDBOX,
  recipientType: 'EMAIL',
  recipientPhone: 'recipient@example.com',
  recipientName: 'Test Recipient',
  metadata: {},
};

const credential = {
  publicConfig: { clientId: 'client-id' },
  encryptedSecretConfig: { iv: 'iv', tag: 'tag', data: 'data' },
};

describe('PaypalPayoutProvider', () => {
  const prisma = {
    providerCredential: {
      findFirst: jest.fn(),
    },
  };
  const crypto = {
    decrypt: jest.fn(),
  };
  const paypal = {
    createPayout: jest.fn(),
  };

  let provider: PaypalPayoutProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.providerCredential.findFirst.mockResolvedValue(credential);
    crypto.decrypt.mockReturnValue({ clientSecret: 'client-secret' });
    paypal.createPayout.mockResolvedValue({
      providerReference: 'PAYPAL-BATCH-123',
      providerStatus: 'PENDING',
    });
    provider = new PaypalPayoutProvider(
      prisma as never,
      crypto as never,
      paypal as never,
    );
  });

  it('submits a PayPal payout using merchant credentials', async () => {
    await expect(provider.execute(input)).resolves.toEqual({
      providerReference: 'PAYPAL-BATCH-123',
    });

    expect(prisma.providerCredential.findFirst).toHaveBeenCalledWith({
      where: {
        merchantId: 'merchant-1',
        provider: Provider.PAYPAL,
        environment: Environment.SANDBOX,
        status: 'ACTIVE',
      },
    });
    expect(paypal.createPayout).toHaveBeenCalledWith({
      credentials: {
        clientId: 'client-id',
        clientSecret: 'client-secret',
      },
      environment: Environment.SANDBOX,
      payoutId: 'payout-1',
      amountCents: 5000,
      currency: 'USD',
      recipientType: 'EMAIL',
      recipient: 'recipient@example.com',
      note: 'PayHarness payout payout-1',
    });
  });

  it('supports a PayPal recipient supplied in metadata', async () => {
    await provider.execute({
      ...input,
      recipientPhone: null,
      metadata: { paypalRecipient: 'paypal@example.com', note: 'Vendor payout' },
    });

    expect(paypal.createPayout).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: 'paypal@example.com',
        note: 'Vendor payout',
      }),
    );
  });

  it('fails without an active PayPal credential', async () => {
    prisma.providerCredential.findFirst.mockResolvedValue(null);

    await expect(provider.execute(input)).rejects.toThrow(
      'No active PAYPAL credential for SANDBOX',
    );
    expect(paypal.createPayout).not.toHaveBeenCalled();
  });

  it('fails when PayPal credentials are incomplete', async () => {
    crypto.decrypt.mockReturnValue({});

    await expect(provider.execute(input)).rejects.toThrow(
      'PayPal client ID and client secret are required',
    );
    expect(paypal.createPayout).not.toHaveBeenCalled();
  });

  it('requires a recipient', async () => {
    await expect(
      provider.execute({ ...input, recipientPhone: null, metadata: {} }),
    ).rejects.toThrow(
      'PayPal payout recipient is required in recipientPhone or metadata.paypalRecipient',
    );
    expect(paypal.createPayout).not.toHaveBeenCalled();
  });
});
