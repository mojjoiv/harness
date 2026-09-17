import { Module } from '@nestjs/common';
import { DisplayCurrencyModule } from '../common/currency/display-currency.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { IntegrationsController } from './integrations.controller';

@Module({
  imports: [DisplayCurrencyModule],
  controllers: [DashboardController, IntegrationsController],
  providers: [DashboardService],
})
export class DashboardModule {}
