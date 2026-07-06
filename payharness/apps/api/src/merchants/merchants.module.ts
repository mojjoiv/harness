import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthModule } from '../auth/auth.module';
import { MerchantsController } from './merchants.controller';
import { MerchantsService } from './merchants.service';

@Module({
  imports: [AuthModule],
  controllers: [MerchantsController],
  providers: [MerchantsService, JwtAuthGuard],
})
export class MerchantsModule {}
