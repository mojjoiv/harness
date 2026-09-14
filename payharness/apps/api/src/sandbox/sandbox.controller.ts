import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { MerchantAuthGuard } from '../common/guards/merchant-auth.guard';
import { CreatePaymentDto } from '../payments/dto/create-payment.dto';
import { SandboxService } from './sandbox.service';

@ApiTags('sandbox')
@ApiBearerAuth()
@UseGuards(MerchantAuthGuard)
@Controller('sandbox')
export class SandboxController {
  constructor(private readonly sandbox: SandboxService) {}

  @Get('status')
  status(@CurrentUser() user: AuthUser) {
    this.sandbox.assertSandboxApiKey(user);
    return {
      environment: 'SANDBOX' as const,
      enabled: true,
      providers: ['MPESA', 'STRIPE', 'PAYPAL'],
      supportedOutcomes: ['SUCCEEDED', 'FAILED'],
    };
  }

  @Post('payments')
  createPayment(@CurrentUser() user: AuthUser, @Body() dto: CreatePaymentDto) {
    this.sandbox.assertSandboxApiKey(user);
    return this.sandbox.createPayment(user.merchantId as string, user.userId || undefined, dto);
  }

  @Post('payments/:id/refund')
  refund(
    @CurrentUser() user: AuthUser,
    @Param('id') paymentId: string,
    @Body() body: { amountCents?: number },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    this.sandbox.assertSandboxApiKey(user);
    return this.sandbox.refund(
      user.merchantId as string,
      user.userId || undefined,
      paymentId,
      body.amountCents,
      idempotencyKey,
    );
  }
}
