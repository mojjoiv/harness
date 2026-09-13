import { Module } from '@nestjs/common';
import { RefundsController } from './refunds.controller';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  controllers: [TransactionsController, RefundsController],
  providers: [TransactionsService],
})
export class TransactionsModule {}
