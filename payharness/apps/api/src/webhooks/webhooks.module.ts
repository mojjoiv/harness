import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [AuthModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, JwtAuthGuard],
})
export class WebhooksModule {}
