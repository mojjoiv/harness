import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TransactionsService } from './transactions.service';

@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
    @Query('provider') provider?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.transactionsService.list(user.merchantId, { status, provider, from, to });
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.transactionsService.get(user.merchantId, id);
  }
}
