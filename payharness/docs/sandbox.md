# PayHarness Developer Sandbox

The PayHarness sandbox lets server-to-server integrations exercise payment creation, status queries, refunds, idempotency, and webhook delivery without sending money to a live provider.

Use a `ph_sandbox_...` API key. Sandbox requests are locked to `SANDBOX` by API-key authentication.

## Endpoints

- `POST /sandbox/payments` — create a deterministic sandbox payment.
- `GET /sandbox/status` — verify sandbox credentials.
- `GET /payments/:id` — retrieve a sandbox payment.
- `GET /payments/:id/query` — query stored sandbox state without contacting a provider.
- `POST /payments/:id/refund` — refund a succeeded sandbox payment without calling Stripe, PayPal, or M-Pesa.

The normal `/payments` endpoint also accepts sandbox API keys. The dedicated `/sandbox/payments` endpoint makes the integration boundary explicit.

## Create a test payment

```http
POST /sandbox/payments
Authorization: Bearer ph_sandbox_...
Content-Type: application/json
```

```json
{
  "amountCents": 1500,
  "currency": "KES",
  "provider": "STRIPE",
  "simulateOutcome": "SUCCEEDED",
  "metadata": { "orderReference": "ORDER-1001" }
}
```

Supported providers: `MPESA`, `STRIPE`, `PAYPAL`.

Supported outcomes: `SUCCEEDED`, `FAILED`. If omitted, the sandbox defaults to `SUCCEEDED`.

Sandbox provider references are synthetic and are never sent to a live provider.

## Idempotency

Send the same request with the same `Idempotency-Key` to verify that retries return the original result instead of creating another payment. Keep an application order/reference in `metadata` as well.

## Refunds

Create a `SUCCEEDED` sandbox payment, then call:

```http
POST /payments/{paymentId}/refund
Authorization: Bearer ph_sandbox_...
Idempotency-Key: refund-order-1001
Content-Type: application/json
```

```json
{ "amountCents": 500 }
```

Partial refunds can be repeated until the original amount is exhausted. Reusing the same refund idempotency key is safe.

## Webhooks and retries

Sandbox state transitions emit the same payment event types as the normal payment flow when webhook forwarding is configured. Delivery uses the signed webhook format and existing retry policy. Payloads identify `environment: SANDBOX` so test consumers can isolate them from production processing.

## Safety boundary

A sandbox API key cannot execute a live provider operation. API-key authentication locks requests to the environment encoded in the key. Sandbox payment creation never requires a live provider credential and never calls a live provider API.

Keep sandbox keys server-side; they are still credentials and should not be embedded in browser code.
