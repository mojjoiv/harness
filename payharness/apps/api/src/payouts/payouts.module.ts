import { Module } from '@nestjs/common';
import { MpesaPayoutCallbackController } from './mpesa-payout-callback.controller';
import { MpesaPayoutCallbackService } from './mpesa-payout-callback.service';
import { MpesaPayoutProvider } from './mpesa-payout.provider';
import { PayoutExecutionService } from './payout-execution.service';
import { PayoutProviderRegistry } from './payout-provider.registry';
import { PayoutsController } from './payouts.controller';
import { PayoutsService } from './payouts.service';

@Module({
  controllers: [PayoutsController, MpesaPayoutCallbackController],
  providers: [
    PayoutsService,
    MpesaPayoutProvider,
    PayoutProviderRegistry,
    PayoutExecutionService,
    MpesaPayoutCallbackService,
  ],
  exports: [PayoutsService, PayoutExecutionService, PayoutProviderRegistry],
})
export class PayoutsModule {}
