import { BadRequestException, Injectable } from '@nestjs/common';
import { Environment, Provider } from '@prisma/client';

export interface ProviderDefinition {
  provider: Provider;
  displayName: string;
  supportsLivePayments: boolean;
  supportsSandboxPayments: boolean;
  supportsRefunds: boolean;
  supportsQuery: boolean;
}

const PROVIDER_DEFINITIONS: Readonly<Record<Provider, ProviderDefinition>> = {
  MPESA: { provider: 'MPESA', displayName: 'M-Pesa', supportsLivePayments: true, supportsSandboxPayments: true, supportsRefunds: false, supportsQuery: true },
  STRIPE: { provider: 'STRIPE', displayName: 'Stripe', supportsLivePayments: true, supportsSandboxPayments: true, supportsRefunds: true, supportsQuery: true },
  PAYPAL: { provider: 'PAYPAL', displayName: 'PayPal', supportsLivePayments: false, supportsSandboxPayments: true, supportsRefunds: true, supportsQuery: true },
  PESAPAL: { provider: 'PESAPAL', displayName: 'Pesapal', supportsLivePayments: true, supportsSandboxPayments: true, supportsRefunds: false, supportsQuery: true },
};

@Injectable()
export class ProviderRegistry {
  get(provider: Provider): ProviderDefinition {
    const definition = PROVIDER_DEFINITIONS[provider];
    if (!definition) throw new BadRequestException(`Unsupported payment provider: ${provider}`);
    return definition;
  }

  supportsEnvironment(provider: Provider, environment: Environment): boolean {
    const definition = this.get(provider);
    return environment === 'LIVE' ? definition.supportsLivePayments : definition.supportsSandboxPayments;
  }

  assertPaymentSupported(provider: Provider, environment: Environment): void {
    const definition = this.get(provider);
    if (!this.supportsEnvironment(provider, environment)) {
      const mode = environment === 'LIVE' ? 'live' : 'sandbox';
      throw new BadRequestException(`${definition.displayName} ${mode} payments are not enabled by PayHarness.`);
    }
  }

  supportsRefunds(provider: Provider): boolean { return this.get(provider).supportsRefunds; }
  supportsQuery(provider: Provider): boolean { return this.get(provider).supportsQuery; }
  list(): ProviderDefinition[] { return Object.values(PROVIDER_DEFINITIONS); }
}