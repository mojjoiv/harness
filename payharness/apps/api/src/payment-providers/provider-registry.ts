import { BadRequestException, Inject, Injectable, Optional } from '@nestjs/common';
import { Environment, Provider } from '@prisma/client';
import {
  ProviderAdapter,
  PROVIDER_ADAPTERS,
  ProviderDefinition,
} from './adapters/provider-adapter';

const PROVIDER_DEFINITIONS: readonly ProviderDefinition[] = [
  {
    provider: 'MPESA',
    displayName: 'M-Pesa',
    supportsLivePayments: true,
    supportsSandboxPayments: true,
    supportsRefunds: false,
    supportsQuery: true,
  },
  {
    provider: 'STRIPE',
    displayName: 'Stripe',
    supportsLivePayments: true,
    supportsSandboxPayments: true,
    supportsRefunds: true,
    supportsQuery: true,
  },
  {
    provider: 'PAYPAL',
    displayName: 'PayPal',
    supportsLivePayments: false,
    supportsSandboxPayments: true,
    supportsRefunds: true,
    supportsQuery: true,
  },
  {
    provider: 'PESAPAL',
    displayName: 'Pesapal',
    supportsLivePayments: true,
    supportsSandboxPayments: true,
    supportsRefunds: false,
    supportsQuery: true,
  },
  {
    provider: 'FLUTTERWAVE',
    displayName: 'Flutterwave',
    supportsLivePayments: true,
    supportsSandboxPayments: true,
    supportsRefunds: false,
    supportsQuery: true,
  },
];

@Injectable()
export class ProviderRegistry {
  private readonly adapters: ReadonlyMap<Provider, ProviderAdapter>;
  private readonly definitions: ReadonlyMap<Provider, ProviderDefinition>;

  constructor(
    @Optional() @Inject(PROVIDER_ADAPTERS) adapters: ProviderAdapter[] = [],
  ) {
    const adapterMap = new Map<Provider, ProviderAdapter>();
    const definitionMap = new Map<Provider, ProviderDefinition>(
      PROVIDER_DEFINITIONS.map((definition) => [
        definition.provider,
        definition,
      ]),
    );

    for (const adapter of adapters) {
      if (adapterMap.has(adapter.provider)) {
        throw new Error(
          'Duplicate provider adapter registered: ' + adapter.provider,
        );
      }

      const definition = definitionMap.get(adapter.provider);
      if (!definition) {
        throw new Error(
          'No provider definition registered for: ' + adapter.provider,
        );
      }

      if (adapter.definition.provider !== adapter.provider) {
        throw new Error(
          'Provider adapter definition mismatch: ' + adapter.provider,
        );
      }

      adapterMap.set(adapter.provider, adapter);
    }

    this.adapters = adapterMap;
    this.definitions = definitionMap;
  }

  get(provider: Provider): ProviderDefinition {
    const definition = this.definitions.get(provider);
    if (!definition) {
      throw new BadRequestException(
        'Unsupported payment provider: ' + provider,
      );
    }
    return definition;
  }

  getAdapter(provider: Provider): ProviderAdapter {
    this.get(provider);

    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new BadRequestException(
        'No adapter registered for provider: ' + provider,
      );
    }

    return adapter;
  }

  supportsEnvironment(provider: Provider, environment: Environment): boolean {
    const definition = this.get(provider);
    return environment === 'LIVE'
      ? definition.supportsLivePayments
      : definition.supportsSandboxPayments;
  }

  assertPaymentSupported(provider: Provider, environment: Environment): void {
    const definition = this.get(provider);
    if (!this.supportsEnvironment(provider, environment)) {
      const mode = environment === 'LIVE' ? 'live' : 'sandbox';
      throw new BadRequestException(
        definition.displayName +
          ' ' +
          mode +
          ' payments are not enabled by PayHarness.',
      );
    }
  }

  supportsRefunds(provider: Provider): boolean {
    return this.get(provider).supportsRefunds;
  }

  supportsQuery(provider: Provider): boolean {
    return this.get(provider).supportsQuery;
  }

  list(): ProviderDefinition[] {
    return Array.from(this.definitions.values());
  }
}
