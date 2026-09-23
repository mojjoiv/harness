import { BadRequestException } from '@nestjs/common';
import { ProviderRegistry } from './provider-registry';
import type { ProviderAdapter } from './adapters/provider-adapter';
import { MpesaPaymentAdapter } from './adapters/mpesa-payment.adapter';
import { StripePaymentAdapter } from './adapters/stripe-payment.adapter';
import { PaypalPaymentAdapter } from './adapters/paypal-payment.adapter';
import { PesapalPaymentAdapter } from './adapters/pesapal-payment.adapter';

describe('ProviderRegistry', () => {
  const registry = new ProviderRegistry();

  it('defines every persisted provider exactly once', () => {
    expect(registry.list().map((item) => item.provider).sort()).toEqual(['MPESA', 'PAYPAL', 'PESAPAL', 'STRIPE']);
  });

  it('resolves the registered adapter for each provider', () => {
    const adapters = (['MPESA', 'STRIPE', 'PAYPAL', 'PESAPAL'] as const).map(
      (provider) =>
        ({
          provider,
          createPayment: jest.fn(),
          queryPayment: jest.fn(),
        }) as unknown as ProviderAdapter,
    );
    const adapterRegistry = new ProviderRegistry(
      adapters[0] as unknown as MpesaPaymentAdapter,
      adapters[1] as unknown as StripePaymentAdapter,
      adapters[2] as unknown as PaypalPaymentAdapter,
      adapters[3] as unknown as PesapalPaymentAdapter,
    );

    for (const adapter of adapters) {
      expect(adapterRegistry.getAdapter(adapter.provider)).toBe(adapter);
    }
  });

  it('fails closed when a provider has no adapter', () => {
    expect(() => registry.getAdapter('MPESA')).toThrow(
      'No adapter registered for provider: MPESA',
    );
  });

  it('allows supported environments', () => {
    expect(registry.supportsEnvironment('MPESA', 'SANDBOX')).toBe(true);
    expect(registry.supportsEnvironment('STRIPE', 'LIVE')).toBe(true);
    expect(registry.supportsEnvironment('PESAPAL', 'LIVE')).toBe(true);
    expect(registry.supportsEnvironment('PAYPAL', 'SANDBOX')).toBe(true);
  });

  it('blocks providers intentionally sandbox-only', () => {
    expect(registry.supportsEnvironment('PAYPAL', 'LIVE')).toBe(false);
    expect(() => registry.assertPaymentSupported('PAYPAL', 'LIVE')).toThrow(BadRequestException);
  });

  it('does not claim unsupported refunds', () => {
    expect(registry.supportsRefunds('STRIPE')).toBe(true);
    expect(registry.supportsRefunds('PAYPAL')).toBe(true);
    expect(registry.supportsRefunds('MPESA')).toBe(false);
    expect(registry.supportsRefunds('PESAPAL')).toBe(false);
  });

  it('fails closed for an unknown provider', () => {
    expect(() => registry.get('UNKNOWN' as never)).toThrow('Unsupported payment provider: UNKNOWN');
  });
});