import { Controller, Get, UseGuards } from '@nestjs/common';
import { PlatformJwtAuthGuard } from '../common/platform-jwt-auth.guard';
import { PlatformSubscriptionsService } from './platform-subscriptions.service';

@Controller('platform/subscriptions')
@UseGuards(PlatformJwtAuthGuard)
export class PlatformSubscriptionsController {
  constructor(private readonly subscriptions: PlatformSubscriptionsService) {}

  @Get()
  list() {
    return this.subscriptions.list();
  }
}
