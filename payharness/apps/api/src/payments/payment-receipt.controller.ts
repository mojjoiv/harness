import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { MerchantAuthGuard } from '../common/guards/merchant-auth.guard';
import { PaymentReceiptService } from './payment-receipt.service';

@UseGuards(MerchantAuthGuard)
@Controller('payments')
export class PaymentReceiptController {
  constructor(private readonly paymentReceiptService: PaymentReceiptService) {}

  @Get('receipts')
  listReceipts(@CurrentUser() user: AuthUser) {
    return this.paymentReceiptService.listReceipts(user.merchantId as string);
  }

  @Get(':id/receipt')
  getReceipt(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.paymentReceiptService.getReceipt(user.merchantId as string, id);
  }
}
