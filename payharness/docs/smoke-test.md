# PayHarness Smoke Test

Use these requests after deploy or when verifying a local environment.

Replace:

- `BASE_URL` with your API URL
- `<TOKEN>` with the `accessToken` from `/auth/login`
- `<MERCHANT_ID>` with the merchant ID returned by login
- `<CHECKOUT_SESSION_ID>` with a checkout session ID
- `<API_KEY_ID>` with an API key ID

## Health

```bash
curl -sS "$BASE_URL/health"
```

## Register

```bash
curl -sS -X POST "$BASE_URL/auth/register" \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "owner@example.com",
    "name": "Owner",
    "merchantName": "Demo Merchant",
    "password": "password123"
  }'
```

## Login

```bash
curl -sS -X POST "$BASE_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "owner@example.com",
    "password": "password123"
  }'
```

## Merchant Profile

```bash
curl -sS "$BASE_URL/merchant/profile" \
  -H "Authorization: Bearer <TOKEN>"
```

```bash
curl -sS -X PATCH "$BASE_URL/merchant/profile" \
  -H "Authorization: Bearer <TOKEN>" \
  -H 'Content-Type: application/json' \
  -d '{
    "businessName": "Demo Merchant Ltd",
    "country": "KE",
    "currency": "KES"
  }'
```

## Merchant Branding

```bash
curl -sS "$BASE_URL/merchant/branding" \
  -H "Authorization: Bearer <TOKEN>"
```

```bash
curl -sS -X PATCH "$BASE_URL/merchant/branding" \
  -H "Authorization: Bearer <TOKEN>" \
  -H 'Content-Type: application/json' \
  -d '{
    "logoUrl": "https://example.com/logo.png",
    "primaryColor": "#2563eb",
    "secondaryColor": "#0f172a",
    "buttonColor": "#2563eb"
  }'
```

## Merchant Settings

```bash
curl -sS "$BASE_URL/merchant/settings" \
  -H "Authorization: Bearer <TOKEN>"
```

```bash
curl -sS -X PATCH "$BASE_URL/merchant/settings" \
  -H "Authorization: Bearer <TOKEN>" \
  -H 'Content-Type: application/json' \
  -d '{
    "defaultCurrency": "KES",
    "defaultEnvironment": "SANDBOX",
    "receiptEmailsEnabled": true,
    "webhookRetriesEnabled": true,
    "retryCount": 3,
    "paymentTimeoutMinutes": 30
  }'
```

## Add M-Pesa Credentials

```bash
curl -sS -X POST "$BASE_URL/provider-credentials/mpesa" \
  -H "Authorization: Bearer <TOKEN>" \
  -H 'Content-Type: application/json' \
  -d '{
    "environment": "SANDBOX",
    "publicConfig": {
      "businessType": "PAYBILL",
      "shortcode": "123456"
    },
    "secretConfig": {
      "consumerKey": "demo",
      "consumerSecret": "demo",
      "passkey": "demo"
    }
  }'
```

## Create API Key

```bash
curl -sS -X POST "$BASE_URL/api-keys" \
  -H "Authorization: Bearer <TOKEN>" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Dashboard",
    "environment": "SANDBOX"
  }'
```

## Create Checkout Session

```bash
curl -sS -X POST "$BASE_URL/checkout-sessions" \
  -H "Authorization: Bearer <TOKEN>" \
  -H 'Content-Type: application/json' \
  -d '{
    "amountCents": 2500,
    "currency": "KES",
    "successUrl": "https://example.com/success",
    "cancelUrl": "https://example.com/cancel",
    "allowedProviders": ["MPESA"]
  }'
```

## Mock M-Pesa Payment

```bash
curl -sS -X POST "$BASE_URL/payments/mpesa/stk" \
  -H "Authorization: Bearer <TOKEN>" \
  -H 'Content-Type: application/json' \
  -d '{
    "environment": "SANDBOX",
    "amountCents": 2500,
    "currency": "KES",
    "phoneNumber": "254700000000",
    "description": "Test payment"
  }'
```

## Dashboard

```bash
curl -sS "$BASE_URL/dashboard" \
  -H "Authorization: Bearer <TOKEN>"
```

## Usage

```bash
curl -sS "$BASE_URL/usage?page=1&limit=20" \
  -H "Authorization: Bearer <TOKEN>"
```

## Analytics

```bash
curl -sS "$BASE_URL/analytics/revenue?period=monthly" \
  -H "Authorization: Bearer <TOKEN>"
```

```bash
curl -sS "$BASE_URL/analytics/providers?period=monthly" \
  -H "Authorization: Bearer <TOKEN>"
```

```bash
curl -sS "$BASE_URL/analytics/payments?period=monthly" \
  -H "Authorization: Bearer <TOKEN>"
```

## Swagger

Open:

```text
$BASE_URL/docs
```
