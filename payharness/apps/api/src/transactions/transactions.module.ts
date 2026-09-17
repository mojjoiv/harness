import { Module } from '@nestjs/common';
import { DisplayCurrencyModule } from '../common/currency/display-currency.module';
import { RefundsController } from './refunds.controller';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [DisplayCurrencyModule],
  controllers: [TransactionsController, RefundsController],
  providers: [TransactionsService],
})
export class TransactionsModule {}
