import { Controller, Get, UseGuards } from '@nestjs/common';
import { PlatformJwtAuthGuard } from '../common/platform-jwt-auth.guard';
import { PlatformExchangeRatesService } from './platform-exchange-rates.service';

@Controller('platform/exchange-rates')
@UseGuards(PlatformJwtAuthGuard)
export class PlatformExchangeRatesController {
  constructor(private readonly exchangeRates: PlatformExchangeRatesService) {}

  @Get()
  get() {
    return this.exchangeRates.getRates();
  }
}
