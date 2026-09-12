import { Module } from '@nestjs/common';
import { PayoutProviderRegistry } from './payout-provider.registry';
import { PayoutExecutionService } from './payout-execution.service';
import { PayoutsController } from './payouts.controller';
import { PayoutsService } from './payouts.service';

@Module({
  controllers: [PayoutsController],
  providers: [PayoutsService, PayoutProviderRegistry, PayoutExecutionService],
  exports: [PayoutsService, PayoutExecutionService, PayoutProviderRegistry],
})
export class PayoutsModule {}
