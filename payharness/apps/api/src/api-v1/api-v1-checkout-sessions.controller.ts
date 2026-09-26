import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { MerchantAuthGuard } from '../common/guards/merchant-auth.guard';
import { CreateCheckoutSessionDto } from '../checkout-sessions/dto/create-checkout-session.dto';
import { CheckoutSessionsService } from '../checkout-sessions/checkout-sessions.service';

@ApiTags('api-v1-checkout')
@ApiBearerAuth()
@UseGuards(MerchantAuthGuard)
@Controller('api/v1/checkout-sessions')
export class ApiV1CheckoutSessionsController {
  constructor(private readonly sessionsService: CheckoutSessionsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCheckoutSessionDto) {
    return this.sessionsService.create(
      user.merchantId as string,
      user.userId || undefined,
      dto,
      user.environment,
    );
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
