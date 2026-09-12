import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { MerchantAuthGuard } from '../common/guards/merchant-auth.guard';
import { CreatePayoutDto } from './dto/create-payout.dto';
import { PayoutExecutionService } from './payout-execution.service';
import { PayoutsService } from './payouts.service';

@UseGuards(MerchantAuthGuard)
@Controller('payouts')
export class PayoutsController {
  constructor(
    private readonly payoutsService: PayoutsService,
    private readonly payoutExecutionService: PayoutExecutionService,
  ) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePayoutDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    return this.payoutsService.createPayout(
      user.merchantId as string,
      dto,
      idempotencyKey,
    );
  }

  @Post(':id/execute')
  execute(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.payoutExecutionService.executePayout(user.merchantId as string, id);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.payoutsService.getPayout(user.merchantId as string, id);
  }
}
