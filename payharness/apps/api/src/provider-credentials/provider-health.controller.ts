import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ProviderCredentialsService } from './provider-credentials.service';

@UseGuards(JwtAuthGuard)
@Controller('providers')
export class ProviderHealthController {
  constructor(private readonly credentialsService: ProviderCredentialsService) {}

  @Get(':id/health')
  health(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.credentialsService.health(user.merchantId as string, id);
  }
}
