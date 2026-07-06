import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CheckoutSessionsController } from './checkout-sessions.controller';
import { CheckoutSessionsService } from './checkout-sessions.service';

@Module({
  imports: [AuthModule],
  controllers: [CheckoutSessionsController],
  providers: [CheckoutSessionsService, JwtAuthGuard],
})
export class CheckoutSessionsModule {}
