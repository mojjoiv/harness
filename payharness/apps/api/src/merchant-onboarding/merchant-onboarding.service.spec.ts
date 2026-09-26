import { MerchantOnboardingService } from './merchant-onboarding.service';

describe('MerchantOnboardingService', () => {
  const prisma = {
    merchant: {
      findUnique: jest.fn(),
    },
  };

  const service = new MerchantOnboardingService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds a merchant-scoped checklist and sandbox readiness state', async () => {
    prisma.merchant.findUnique.mockResolvedValue({
      id: 'merchant-1',
      name: 'Acme',
      status: 'ACTIVE',
      profile: {
        businessName: 'Acme',
        legalName: 'Acme Ltd',
        country: 'KE',
        supportEmail: 'support@acme.test',
      },
      apiKeys: [{ id: 'key-1', environment: 'SANDBOX' }],
      providerCredentials: [{
        id: 'provider-1',
        provider: 'MPESA',
        environment: 'SANDBOX',
        verificationStatus: 'VERIFIED',
        accountVerified: true,
        environmentVerified: true,
      }],
      webhookEndpoints: [{ id: 'webhook-1' }],
      settings: {
        successUrl: 'https://acme.test/success',
        cancelUrl: 'https://acme.test/cancel',
      },
    });

    const result = await service.get('merchant-1');

    expect(prisma.merchant.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'merchant-1' } }),
    );
    expect(result.readyForSandbox).toBe(true);
    expect(result.progress.percentage).toBe(100);
    expect(result.steps).toHaveLength(8);
    expect(result.steps.every((step) => step.complete || !step.required)).toBe(true);
  });

  it('does not use another merchant to satisfy the checklist', async () => {
    prisma.merchant.findUnique.mockResolvedValue({
      id: 'merchant-2',
      name: 'Other',
      status: 'ACTIVE',
      profile: null,
      apiKeys: [],
      providerCredentials: [],
      webhookEndpoints: [],
      settings: null,
    });

    const result = await service.get('merchant-1');

    expect(prisma.merchant.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'merchant-1' } }),
    );
    expect(result.readyForSandbox).toBe(false);
    expect(result.steps.find((step) => step.id === 'profile')?.complete).toBe(false);
    expect(result.steps.find((step) => step.id === 'sandbox-key')?.complete).toBe(false);
  });

  it('requires an active verified live provider and live key for live readiness', async () => {
    prisma.merchant.findUnique.mockResolvedValue({
      id: 'merchant-1',
      name: 'Acme',
      status: 'ACTIVE',
      profile: {
        businessName: 'Acme',
        legalName: 'Acme Ltd',
        country: 'KE',
        supportEmail: 'support@acme.test',
      },
      apiKeys: [
        { id: 'sandbox-key', environment: 'SANDBOX' },
        { id: 'live-key', environment: 'LIVE' },
      ],
      providerCredentials: [
        {
          id: 'sandbox-provider',
          provider: 'MPESA',
          environment: 'SANDBOX',
          verificationStatus: 'VERIFIED',
          accountVerified: true,
          environmentVerified: true,
        },
      ],
      webhookEndpoints: [{ id: 'webhook-1' }],
      settings: {
        successUrl: 'https://acme.test/success',
        cancelUrl: 'https://acme.test/cancel',
      },
    });

    const result = await service.get('merchant-1');

    expect(result.readyForLive).toBe(false);
    expect(result.steps.find((step) => step.id === 'live-provider')?.complete).toBe(false);
  });
});
