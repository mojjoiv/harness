import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ProviderStatusService } from './provider-status.service';

@UseGuards(JwtAuthGuard)
@Controller('providers/status')
export class ProviderStatusController {
  constructor(private readonly providerStatusService: ProviderStatusService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.providerStatusService.list(user.merchantId);
  }
}
