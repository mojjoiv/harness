import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { MerchantAuthGuard } from '../common/guards/merchant-auth.guard';
import { CreatePayoutDto } from './dto/create-payout.dto';
import { ListPayoutsDto } from './dto/list-payouts.dto';
import { PayoutExecutionService } from './payout-execution.service';
import { PayoutReconciliationService } from './payout-reconciliation.service';
import { PayoutsService } from './payouts.service';

@UseGuards(MerchantAuthGuard)
@Controller('payouts')
export class PayoutsController {
  constructor(
    private readonly payoutsService: PayoutsService,
    private readonly payoutExecutionService: PayoutExecutionService,
    private readonly payoutReconciliationService: PayoutReconciliationService,
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

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListPayoutsDto) {
    return this.payoutsService.listPayouts(user.merchantId as string, query);
  }

  @Post('reconciliation/run')
  reconcile(@CurrentUser() user: AuthUser) {
    return this.payoutReconciliationService.reconcileStalePayouts(
      user.merchantId as string,
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
