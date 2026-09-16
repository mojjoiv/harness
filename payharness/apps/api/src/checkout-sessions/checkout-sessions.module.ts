import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CurrencyModule } from '../currency/currency.module';
import { MerchantBrandingModule } from '../merchant-branding/merchant-branding.module';
import { PaymentsModule } from '../payments/payments.module';
import { CheckoutSessionsController } from './checkout-sessions.controller';
import { HostedCheckoutController } from './hosted-checkout.controller';
import { CheckoutSessionsService } from './checkout-sessions.service';

@Module({
  imports: [AuditLogsModule, CurrencyModule, MerchantBrandingModule, PaymentsModule],
  controllers: [CheckoutSessionsController, HostedCheckoutController],
  providers: [CheckoutSessionsService],
})
export class CheckoutSessionsModule {}
