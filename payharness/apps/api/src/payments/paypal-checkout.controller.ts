import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { PaypalPaymentService } from '../payment-providers/paypal/paypal-payment.service';

@Controller('payments/paypal')
export class PaypalCheckoutController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paypalPaymentService: PaypalPaymentService,
  ) {}

  @Get('success')
  async success(
    @Query('paymentId') paymentId?: string,
    @Query('token') token?: string,
  ) {
    if (!paymentId || !token) {
      throw new BadRequestException('PayPal paymentId and token are required');
    }

    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, provider: 'PAYPAL' },
    });
    if (!payment) throw new NotFoundException('PayPal payment not found');
    if (payment.providerReference !== token) {
      throw new BadRequestException('Invalid PayPal approval token');
    }

    return this.paypalPaymentService.captureOrder(payment.merchantId, undefined, payment.id);
  }
}
