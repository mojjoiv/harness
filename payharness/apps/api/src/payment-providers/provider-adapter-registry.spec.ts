import { Provider } from '@prisma/client';
import { ProviderAdapter } from './adapters/provider-adapter';
import { ProviderRegistry } from './provider-registry';

describe('ProviderRegistry adapter routing', () => {
  const adapter = (provider: Provider): ProviderAdapter => ({
    provider,
    definition: {
      provider,
      displayName: provider,
      supportsLivePayments: true,
      supportsSandboxPayments: true,
      supportsRefunds: false,
      supportsQuery: true,
    },
    createPayment: jest.fn(),
    queryPayment: jest.fn(),
  });

  it('routes every supported provider to exactly one adapter', () => {
    const mpesa = adapter('MPESA');
    const stripe = adapter('STRIPE');
    const paypal = adapter('PAYPAL');
    const pesapal = adapter('PESAPAL');
    const registry = new ProviderRegistry([
      mpesa,
      stripe,
      paypal,
      pesapal,
    ]);

    expect(registry.getAdapter('MPESA')).toBe(mpesa);
    expect(registry.getAdapter('STRIPE')).toBe(stripe);
    expect(registry.getAdapter('PAYPAL')).toBe(paypal);
    expect(registry.getAdapter('PESAPAL')).toBe(pesapal);
  });

  it('fails closed when an adapter is not registered', () => {
    const registry = new ProviderRegistry();
    expect(() => registry.getAdapter('STRIPE')).toThrow(
      'No adapter registered for provider: STRIPE',
    );
  });
});
