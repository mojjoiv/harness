import { Module } from '@nestjs/common';
import { MerchantOnboardingController } from './merchant-onboarding.controller';
import { MerchantOnboardingService } from './merchant-onboarding.service';

@Module({
  controllers: [MerchantOnboardingController],
  providers: [MerchantOnboardingService],
})
export class MerchantOnboardingModule {}
