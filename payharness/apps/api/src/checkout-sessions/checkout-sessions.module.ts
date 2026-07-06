import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { MerchantBrandingModule } from '../merchant-branding/merchant-branding.module';
import { CheckoutSessionsController } from './checkout-sessions.controller';
import { CheckoutSessionsService } from './checkout-sessions.service';

@Module({
  imports: [AuditLogsModule, MerchantBrandingModule],
  controllers: [CheckoutSessionsController],
  providers: [CheckoutSessionsService],
})
export class CheckoutSessionsModule {}
