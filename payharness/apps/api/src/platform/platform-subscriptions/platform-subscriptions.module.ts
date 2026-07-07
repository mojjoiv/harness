import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { PlatformSubscriptionsController } from './platform-subscriptions.controller';
import { PlatformSubscriptionsService } from './platform-subscriptions.service';

@Module({
  imports: [CommonModule],
  controllers: [PlatformSubscriptionsController],
  providers: [PlatformSubscriptionsService],
})
export class PlatformSubscriptionsModule {}
