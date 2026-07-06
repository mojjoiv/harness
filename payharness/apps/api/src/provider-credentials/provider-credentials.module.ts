import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { ProviderCredentialsController } from './provider-credentials.controller';
import { ProviderCredentialsService } from './provider-credentials.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [ProviderCredentialsController],
  providers: [ProviderCredentialsService],
  exports: [ProviderCredentialsService],
})
export class ProviderCredentialsModule {}
