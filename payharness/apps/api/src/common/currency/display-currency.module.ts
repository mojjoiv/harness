import { Module } from '@nestjs/common';
import { DisplayCurrencyService } from './display-currency.service';

@Module({
  providers: [DisplayCurrencyService],
  exports: [DisplayCurrencyService],
})
export class DisplayCurrencyModule {}
