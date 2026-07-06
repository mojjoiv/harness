import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  SaveMpesaCredentialDto,
  SavePaypalCredentialDto,
  SaveStripeCredentialDto,
} from './dto/provider-credential.dto';
import { ProviderCredentialsService } from './provider-credentials.service';

@UseGuards(JwtAuthGuard)
@Controller('provider-credentials')
export class ProviderCredentialsController {
  constructor(private readonly credentialsService: ProviderCredentialsService) {}

  @Post('mpesa')
  saveMpesa(@CurrentUser() user: AuthUser, @Body() dto: SaveMpesaCredentialDto) {
    return this.credentialsService.save(user.merchantId, user.userId, 'MPESA', dto);
  }

  @Post('stripe')
  saveStripe(@CurrentUser() user: AuthUser, @Body() dto: SaveStripeCredentialDto) {
    return this.credentialsService.save(user.merchantId, user.userId, 'STRIPE', dto);
  }

  @Post('paypal')
  savePaypal(@CurrentUser() user: AuthUser, @Body() dto: SavePaypalCredentialDto) {
    return this.credentialsService.save(user.merchantId, user.userId, 'PAYPAL', dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.credentialsService.list(user.merchantId);
  }

  @Post(':id/verify')
  verify(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.credentialsService.verify(user.merchantId, id);
  }
}
