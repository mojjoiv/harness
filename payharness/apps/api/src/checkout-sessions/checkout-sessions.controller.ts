import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { CheckoutSessionsService } from './checkout-sessions.service';

@UseGuards(JwtAuthGuard)
@Controller('checkout-sessions')
export class CheckoutSessionsController {
  constructor(private readonly sessionsService: CheckoutSessionsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCheckoutSessionDto) {
    return this.sessionsService.create(user.merchantId, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sessionsService.get(user.merchantId, id);
  }
}
