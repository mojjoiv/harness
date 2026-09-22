import { BadRequestException, Injectable } from '@nestjs/common';
import { Provider } from '@prisma/client';
import { MpesaPaymentAdapter } from './adapters/mpesa-payment.adapter';
import { PaypalPaymentAdapter } from './adapters/paypal-payment.adapter';
import { PesapalPaymentAdapter } from './adapters/pesapal-payment.adapter';
import { ProviderAdapter } from './adapters/provider-adapter';
import { StripePaymentAdapter } from './adapters/stripe-payment.adapter';

@Injectable()
export class ProviderAdapterRegistry {
  private readonly adapters: ReadonlyMap<Provider, ProviderAdapter>;

  constructor(
    mpesa: MpesaPaymentAdapter,
    stripe: StripePaymentAdapter,
    paypal: PaypalPaymentAdapter,
    pesapal: PesapalPaymentAdapter,
  ) {
    this.adapters = new Map([
      ['MPESA', mpesa],
      ['STRIPE', stripe],
      ['PAYPAL', paypal],
      ['PESAPAL', pesapal],
    ]);
  }

  get(provider: Provider): ProviderAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) throw new BadRequestException(`No adapter registered for provider: ${provider}`);
    return adapter;
  }

  list(): ProviderAdapter[] {
    return [...this.adapters.values()];
  }
}
