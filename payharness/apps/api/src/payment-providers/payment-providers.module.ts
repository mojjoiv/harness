import { Module } from '@nestjs/common';
import { MpesaProviderService } from './mpesa/mpesa-provider.service';
import { MpesaVerificationService } from './mpesa/mpesa-verification.service';
import { StripeProviderService } from './stripe/stripe-provider.service';
import { PaypalProviderService } from './paypal/paypal-provider.service';

@Module({
  providers: [MpesaProviderService, MpesaVerificationService, StripeProviderService, PaypalProviderService],
  exports: [MpesaProviderService, MpesaVerificationService, StripeProviderService, PaypalProviderService],
})
export class PaymentProvidersModule {}
