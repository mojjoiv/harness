import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { CheckoutSessionsService } from './checkout-sessions.service';

@UseGuards(JwtAuthGuard)
@Controller('checkout-sessions')
export class CheckoutSessionsController {
  constructor(private readonly sessionsService: CheckoutSessionsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCheckoutSessionDto) {
    return this.sessionsService.create(user.merchantId, user.userId, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sessionsService.get(user.merchantId, id);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.sessionsService.list(user.merchantId, query);
  }
}
