import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  SaveMpesaCredentialDto,
  SavePaypalCredentialDto,
  SaveStripeCredentialDto,
} from './dto/provider-credential.dto';
import { ProviderCredentialsService } from './provider-credentials.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('provider-credentials')
export class ProviderCredentialsController {
  constructor(private readonly credentialsService: ProviderCredentialsService) {}

  @Post('mpesa')
  @Roles(UserRole.OWNER)
  saveMpesa(@CurrentUser() user: AuthUser, @Body() dto: SaveMpesaCredentialDto) {
    return this.credentialsService.save(user.merchantId, user.userId, 'MPESA', dto);
  }

  @Post('stripe')
  @Roles(UserRole.OWNER)
  saveStripe(@CurrentUser() user: AuthUser, @Body() dto: SaveStripeCredentialDto) {
    return this.credentialsService.save(user.merchantId, user.userId, 'STRIPE', dto);
  }

  @Post('paypal')
  @Roles(UserRole.OWNER)
  savePaypal(@CurrentUser() user: AuthUser, @Body() dto: SavePaypalCredentialDto) {
    return this.credentialsService.save(user.merchantId, user.userId, 'PAYPAL', dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.credentialsService.list(user.merchantId);
  }

  @Post(':id/verify')
  @Roles(UserRole.OWNER)
  verify(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.credentialsService.verify(user.merchantId, id);
  }
}
