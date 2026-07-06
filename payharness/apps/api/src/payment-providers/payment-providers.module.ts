import { Module } from '@nestjs/common';
import { MpesaProviderService } from './mpesa/mpesa-provider.service';
import { StripeProviderService } from './stripe/stripe-provider.service';
import { PaypalProviderService } from './paypal/paypal-provider.service';

@Module({
  providers: [MpesaProviderService, StripeProviderService, PaypalProviderService],
  exports: [MpesaProviderService, StripeProviderService, PaypalProviderService],
})
export class PaymentProvidersModule {}
