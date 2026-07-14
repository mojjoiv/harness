import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { PlatformExchangeRatesController } from './platform-exchange-rates.controller';
import { PlatformExchangeRatesService } from './platform-exchange-rates.service';

@Module({
  imports: [CommonModule],
  controllers: [PlatformExchangeRatesController],
  providers: [PlatformExchangeRatesService],
  exports: [PlatformExchangeRatesService],
})
export class PlatformExchangeRatesModule {}
