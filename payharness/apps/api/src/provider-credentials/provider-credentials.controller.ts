import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SaveProviderCredentialDto } from './dto/save-provider-credential.dto';
import { ProviderCredentialsService } from './provider-credentials.service';

@UseGuards(JwtAuthGuard)
@Controller('provider-credentials')
export class ProviderCredentialsController {
  constructor(private readonly credentialsService: ProviderCredentialsService) {}

  @Post('mpesa')
  saveMpesa(@CurrentUser() user: AuthUser, @Body() dto: SaveProviderCredentialDto) {
    return this.credentialsService.save(user.merchantId, 'MPESA', dto);
  }

  @Post('stripe')
  saveStripe(@CurrentUser() user: AuthUser, @Body() dto: SaveProviderCredentialDto) {
    return this.credentialsService.save(user.merchantId, 'STRIPE', dto);
  }

  @Post('paypal')
  savePaypal(@CurrentUser() user: AuthUser, @Body() dto: SaveProviderCredentialDto) {
    return this.credentialsService.save(user.merchantId, 'PAYPAL', dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.credentialsService.list(user.merchantId);
  }
}
