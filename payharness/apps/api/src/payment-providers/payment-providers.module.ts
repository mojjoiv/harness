import { Module } from '@nestjs/common';
import { MpesaProviderService } from './mpesa/mpesa-provider.service';
import { MpesaVerificationService } from './mpesa/mpesa-verification.service';
import { StripeProviderService } from './stripe/stripe-provider.service';
import { StripeVerificationService } from './stripe/stripe-verification.service';
import { PaypalProviderService } from './paypal/paypal-provider.service';
import { PesapalProviderService } from './pesapal/pesapal-provider.service';
import { ProviderRegistry } from './provider-registry';

@Module({
  providers: [
    MpesaProviderService,
    MpesaVerificationService,
    StripeProviderService,
    StripeVerificationService,
    PaypalProviderService,
    PesapalProviderService,
    ProviderRegistry,
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
