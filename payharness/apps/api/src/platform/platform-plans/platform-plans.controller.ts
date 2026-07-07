import { Controller, Get, UseGuards } from '@nestjs/common';
import { PlatformJwtAuthGuard } from '../common/platform-jwt-auth.guard';
import { PlatformPlansService } from './platform-plans.service';

@Controller('platform/plans')
@UseGuards(PlatformJwtAuthGuard)
export class PlatformPlansController {
  constructor(private readonly plans: PlatformPlansService) {}

  @Get()
  list() {
    return this.plans.list();
  }
}
