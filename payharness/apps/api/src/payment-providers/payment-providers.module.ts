import { Module } from '@nestjs/common';
import { MpesaProviderService } from './mpesa/mpesa-provider.service';
import { MpesaVerificationService } from './mpesa/mpesa-verification.service';
import { StripeProviderService } from './stripe/stripe-provider.service';
import { StripeVerificationService } from './stripe/stripe-verification.service';
import { PaypalProviderService } from './paypal/paypal-provider.service';
import { PesapalProviderService } from './pesapal/pesapal-provider.service';
import { ProviderRegistry } from './provider-registry';
import { PROVIDER_ADAPTERS, ProviderAdapter } from './adapters/provider-adapter';
import { MpesaPaymentAdapter } from './adapters/mpesa-payment.adapter';
import { StripePaymentAdapter } from './adapters/stripe-payment.adapter';
import { PaypalPaymentAdapter } from './adapters/paypal-payment.adapter';
import { PesapalPaymentAdapter } from './adapters/pesapal-payment.adapter';

@Module({
  providers: [
    MpesaProviderService,
    MpesaVerificationService,
    StripeProviderService,
    StripeVerificationService,
    PaypalProviderService,
    PesapalProviderService,
    {
      provide: PROVIDER_ADAPTERS,
      useFactory: (
        mpesaAdapter: MpesaPaymentAdapter,
        stripeAdapter: StripePaymentAdapter,
        paypalAdapter: PaypalPaymentAdapter,
        pesapalAdapter: PesapalPaymentAdapter,
      ): ProviderAdapter[] => [mpesaAdapter, stripeAdapter, paypalAdapter, pesapalAdapter],
      inject: [MpesaPaymentAdapter, StripePaymentAdapter, PaypalPaymentAdapter, PesapalPaymentAdapter],
    },
    ProviderRegistry,
    MpesaPaymentAdapter,
    StripePaymentAdapter,
    PaypalPaymentAdapter,
    PesapalPaymentAdapter,
  ],
  exports: [
    MpesaProviderService,
    MpesaVerificationService,
    StripeProviderService,
    StripeVerificationService,
    PaypalProviderService,
    PesapalProviderService,
    ProviderRegistry,
  ],
})
export class PaymentProvidersModule {}
