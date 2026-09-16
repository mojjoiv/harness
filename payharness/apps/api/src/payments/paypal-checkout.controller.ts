import { BadRequestException, Controller, Get, NotFoundException, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
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
    @Query('paymentId') paymentId: string | undefined,
    @Query('token') token: string | undefined,
    @Res() response: Response,
  ) {
    if (!paymentId || !token) throw new BadRequestException('PayPal paymentId and token are required');

    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, provider: 'PAYPAL' },
      include: { checkoutSession: true },
    });
    if (!payment) throw new NotFoundException('PayPal payment not found');
    if (payment.providerReference !== token) throw new BadRequestException('Invalid PayPal approval token');

    const result = await this.paypalPaymentService.captureOrder(payment.merchantId, undefined, payment.id);
    const redirectUrl = result.status === 'SUCCEEDED' ? payment.checkoutSession?.successUrl : payment.checkoutSession?.cancelUrl;
    if (!redirectUrl) return response.json(result);
    return response.redirect(303, redirectUrl);
  }
}
