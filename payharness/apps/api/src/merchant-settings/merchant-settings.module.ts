import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { MerchantSettingsController } from './merchant-settings.controller';
import { MerchantSettingsService } from './merchant-settings.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [MerchantSettingsController],
  providers: [MerchantSettingsService],
})
export class MerchantSettingsModule {}
