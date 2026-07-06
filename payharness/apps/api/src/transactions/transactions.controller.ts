import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
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
    @Query() pagination?: PaginationQueryDto,
  ) {
    return this.transactionsService.list(user.merchantId, { status, provider, from, to }, pagination || {});
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.transactionsService.get(user.merchantId, id);
  }
}
