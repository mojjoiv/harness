import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { PlatformExchangeRatesModule } from '../platform-exchange-rates/platform-exchange-rates.module';
import { PlatformDashboardController } from './platform-dashboard.controller';
import { PlatformDashboardService } from './platform-dashboard.service';

@Module({
  imports: [CommonModule, PlatformExchangeRatesModule],
  controllers: [PlatformDashboardController],
  providers: [PlatformDashboardService],
})
export class PlatformDashboardModule {}
