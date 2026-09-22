import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { Environment, Provider } from '@prisma/client';
import { ProviderAdapter } from './adapters/provider-adapter';
import { MpesaPaymentAdapter } from './adapters/mpesa-payment.adapter';
import { StripePaymentAdapter } from './adapters/stripe-payment.adapter';
import { PaypalPaymentAdapter } from './adapters/paypal-payment.adapter';
import { PesapalPaymentAdapter } from './adapters/pesapal-payment.adapter';

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
  private readonly adapters: ReadonlyMap<Provider, ProviderAdapter>;

  constructor(
    @Optional() mpesaAdapter?: MpesaPaymentAdapter,
    @Optional() stripeAdapter?: StripePaymentAdapter,
    @Optional() paypalAdapter?: PaypalPaymentAdapter,
    @Optional() pesapalAdapter?: PesapalPaymentAdapter,
  ) {
    const adapters = new Map<Provider, ProviderAdapter>();
    if (mpesaAdapter) adapters.set('MPESA', mpesaAdapter);
    if (stripeAdapter) adapters.set('STRIPE', stripeAdapter);
    if (paypalAdapter) adapters.set('PAYPAL', paypalAdapter);
    if (pesapalAdapter) adapters.set('PESAPAL', pesapalAdapter);
    this.adapters = adapters;
  }

  get(provider: Provider): ProviderDefinition {
    const definition = PROVIDER_DEFINITIONS[provider];
    if (!definition) throw new BadRequestException(`Unsupported payment provider: ${provider}`);
    return definition;
  }

  getAdapter(provider: Provider): ProviderAdapter {
    this.get(provider);
    const adapter = this.adapters.get(provider);
    if (!adapter) throw new BadRequestException(`No adapter registered for provider: ${provider}`);
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
      throw new BadRequestException(`${definition.displayName} ${mode} payments are not enabled by PayHarness.`);
    }
  }

  supportsRefunds(provider: Provider): boolean { return this.get(provider).supportsRefunds; }
  supportsQuery(provider: Provider): boolean { return this.get(provider).supportsQuery; }
  list(): ProviderDefinition[] { return Object.values(PROVIDER_DEFINITIONS); }
}
