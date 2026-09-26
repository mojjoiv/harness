# PayHarness API Reference

Version: 0.1.0

This is the implementation-oriented reference for merchant integrations. The running Swagger document remains the authoritative generated schema for request and response DTOs.

## Environments

| Environment | API key prefix | Purpose |
|---|---|---|
| Sandbox | `ph_sandbox_` | Integration and test payments |
| Live | `ph_live_` | Production payments |

Keep API keys server-side. Do not put them in browser bundles, mobile apps, public repositories, or client-side environment variables.

## Authentication

Send:

```http
Authorization: Bearer ph_sandbox_...
```

Dashboard JWTs are for authenticated dashboard workflows. API keys are for server-to-server merchant integrations.

## Versioned endpoints

All stable merchant integration endpoints are under `/api/v1`.

### Payments

| Method | Endpoint | Purpose | Idempotency |
|---|---|---|---|
| POST | `/api/v1/payments` | Create a payment | Recommended |
| GET | `/api/v1/payments/:id` | Retrieve a payment | No |
| GET | `/api/v1/payments/:id/query` | Refresh provider status | No |
| POST | `/api/v1/payments/:id/refund` | Refund a payment | Required for retries |

### Checkout sessions

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/checkout-sessions` | Create hosted checkout session |
| GET | `/api/v1/checkout-sessions` | List merchant checkout sessions |
| GET | `/api/v1/checkout-sessions/:id` | Retrieve a checkout session |

The unversioned merchant routes remain available for backwards compatibility.

## Payment creation

```http
POST /api/v1/payments
Authorization: Bearer ph_sandbox_...
Content-Type: application/json
Idempotency-Key: order-123-payment
```

Example:

```json
{
  "amountCents": 1500,
  "currency": "KES",
  "environment": "SANDBOX",
  "provider": "MPESA",
  "metadata": {
    "orderId": "order-123"
  }
}
```

The API validates amount, currency, environment, provider support, and merchant ownership of referenced checkout sessions.

## Refunds

```http
POST /api/v1/payments/:id/refund
Authorization: Bearer ph_live_...
Content-Type: application/json
Idempotency-Key: refund-order-123
```

Refunds are restricted to authorized merchant roles. Reuse the same idempotency key when safely retrying the same logical refund request.

## Checkout sessions

A hosted checkout session is merchant-owned. When a payment references a checkout session, the payment amount and currency are derived from that session and the session ownership is verified before processing.

Do not trust a browser-supplied amount or currency when the server already has a checkout session.

## Response envelope

Successful API responses normally use:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "apiVersion": "0.1.0",
    "requestId": "request-id"
  },
  "timestamp": "2026-09-27T00:00:00.000Z"
}
```

Errors use:

```json
{
  "success": false,
  "code": "BAD_REQUEST",
  "message": "Readable error message",
  "errors": [],
  "timestamp": "2026-09-27T00:00:00.000Z"
}
```

Persist the `requestId` when investigating failed requests.

## HTTP behavior

| Status | Meaning |
|---:|---|
| 200 | Successful read/update |
| 201 | Resource created |
| 400 | Invalid request or unsupported operation |
| 401 | Missing/invalid authentication |
| 403 | Authenticated but not authorized |
| 404 | Resource does not exist for the merchant |
| 409 | Conflict/idempotency/state conflict |
| 429 | Rate limit exceeded |
| 5xx | PayHarness/provider-side failure |

Clients should use bounded exponential backoff for transient 429/5xx failures and reconcile payment state after an ambiguous timeout rather than blindly creating a second payment.

## Idempotency

Use stable logical identifiers:

- Payment: `order-123-payment`
- Refund: `refund-order-123`
- Payout: `payout-123`

Never replace a failed network attempt's idempotency key with a new random key unless you intentionally mean to create a new operation.

## Webhooks

Configure a merchant webhook endpoint and verify every PayHarness delivery before applying business state changes.

Headers:

```http
X-PayHarness-Event: payment.succeeded
X-PayHarness-Signature: t=1720000000,v1=<64-character-hex>
```

Verification details are documented in `docs/webhook-signatures.md`.

A browser success redirect is not a payment confirmation. The receiving application should use the verified webhook/payment state as the authoritative asynchronous result.

## Supported providers

| Provider | Sandbox | Live | Refund | Query |
|---|---:|---:|---:|---:|
| M-Pesa | Yes | Yes | No | Yes |
| Stripe | Yes | Yes | Yes | Yes |
| PayPal | Yes | No | Yes | Yes |
| Pesapal | Yes | Yes | No | Yes |
| Flutterwave | Yes | Yes | No | Yes |

Provider availability can also be restricted by platform configuration and merchant country.

## Operational endpoints

- `GET /health` — liveness check.
- `GET /health/readiness` — API and database readiness.
- `GET /status` — public service status payload.

Swagger is available at `/docs` when enabled for the environment.

## Security requirements

- Use HTTPS in production.
- Keep live credentials server-side.
- Validate webhook signatures against the raw body.
- Reject stale webhook timestamps.
- Use constant-time signature comparison.
- Treat webhook events idempotently.
- Do not log authorization headers or provider secrets.
- Rotate compromised API keys and webhook secrets immediately.

## SDKs and integrations

Official SDKs are maintained in the monorepo for JavaScript/TypeScript, Go, PHP, and Python. WooCommerce and Joomla integration packages are also certified by CI.

See `docs/SDK_GUIDE.md` and `docs/PROVIDER_CERTIFICATION.md` for implementation and certification details.
