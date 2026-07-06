# PayHarness API Examples

Base URL for local development: `http://localhost:3000`

Protected routes require:

```http
Authorization: Bearer <accessToken>
```

## Register

```http
POST /auth/register
Content-Type: application/json

{
  "email": "owner@example.com",
  "name": "Owner User",
  "merchantName": "Acme Shop",
  "password": "password123"
}
```

Returns `accessToken`, `user`, `merchantId`, and `role`.

## Login

```http
POST /auth/login
Content-Type: application/json

{
  "email": "owner@example.com",
  "password": "password123"
}
```

## Create API Key

```http
POST /api-keys
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "name": "Sandbox key",
  "environment": "SANDBOX"
}
```

The full `apiKey` is returned only once. Later list responses include only `prefix` and `maskedKey`.

## Add M-Pesa Credentials

```http
POST /provider-credentials/mpesa
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "environment": "SANDBOX",
  "publicConfig": {
    "businessType": "PAYBILL",
    "shortcode": "174379",
    "accountReference": "ACME"
  },
  "secretConfig": {
    "consumerKey": "mpesa-consumer-key",
    "consumerSecret": "mpesa-consumer-secret",
    "passkey": "mpesa-passkey"
  }
}
```

## Add Stripe Credentials

```http
POST /provider-credentials/stripe
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "environment": "SANDBOX",
  "publicConfig": {
    "publishableKey": "pk_test_123"
  },
  "secretConfig": {
    "secretKey": "sk_test_123",
    "webhookSecret": "whsec_test"
  }
}
```

## Add PayPal Credentials

```http
POST /provider-credentials/paypal
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "environment": "SANDBOX",
  "publicConfig": {
    "clientId": "paypal-client-id"
  },
  "secretConfig": {
    "clientSecret": "paypal-client-secret",
    "webhookId": "paypal-webhook-id"
  }
}
```

## Create Checkout Session

```http
POST /checkout-sessions
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "amountCents": 250000,
  "currency": "KES",
  "customer": {
    "name": "Jane Customer",
    "email": "jane@example.com",
    "phone": "+254700000000"
  },
  "successUrl": "https://example.com/success",
  "cancelUrl": "https://example.com/cancel",
  "allowedProviders": ["MPESA", "STRIPE"],
  "metadata": {
    "orderId": "order_123"
  }
}
```

Returns a `checkoutUrl` like `http://localhost:3001/pay/<sessionId>`.

## Create Mock M-Pesa Payment

```http
POST /payments/mpesa/stk
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "amountCents": 250000,
  "currency": "KES",
  "environment": "SANDBOX",
  "metadata": {
    "phone": "+254700000000"
  }
}
```

## Create Mock Stripe Payment

```http
POST /payments/stripe/intent
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "amountCents": 250000,
  "currency": "KES",
  "environment": "SANDBOX"
}
```

## Create Mock PayPal Payment

```http
POST /payments/paypal/order
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "amountCents": 250000,
  "currency": "KES",
  "environment": "SANDBOX"
}
```

## List Transactions

```http
GET /transactions?status=PENDING&provider=MPESA&from=2026-01-01&to=2026-12-31
Authorization: Bearer <accessToken>
```

## Configure Webhook Endpoint

```http
POST /webhooks/endpoints
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "url": "https://example.com/payharness/webhook",
  "events": ["payment.succeeded", "payment.failed"]
}
```

The full webhook `secret` is returned only once.

## Test Webhook Endpoint

```http
POST /webhooks/endpoints/<endpointId>/test
Authorization: Bearer <accessToken>
```

Creates a mock `webhook_delivery` record. No real HTTP delivery is attempted in this version.

## Provider Callback Placeholders

```http
POST /webhooks/mpesa
POST /webhooks/stripe
POST /webhooks/paypal
```

These public routes store callback payloads in `webhook_deliveries` and return success. Signature verification is marked as a TODO for live integrations.

## Health

```http
GET /health
```

```json
{
  "status": "ok",
  "service": "payharness-api",
  "timestamp": "2026-07-06T00:00:00.000Z"
}
```
