import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { IntegrationsController } from './integrations.controller';

@Module({
  controllers: [DashboardController, IntegrationsController],
  providers: [DashboardService],
})
export class DashboardModule {}
