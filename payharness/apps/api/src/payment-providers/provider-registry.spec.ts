import { BadRequestException } from '@nestjs/common';
import { ProviderRegistry } from './provider-registry';
import type { ProviderAdapter } from './adapters/provider-adapter';

describe('ProviderRegistry', () => {
  const adapters: ProviderAdapter[] = [
    {
      provider: 'MPESA',
      definition: {
        provider: 'MPESA',
        displayName: 'M-Pesa',
        supportsLivePayments: true,
        supportsSandboxPayments: true,
        supportsRefunds: false,
        supportsQuery: true,
      },
      createPayment: jest.fn(),
      queryPayment: jest.fn(),
    },
    {
      provider: 'STRIPE',
      definition: {
        provider: 'STRIPE',
        displayName: 'Stripe',
        supportsLivePayments: true,
        supportsSandboxPayments: true,
        supportsRefunds: true,
        supportsQuery: true,
      },
      createPayment: jest.fn(),
      queryPayment: jest.fn(),
    },
    {
      provider: 'PAYPAL',
      definition: {
        provider: 'PAYPAL',
        displayName: 'PayPal',
        supportsLivePayments: false,
        supportsSandboxPayments: true,
        supportsRefunds: true,
        supportsQuery: true,
      },
      createPayment: jest.fn(),
      queryPayment: jest.fn(),
    },
    {
      provider: 'PESAPAL',
      definition: {
        provider: 'PESAPAL',
        displayName: 'Pesapal',
        supportsLivePayments: true,
        supportsSandboxPayments: true,
        supportsRefunds: false,
        supportsQuery: true,
      },
      createPayment: jest.fn(),
      queryPayment: jest.fn(),
    },
    {
      provider: 'FLUTTERWAVE',
      definition: {
        provider: 'FLUTTERWAVE',
        displayName: 'Flutterwave',
        supportsLivePayments: true,
        supportsSandboxPayments: true,
        supportsRefunds: false,
        supportsQuery: true,
      },
      createPayment: jest.fn(),
      queryPayment: jest.fn(),
    },
  ];
  const registry = new ProviderRegistry(adapters);

  it('defines every persisted provider exactly once', () => {
    expect(registry.list().map((item) => item.provider).sort()).toEqual(['FLUTTERWAVE', 'MPESA', 'PAYPAL', 'PESAPAL', 'STRIPE']);
  });

  it('resolves the registered adapter for each provider', () => {
    const adapterRegistry = new ProviderRegistry(adapters);

    for (const adapter of adapters) {
      expect(adapterRegistry.getAdapter(adapter.provider)).toBe(adapter);
    }
  });

  it('fails closed when a provider has no adapter', () => {
    const registryWithoutAdapters = new ProviderRegistry();

    expect(() => registryWithoutAdapters.getAdapter('MPESA')).toThrow(
      'No adapter registered for provider: MPESA',
    );
  });

  it('allows supported environments', () => {
    expect(registry.supportsEnvironment('MPESA', 'SANDBOX')).toBe(true);
    expect(registry.supportsEnvironment('STRIPE', 'LIVE')).toBe(true);
    expect(registry.supportsEnvironment('PESAPAL', 'LIVE')).toBe(true);
    expect(registry.supportsEnvironment('PAYPAL', 'SANDBOX')).toBe(true);
    expect(registry.supportsEnvironment('FLUTTERWAVE', 'LIVE')).toBe(true);
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
    expect(registry.supportsRefunds('FLUTTERWAVE')).toBe(false);
  });

  it('fails closed for an unknown provider', () => {
    expect(() => registry.get('UNKNOWN' as never)).toThrow('Unsupported payment provider: UNKNOWN');
  });
});