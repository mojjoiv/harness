import { Module } from '@nestjs/common';
import { PlatformAuditLogsModule } from './platform-audit-logs/platform-audit-logs.module';
import { PlatformAuthModule } from './platform-auth/platform-auth.module';
import { PlatformDashboardModule } from './platform-dashboard/platform-dashboard.module';
import { PlatformMerchantsModule } from './platform-merchants/platform-merchants.module';
import { PlatformOwnersModule } from './platform-owners/platform-owners.module';
import { PlatformPlansModule } from './platform-plans/platform-plans.module';
import { PlatformSubscriptionsModule } from './platform-subscriptions/platform-subscriptions.module';
import { PlatformUsersModule } from './platform-users/platform-users.module';

@Module({
  imports: [
    PlatformAuditLogsModule,
    PlatformAuthModule,
    PlatformDashboardModule,
    PlatformMerchantsModule,
    PlatformOwnersModule,
    PlatformPlansModule,
    PlatformSubscriptionsModule,
    PlatformUsersModule,
  ],
})
export class PlatformModule {}
