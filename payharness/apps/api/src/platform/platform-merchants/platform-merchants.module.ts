import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../../audit-logs/audit-logs.module';
import { CommonModule } from '../../common/common.module';
import { PlatformMerchantsController } from './platform-merchants.controller';
import { PlatformMerchantsService } from './platform-merchants.service';

@Module({
  imports: [CommonModule, AuditLogsModule],
  controllers: [PlatformMerchantsController],
  providers: [PlatformMerchantsService],
})
export class PlatformMerchantsModule {}
