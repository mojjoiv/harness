import { Environment, Provider } from '@prisma/client';
import { MpesaPayoutProvider } from './mpesa-payout.provider';
import { PayoutProviderExecutionError } from './payout-provider.interface';

const input = {
  payoutId: 'payout-1',
  merchantId: 'merchant-1',
  amountCents: 5000,
  currency: 'KES',
  provider: Provider.MPESA,
  environment: Environment.SANDBOX,
  recipientType: 'mobile_money',
  recipientPhone: '0712345678',
  recipientName: 'Test Recipient',
  metadata: {},
};

const credential = {
  publicConfig: { shortcode: '600000' },
  encryptedSecretConfig: { iv: 'iv', tag: 'tag', data: 'data' },
};

describe('MpesaPayoutProvider', () => {
  const prisma = {
    providerCredential: {
      findFirst: jest.fn(),
    },
  };
  const crypto = {
    decrypt: jest.fn(),
  };
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'APP_URL') return 'https://api.example.com';
      return undefined;
    }),
  };

  let provider: MpesaPayoutProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.providerCredential.findFirst.mockResolvedValue(credential);
    crypto.decrypt.mockReturnValue({
      consumerKey: 'consumer-key',
      consumerSecret: 'consumer-secret',
      initiatorName: 'test-initiator',
      securityCredential: 'encrypted-security-credential',
    });
    provider = new MpesaPayoutProvider(prisma as never, crypto as never, config as never);
  });

  it('submits a B2C payout and extracts the provider reference', async () => {
    jest.spyOn(provider as never, 'generateAccessToken').mockResolvedValue('access-token');
    jest
      .spyOn(provider as never, 'request')
      .mockResolvedValue({ ResponseCode: '0', ConversationID: 'AG_123456' });

    await expect(provider.execute(input)).resolves.toEqual({
      providerReference: 'AG_123456',
    });

    expect((provider as any).request).toHaveBeenCalledWith(
      Environment.SANDBOX,
      '/mpesa/b2c/v1/paymentrequest',
      'access-token',
      expect.objectContaining({
        InitiatorName: 'test-initiator',
        SecurityCredential: 'encrypted-security-credential',
        Amount: 50,
        PartyA: '600000',
        PartyB: '254712345678',
        ResultURL: 'https://api.example.com/webhooks/provider/MPESA/merchant-1',
        QueueTimeOutURL: 'https://api.example.com/webhooks/provider/MPESA/merchant-1',
      }),
    );
  });

  it('fails without an active M-Pesa credential', async () => {
    prisma.providerCredential.findFirst.mockResolvedValue(null);

    await expect(provider.execute(input)).rejects.toMatchObject({
      publicMessage: 'M-Pesa is not configured for this merchant and environment',
    });
  });

  it('hides M-Pesa authentication errors behind the unified payout error', async () => {
    jest
      .spyOn(provider as never, 'generateAccessToken')
      .mockRejectedValue(new Error('Safaricom invalid consumer key'));

    await expect(provider.execute(input)).rejects.toBeInstanceOf(PayoutProviderExecutionError);
    await expect(provider.execute(input)).rejects.toMatchObject({
      publicMessage: 'M-Pesa authentication failed',
    });
  });

  it('maps a provider rejection to a generic payout failure', async () => {
    jest.spyOn(provider as never, 'generateAccessToken').mockResolvedValue('access-token');
    jest.spyOn(provider as never, 'request').mockResolvedValue({
      ResponseCode: '1',
      ResponseDescription: 'Insufficient funds',
    });

    await expect(provider.execute(input)).rejects.toMatchObject({
      publicMessage: 'M-Pesa payout could not be processed',
      message: 'M-Pesa B2C rejected payout: Insufficient funds',
    });
  });

  it('maps timeout or network errors to a generic payout failure', async () => {
    jest.spyOn(provider as never, 'generateAccessToken').mockResolvedValue('access-token');
    jest.spyOn(provider as never, 'request').mockRejectedValue(new Error('socket timeout'));

    await expect(provider.execute(input)).rejects.toMatchObject({
      publicMessage: 'M-Pesa payout could not be processed',
      message: 'socket timeout',
    });
  });

  it('rejects malformed B2C responses without a provider reference', async () => {
    jest.spyOn(provider as never, 'generateAccessToken').mockResolvedValue('access-token');
    jest.spyOn(provider as never, 'request').mockResolvedValue({
      ResponseCode: '0',
      ResponseDescription: 'Accepted',
    });

    await expect(provider.execute(input)).rejects.toMatchObject({
      publicMessage: 'M-Pesa payout could not be processed',
      message: 'M-Pesa B2C response did not contain a provider reference',
    });
  });

  it('rejects non-KES payouts before contacting Safaricom', async () => {
    const request = jest.spyOn(provider as never, 'request');

    await expect(provider.execute({ ...input, currency: 'USD' })).rejects.toMatchObject({
      publicMessage: 'M-Pesa payout only supports KES',
    });
    expect(request).not.toHaveBeenCalled();
  });
});
