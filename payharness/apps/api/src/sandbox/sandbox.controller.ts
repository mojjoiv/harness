import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { MerchantAuthGuard } from '../common/guards/merchant-auth.guard';
import { CreatePaymentDto } from '../payments/dto/create-payment.dto';
import { PaymentsService } from '../payments/payments.service';

@ApiTags('sandbox')
@ApiBearerAuth()
@UseGuards(MerchantAuthGuard)
@Controller('sandbox')
export class SandboxController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('status')
  status(@CurrentUser() user: AuthUser) {
    this.assertSandbox(user);
    return {
      environment: 'SANDBOX' as const,
      enabled: true,
      providers: ['MPESA', 'STRIPE', 'PAYPAL'],
      supportedOutcomes: ['SUCCEEDED', 'FAILED'],
    };
  }

  @Post('payments')
  createPayment(@CurrentUser() user: AuthUser, @Body() dto: CreatePaymentDto) {
    this.assertSandbox(user);
    return this.payments.createPayment(
      user.merchantId as string,
      user.userId || undefined,
      { ...dto, environment: 'SANDBOX' },
    );
  }

  private assertSandbox(user: AuthUser) {
    if (user.type === 'api_key' && user.environment !== 'SANDBOX') {
      throw new Error('Sandbox endpoints require a SANDBOX API key');
    }
  }
}
