import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { MerchantProfileController } from './merchant-profile.controller';
import { MerchantProfileService } from './merchant-profile.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [MerchantProfileController],
  providers: [MerchantProfileService],
})
export class MerchantProfileModule {}
