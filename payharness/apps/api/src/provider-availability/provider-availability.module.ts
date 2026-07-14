import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CommonModule } from '../common/common.module';
import { ProviderAvailabilityController } from './provider-availability.controller';
import { ProviderAvailabilityService } from './provider-availability.service';

@Module({
  imports: [CommonModule, AuditLogsModule],
  controllers: [ProviderAvailabilityController],
  providers: [ProviderAvailabilityService],
  exports: [ProviderAvailabilityService],
})
export class ProviderAvailabilityModule {}
