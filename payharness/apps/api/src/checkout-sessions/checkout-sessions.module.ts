import { Module } from '@nestjs/common';
import { CheckoutSessionsController } from './checkout-sessions.controller';
import { CheckoutSessionsService } from './checkout-sessions.service';

@Module({
  controllers: [CheckoutSessionsController],
  providers: [CheckoutSessionsService],
})
export class CheckoutSessionsModule {}
