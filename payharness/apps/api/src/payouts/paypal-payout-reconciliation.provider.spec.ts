import { Environment, Provider } from '@prisma/client';
import { PaypalPayoutReconciliationProvider } from './paypal-payout-reconciliation.provider';

const input = {
  payoutId: 'payout-1',
  merchantId: 'merchant-1',
  amountCents: 5000,
  currency: 'USD',
  provider: Provider.PAYPAL,
  environment: Environment.SANDBOX,
  recipientType: 'EMAIL',
  recipientPhone: 'recipient@example.com',
  recipientName: null,
  metadata: {},
  providerReference: 'PAYPAL-BATCH-123',
};

const credential = {
  publicConfig: { clientId: 'client-id' },
  encryptedSecretConfig: { iv: 'iv', tag: 'tag', data: 'data' },
};

describe('PaypalPayoutReconciliationProvider', () => {
  const prisma = {
    providerCredential: {
      findFirst: jest.fn(),
    },
  };
  const crypto = {
    decrypt: jest.fn(),
  };
  const paypal = {
    getPayout: jest.fn(),
  };

  let provider: PaypalPayoutReconciliationProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.providerCredential.findFirst.mockResolvedValue(credential);
    crypto.decrypt.mockReturnValue({ clientSecret: 'client-secret' });
    paypal.getPayout.mockResolvedValue({
      batch_header: { payout_batch_id: 'PAYPAL-BATCH-123', batch_status: 'SUCCESS' },
    });
    provider = new PaypalPayoutReconciliationProvider(
      prisma as never,
      crypto as never,
      paypal as never,
    );
  });

  it('maps a successful PayPal batch to SUCCEEDED', async () => {
    await expect(provider.reconcile(input)).resolves.toEqual({
      status: 'SUCCEEDED',
      providerStatus: 'SUCCESS',
    });
  });

  it('maps denied and canceled PayPal batches to FAILED', async () => {
    for (const providerStatus of ['DENIED', 'CANCELED']) {
      paypal.getPayout.mockResolvedValueOnce({
        batch_header: { batch_status: providerStatus },
      });

      await expect(provider.reconcile(input)).resolves.toEqual({
        status: 'FAILED',
        providerStatus,
      });
    }
  });

  it('keeps pending and processing PayPal batches unresolved', async () => {
    for (const providerStatus of ['PENDING', 'PROCESSING']) {
      paypal.getPayout.mockResolvedValueOnce({
        batch_header: { batch_status: providerStatus },
      });

      await expect(provider.reconcile(input)).resolves.toEqual({
        status: 'UNKNOWN',
        providerStatus,
      });
    }
  });

  it('does not call PayPal when the provider reference is missing', async () => {
    await expect(
      provider.reconcile({ ...input, providerReference: null }),
    ).resolves.toEqual({
      status: 'UNKNOWN',
      details: { reason: 'PayPal payout batch ID is missing' },
    });
    expect(paypal.getPayout).not.toHaveBeenCalled();
  });
});
