# PayHarness Public API

Version: `0.1.0`

This guide describes the server-to-server API contract for integrating PayHarness with ecommerce stores, websites, mobile backends, and custom applications.

## 1. Integration model

```text
Customer
  |
  v
Your application / ecommerce platform
  |  Authorization: Bearer ph_live_...
  v
PayHarness API
  |
  +--> M-Pesa
  +--> Stripe
  +--> PayPal

PayHarness webhook
  |
  v
Your application -> verify signature -> update order/payment state
```

Your server creates the payment with PayHarness. Your server should persist the PayHarness payment ID and use signed webhooks as the source of truth for asynchronous payment state changes.

## 2. Authentication

Merchant integrations authenticate with a PayHarness API key using the HTTP `Authorization` header:

```http
Authorization: Bearer ph_live_...
```

Sandbox/test keys use the `ph_sandbox_...` prefix. Live keys use `ph_live_...`.

API keys are environment-bound and must be stored server-side. Never expose a live API key in browser JavaScript, mobile application bundles, public repositories, or frontend environment variables.

Dashboard JWT authentication remains available for dashboard/admin workflows; API keys are intended for merchant server-to-server integrations.

## 3. Base URL

Use the PayHarness API base URL supplied for your environment. Do not hard-code a provider URL into an integration; keep the base URL configurable so sandbox and production can be switched independently.

## 4. Response envelope

Successful API responses use a common envelope:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "apiVersion": "0.1.0",
    "requestId": "request-id"
  },
  "timestamp": "2026-09-14T00:00:00.000Z"
}
```

Paginated responses retain their pagination metadata alongside the API version and request ID.

Always log the PayHarness `requestId` when an integration reports an unexpected response. It is useful when correlating support and operational investigations.

## 5. Create a payment

Create a payment from your server and associate it with your application's order/reference using metadata.

```http
POST /payments
Authorization: Bearer ph_live_...
Content-Type: application/json
Idempotency-Key: order-123-payment
```

Example request:

```json
{
  "amountCents": 10000,
  "currency": "KES",
  "provider": "MPESA",
  "metadata": {
    "orderId": "order-123",
    "source": "woocommerce"
  }
}
```

The exact provider-specific fields depend on the selected payment provider. Keep your store's order identifier in `metadata` so webhook processing can map a PayHarness payment back to the originating order.

### Idempotency

For retryable payment creation requests, send an `Idempotency-Key` when your integration can provide a stable request identity. Do not generate a new random key for every retry of the same logical payment.

The payment resource ID returned by PayHarness is the canonical internal payment identifier. Do not treat the incoming idempotency key as the payment ID.

## 6. Retrieve a payment

```http
GET /payments/:id
Authorization: Bearer ph_live_...
```

Use this endpoint to retrieve the current PayHarness payment resource after creation or when displaying payment status in an authenticated server-side workflow.

## 7. Query provider status

For payments that are still pending, use the payment query endpoint to request a provider status refresh:

```http
GET /payments/:id/query
Authorization: Bearer ph_live_...
```

Do not poll aggressively. Prefer signed webhooks for asynchronous state changes and use querying as a controlled reconciliation/fallback mechanism.

## 8. Refunds

Refund a payment through the unified refund API:

```http
POST /payments/:id/refund
Authorization: Bearer ph_live_...
Content-Type: application/json
Idempotency-Key: refund-order-123
```

For a full refund, omit the amount when the API contract for the selected payment supports the default full-refund behavior. For a partial refund, provide the supported refund amount in cents.

Example partial refund:

```json
{
  "amountCents": 2500,
  "reason": "Customer return"
}
```

A refund should be tied to the originating payment ID. Persist the returned refund information in your application's order/payment records.

## 9. Payouts

Merchant payouts use the unified payout resource:

```http
GET /payouts
Authorization: Bearer ph_live_...
```

Create a payout:

```http
POST /payouts
Authorization: Bearer ph_live_...
Content-Type: application/json
Idempotency-Key: payout-123
```

Execute a created payout when the integration workflow requires an explicit execution step:

```http
POST /payouts/:id/execute
Authorization: Bearer ph_live_...
```

Use the payout ID returned by PayHarness as the canonical resource identifier and rely on payout status/webhook or reconciliation workflows for final state.

## 10. Webhooks

Configure a merchant webhook endpoint in PayHarness. Signed deliveries include:

```http
Content-Type: application/json
X-PayHarness-Event: payment.succeeded
X-PayHarness-Signature: t=1720000000,v1=<64-character-hex-signature>
```

The signature is calculated from the exact raw request body:

```text
HMAC_SHA256(SHA256(webhook_secret), `${timestamp}.${raw_body}`)
```

The timestamp must be within 300 seconds of the receiving server's current Unix time. Verify the signature before parsing or applying business changes. Use the webhook signature guide for the complete verification procedure:

`docs/webhook-signatures.md`

### Webhook processing sequence

1. Receive the request and preserve the raw body.
2. Read `X-PayHarness-Signature` and `X-PayHarness-Event`.
3. Verify the timestamp and HMAC signature.
4. Reject invalid or stale signatures.
5. Apply event-level idempotency in your application.
6. Map the event/payment identifier to your internal order.
7. Update the order/payment state transactionally.
8. Return a successful HTTP response after the event has been safely accepted.

Do not mark an order as paid solely because the customer's browser returned to a success URL. The server-side payment state and verified webhook are authoritative.

## 11. Errors

Treat non-2xx responses as API failures and inspect the HTTP status and response body. Do not assume that a network timeout means the payment was never created.

For payment creation failures:

1. Preserve your stable order/reference ID.
2. Retry with the same logical idempotency identity when the operation is safe to retry.
3. Query/reconcile the payment when the outcome is unknown.
4. Store PayHarness request/payment IDs for support and reconciliation.

Never retry a request with a new random idempotency key simply because the first network attempt timed out.

## 12. Ecommerce integration example

A generic ecommerce checkout should follow this sequence:

```text
1. Customer clicks Pay
       |
       v
2. Store backend creates PayHarness payment
       |
       +--> save payment ID + order ID
       |
       v
3. Customer completes provider payment
       |
       v
4. PayHarness processes provider result
       |
       v
5. PayHarness sends signed webhook
       |
       v
6. Store verifies signature
       |
       v
7. Store checks event idempotency
       |
       v
8. Store marks order paid / failed / pending
```

For WooCommerce, the same model belongs inside a payment gateway plugin: the plugin keeps the PayHarness API key server-side, creates the payment from the order, maps the PayHarness payment ID to the WooCommerce order, and uses the verified webhook to finalize the order state.

The same API contract can be implemented by Joomla extensions or custom Node.js, PHP, Python, and Go applications without changing the payment lifecycle.

## 13. Security checklist

- Use `ph_sandbox_...` keys for testing and `ph_live_...` only in production.
- Keep API keys exclusively on trusted servers.
- Never commit API keys or webhook secrets to source control.
- Use HTTPS for all production integrations.
- Preserve raw webhook bodies for signature verification.
- Reject stale webhook timestamps.
- Use constant-time signature comparison.
- Implement webhook event idempotency.
- Use stable idempotency identities for payment/refund/payout retries.
- Store PayHarness resource IDs alongside your own order/payment IDs.
- Rotate compromised API keys and webhook secrets immediately.
- Do not log authorization headers, API keys, or webhook secrets.

## 14. Interactive API reference

PayHarness also exposes its NestJS/Swagger API reference in the running API service. Use Swagger for the exact request/response schemas and provider-specific fields available in the deployed version.

This document is the integration-oriented contract and examples; Swagger remains the source for generated endpoint schemas.
