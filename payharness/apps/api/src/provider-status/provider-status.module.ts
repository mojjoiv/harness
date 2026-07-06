import { Module } from '@nestjs/common';
import { ProviderStatusController } from './provider-status.controller';
import { ProviderStatusService } from './provider-status.service';

@Module({
  controllers: [ProviderStatusController],
  providers: [ProviderStatusService],
})
export class ProviderStatusModule {}
