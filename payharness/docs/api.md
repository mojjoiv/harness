# PayHarness API

## Auth

- `POST /auth/register`
- `POST /auth/login`

## Merchant

- `GET /merchants/me`
- `PATCH /merchants/me`

## Providers

- `POST /provider-credentials/mpesa`
- `POST /provider-credentials/stripe`
- `POST /provider-credentials/paypal`
- `GET /provider-credentials`

Credential secrets are encrypted at rest and only masked values are returned.

## API Keys

- `POST /api-keys`
- `GET /api-keys`
- `PATCH /api-keys/:id/revoke`

API keys are hashed before storage. The full key is returned only once at creation.

## Payments

- `POST /checkout-sessions`
- `GET /checkout-sessions/:id`
- `POST /payments/mpesa/stk`
- `POST /payments/stripe/intent`
- `POST /payments/paypal/order`
- `GET /transactions`
- `GET /transactions/:id`

Payment provider services are placeholders in this version.

## Webhooks

- `POST /webhooks/mpesa`
- `POST /webhooks/stripe`
- `POST /webhooks/paypal`

## Health

- `GET /health`
