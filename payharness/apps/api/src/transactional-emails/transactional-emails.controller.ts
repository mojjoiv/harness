import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { EnvironmentIsolationGuard } from '../common/guards/environment-isolation.guard';
import { MerchantAuthGuard } from '../common/guards/merchant-auth.guard';
import { SendTransactionalEmailDto } from './dto/send-transactional-email.dto';
import { TransactionalEmailsService } from './transactional-emails.service';

@ApiTags('transactional-emails')
@ApiBearerAuth()
@Controller('transactional-emails')
export class TransactionalEmailsController {
  constructor(private readonly service: TransactionalEmailsService) {}

  @Post()
  @UseGuards(MerchantAuthGuard, EnvironmentIsolationGuard)
  send(
    @CurrentUser() user: AuthUser,
    @Body() dto: SendTransactionalEmailDto,
    @Headers('idempotency-key') headerIdempotencyKey?: string,
  ) {
    return this.service.queue(
      user.merchantId as string,
      dto,
      headerIdempotencyKey,
      user.environment,
    );
  }

  @Get()
  @UseGuards(MerchantAuthGuard)
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.merchantId as string);
  }

  @Get('usage')
  @UseGuards(MerchantAuthGuard)
  usage(@CurrentUser() user: AuthUser) {
    return this.service.usage(user.merchantId as string);
  }

  @Post('webhooks/postmark')
  async postmarkWebhook(@Req() request: Request, @Headers('x-payharness-webhook-secret') secret?: string) {
    if (!this.service.verifyWebhookSecret(secret)) {
      throw new UnauthorizedException('Invalid webhook secret');
    }
    return this.service.processProviderEvent(request.body);
  }

  @Get(':id')
  @UseGuards(MerchantAuthGuard)
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.get(user.merchantId as string, id);
  }
}
