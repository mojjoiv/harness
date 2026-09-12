import { Module } from '@nestjs/common';
import { MpesaPayoutCallbackController } from './mpesa-payout-callback.controller';
import { MpesaPayoutCallbackService } from './mpesa-payout-callback.service';
import { MpesaPayoutProvider } from './mpesa-payout.provider';
import { MpesaPayoutReconciliationProvider } from './mpesa-payout-reconciliation.provider';
import { PayoutExecutionService } from './payout-execution.service';
import { PayoutProviderRegistry } from './payout-provider.registry';
import { PayoutReconciliationService } from './payout-reconciliation.service';
import { PayoutsController } from './payouts.controller';
import { PayoutsService } from './payouts.service';

@Module({
  controllers: [PayoutsController, MpesaPayoutCallbackController],
  providers: [
    PayoutsService,
    MpesaPayoutProvider,
    MpesaPayoutReconciliationProvider,
    PayoutProviderRegistry,
    PayoutExecutionService,
    PayoutReconciliationService,
    MpesaPayoutCallbackService,
  ],
  exports: [
    PayoutsService,
    PayoutExecutionService,
    PayoutProviderRegistry,
    PayoutReconciliationService,
  ],
})
export class PayoutsModule {}
