import { BadRequestException, Inject, Injectable, Optional } from '@nestjs/common';
import { Environment, Provider } from '@prisma/client';
import { ProviderAdapter, PROVIDER_ADAPTERS, ProviderDefinition } from './adapters/provider-adapter';

@Injectable()
export class ProviderRegistry {
  private readonly adapters: ReadonlyMap<Provider, ProviderAdapter>;
  private readonly definitions: ReadonlyMap<Provider, ProviderDefinition>;

  constructor(
    @Optional() @Inject(PROVIDER_ADAPTERS) adapters: ProviderAdapter[] = [],
  ) {
    const adapterMap = new Map<Provider, ProviderAdapter>();
    const definitionMap = new Map<Provider, ProviderDefinition>();

    for (const adapter of adapters) {
      if (adapterMap.has(adapter.provider)) {
        throw new Error('Duplicate provider adapter registered: ' + adapter.provider);
      }
      if (adapter.definition.provider !== adapter.provider) {
        throw new Error('Provider adapter definition mismatch: ' + adapter.provider);
      }
      adapterMap.set(adapter.provider, adapter);
      definitionMap.set(adapter.provider, adapter.definition);
    }

    this.adapters = adapterMap;
    this.definitions = definitionMap;
  }

  get(provider: Provider): ProviderDefinition {
    const definition = this.definitions.get(provider);
    if (!definition) throw new BadRequestException('Unsupported payment provider: ' + provider);
    return definition;
  }

  getAdapter(provider: Provider): ProviderAdapter {
    this.get(provider);
    const adapter = this.adapters.get(provider);
    if (!adapter) throw new BadRequestException('No adapter registered for provider: ' + provider);
    return adapter;
  }

  supportsEnvironment(provider: Provider, environment: Environment): boolean {
    const definition = this.get(provider);
    return environment === 'LIVE' ? definition.supportsLivePayments : definition.supportsSandboxPayments;
  }

  assertPaymentSupported(provider: Provider, environment: Environment): void {
    const definition = this.get(provider);
    if (!this.supportsEnvironment(provider, environment)) {
      const mode = environment === 'LIVE' ? 'live' : 'sandbox';
      throw new BadRequestException(
        definition.displayName + ' ' + mode + ' payments are not enabled by PayHarness.',
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
