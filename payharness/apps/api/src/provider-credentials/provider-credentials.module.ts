import { Module } from '@nestjs/common';
import { ProviderCredentialsController } from './provider-credentials.controller';
import { ProviderCredentialsService } from './provider-credentials.service';

@Module({
  controllers: [ProviderCredentialsController],
  providers: [ProviderCredentialsService],
  exports: [ProviderCredentialsService],
})
export class ProviderCredentialsModule {}
