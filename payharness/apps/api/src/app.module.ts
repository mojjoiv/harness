import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MerchantsModule } from './merchants/merchants.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { ProviderCredentialsModule } from './provider-credentials/provider-credentials.module';
import { CheckoutSessionsModule } from './checkout-sessions/checkout-sessions.module';
import { PaymentsModule } from './payments/payments.module';
import { TransactionsModule } from './transactions/transactions.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { WebhookDeliveriesModule } from './webhook-deliveries/webhook-deliveries.module';
import { CustomersModule } from './customers/customers.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { HealthModule } from './health/health.module';
import { PlansModule } from './plans/plans.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { CommonModule } from './common/common.module';
import { PaymentProvidersModule } from './payment-providers/payment-providers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CommonModule,
    AuthModule,
    UsersModule,
    MerchantsModule,
    ApiKeysModule,
    ProviderCredentialsModule,
    PaymentProvidersModule,
    CheckoutSessionsModule,
    PaymentsModule,
    TransactionsModule,
    WebhooksModule,
    WebhookDeliveriesModule,
    CustomersModule,
    AuditLogsModule,
    HealthModule,
    PlansModule,
    SubscriptionsModule,
  ],
})
export class AppModule {}
