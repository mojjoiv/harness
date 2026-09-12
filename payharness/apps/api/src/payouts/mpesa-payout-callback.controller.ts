import { Body, Controller, Param, Post } from '@nestjs/common';
import {
  MpesaPayoutCallbackResult,
  MpesaPayoutCallbackService,
} from './mpesa-payout-callback.service';

@Controller('webhooks/provider/MPESA')
export class MpesaPayoutCallbackController {
  constructor(private readonly callbacks: MpesaPayoutCallbackService) {}

  @Post(':merchantId')
  callback(
    @Param('merchantId') merchantId: string,
    @Body() body: MpesaPayoutCallbackResult,
  ) {
    return this.callbacks.handleResult(merchantId, body);
  }

  @Post(':merchantId/result')
  result(
    @Param('merchantId') merchantId: string,
    @Body() body: MpesaPayoutCallbackResult,
  ) {
    return this.callbacks.handleResult(merchantId, body);
  }

  @Post(':merchantId/timeout')
  timeout(
    @Param('merchantId') merchantId: string,
    @Body() body: MpesaPayoutCallbackResult,
  ) {
    return this.callbacks.handleTimeout(merchantId, body);
  }
}
