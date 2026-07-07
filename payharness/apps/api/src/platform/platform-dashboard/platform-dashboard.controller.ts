import { Controller, Get, UseGuards } from '@nestjs/common';
import { PlatformJwtAuthGuard } from '../common/platform-jwt-auth.guard';
import { PlatformDashboardService } from './platform-dashboard.service';

@Controller('platform/dashboard')
@UseGuards(PlatformJwtAuthGuard)
export class PlatformDashboardController {
  constructor(private readonly dashboard: PlatformDashboardService) {}

  @Get()
  overview() {
    return this.dashboard.overview();
  }
}
