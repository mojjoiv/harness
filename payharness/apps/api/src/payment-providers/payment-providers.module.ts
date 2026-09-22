import { Module } from '@nestjs/common';
import { MpesaProviderService } from './mpesa/mpesa-provider.service';
import { MpesaVerificationService } from './mpesa/mpesa-verification.service';
import { StripeProviderService } from './stripe/stripe-provider.service';
import { StripeVerificationService } from './stripe/stripe-verification.service';
import { PaypalProviderService } from './paypal/paypal-provider.service';
import { PesapalProviderService } from './pesapal/pesapal-provider.service';
import { ProviderRegistry } from './provider-registry';
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
