import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ProviderCredentialsController } from './provider-credentials.controller';
import { ProviderCredentialsService } from './provider-credentials.service';

@Module({
  imports: [AuthModule],
  controllers: [ProviderCredentialsController],
  providers: [ProviderCredentialsService, JwtAuthGuard],
  exports: [ProviderCredentialsService],
})
export class ProviderCredentialsModule {}
