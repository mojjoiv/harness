import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { MerchantBrandingController } from './merchant-branding.controller';
import { MerchantBrandingService } from './merchant-branding.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [MerchantBrandingController],
  providers: [MerchantBrandingService],
  exports: [MerchantBrandingService],
})
export class MerchantBrandingModule {}
