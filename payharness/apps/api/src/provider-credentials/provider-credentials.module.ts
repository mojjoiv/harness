import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { PlatformGatewaysModule } from '../platform/platform-gateways/platform-gateways.module';
import { ProviderAvailabilityModule } from '../provider-availability/provider-availability.module';
import { ProviderCredentialsController } from './provider-credentials.controller';
import { ProviderCredentialsService } from './provider-credentials.service';

@Module({
  imports: [AuditLogsModule, PlatformGatewaysModule, ProviderAvailabilityModule],
  controllers: [ProviderCredentialsController],
  providers: [ProviderCredentialsService],
  exports: [ProviderCredentialsService],
})
export class ProviderCredentialsModule {}
