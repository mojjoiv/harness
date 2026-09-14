import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { SandboxController } from './sandbox.controller';

@Module({
  imports: [PaymentsModule],
  controllers: [SandboxController],
})
export class SandboxModule {}
