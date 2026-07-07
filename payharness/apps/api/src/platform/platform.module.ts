import { Module } from '@nestjs/common';
import { PlatformAuthModule } from './platform-auth/platform-auth.module';
import { PlatformDashboardModule } from './platform-dashboard/platform-dashboard.module';
import { PlatformMerchantsModule } from './platform-merchants/platform-merchants.module';
import { PlatformPlansModule } from './platform-plans/platform-plans.module';
import { PlatformSubscriptionsModule } from './platform-subscriptions/platform-subscriptions.module';
import { PlatformUsersModule } from './platform-users/platform-users.module';

@Module({
  imports: [
    PlatformAuthModule,
    PlatformDashboardModule,
    PlatformMerchantsModule,
    PlatformPlansModule,
    PlatformSubscriptionsModule,
    PlatformUsersModule,
  ],
})
export class PlatformModule {}
