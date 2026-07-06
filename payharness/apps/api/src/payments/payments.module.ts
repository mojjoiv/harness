import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PaymentProvidersModule } from '../payment-providers/payment-providers.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [AuthModule, PaymentProvidersModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, JwtAuthGuard],
})
export class PaymentsModule {}
