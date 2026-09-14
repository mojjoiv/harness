import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CommonModule } from '../common/common.module';
import { PaymentIdempotencyService } from '../payments/payment-idempotency.service';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { SandboxController } from './sandbox.controller';
import { SandboxService } from './sandbox.service';

@Module({
  imports: [CommonModule, AuditLogsModule, WebhooksModule],
  controllers: [SandboxController],
  providers: [SandboxService, PaymentIdempotencyService],
})
export class SandboxModule {}
