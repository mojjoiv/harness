import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { MerchantAuthGuard } from '../common/guards/merchant-auth.guard';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { CheckoutSessionsService } from './checkout-sessions.service';

@UseGuards(MerchantAuthGuard)
@Controller('checkout-sessions')
export class CheckoutSessionsController {
  constructor(private readonly sessionsService: CheckoutSessionsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCheckoutSessionDto) {
    return this.sessionsService.create(user.merchantId as string, user.userId || undefined, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sessionsService.get(user.merchantId as string, id);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.sessionsService.list(user.merchantId as string, query);
  }
}
