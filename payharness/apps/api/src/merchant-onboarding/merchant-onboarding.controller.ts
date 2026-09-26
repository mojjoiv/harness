import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { MerchantOnboardingService } from './merchant-onboarding.service';

@UseGuards(JwtAuthGuard)
@Controller('merchant/onboarding')
export class MerchantOnboardingController {
  constructor(private readonly onboardingService: MerchantOnboardingService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.onboardingService.get(user.merchantId);
  }
}
