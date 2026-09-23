import { CheckoutSessionsService } from './checkout-sessions.service';

describe('CheckoutSessionsService hosted checkout', () => {
  const branding = {
    merchantName: 'Test Merchant',
    logoUrl: null,
    faviconUrl: null,
    primaryColor: '#2563eb',
    secondaryColor: '#0f172a',
    buttonColor: '#2563eb',
    successPageMessage: null,
    cancelPageMessage: null,
    receiptFooter: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const buildService = (providers: Array<'MPESA' | 'STRIPE' | 'PAYPAL'>) => {
    const prisma = {
      checkoutSession: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'session-1',
          merchantId: 'merchant-1',
          amountCents: 50000,
          currency: 'KES',
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 60_000),
          allowedProviders: ['MPESA', 'STRIPE', 'PAYPAL'],
          metadata: { _payharnessEnvironment: 'SANDBOX' },
          customer: null,
        }),
      },
      merchant: {
        findUnique: jest.fn().mockResolvedValue({ id: 'merchant-1', profile: { country: null } }),
      },
      providerCredential: {
        findMany: jest.fn().mockResolvedValue(
          providers.map((provider, index) => ({
            id: `credential-${index}`,
            provider,
            environment: 'SANDBOX',
            status: 'ACTIVE',
            isDefault: index === 0,
            lastVerifiedAt: new Date(),
            updatedAt: new Date(),
            publicConfig:
              provider === 'STRIPE'
                ? { publishableKey: 'pk_test_example' }
                : provider === 'PAYPAL'
                  ? { clientId: 'paypal-client-id' }
                  : {},
            verificationStatus: 'PENDING',
            oauthVerified: false,
            accountVerified: false,
            environmentVerified: false,
          })),
        ),
      },
      platformGatewayConfig: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      providerCountryAvailability: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      merchantSubscription: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const config = { get: jest.fn((key: string) => key === 'NODE_ENV' ? 'test' : 'https://checkout.example.com') };
    const auditLogs = { create: jest.fn() };
    const brandingService = { get: jest.fn().mockResolvedValue(branding) };
    return new CheckoutSessionsService(
      prisma as any,
      config as any,
      auditLogs as any,
      brandingService as any,
      {
        queryPayment: jest.fn().mockResolvedValue({
          status: 'SUCCEEDED',
        }),
      } as any,
    );
  };

  it('shows only the configured provider when one is configured', async () => {
    const service = buildService(['PAYPAL']);
    const result = await service.getPublic('session-1');
    expect(result.availableProviders.map((item) => item.provider)).toEqual(['PAYPAL']);
  });

  it('shows all configured providers when all are configured', async () => {
    const service = buildService(['MPESA', 'STRIPE', 'PAYPAL']);
    const result = await service.getPublic('session-1');
    expect(result.availableProviders.map((item) => item.provider)).toEqual(['MPESA', 'STRIPE', 'PAYPAL']);
  });
});
