# PayHarness Node.js SDK

Official TypeScript/Node.js SDK for the PayHarness API.

## Install

The package is currently kept private in the monorepo while the API contract is stabilized. It is structured for a future npm release as `@payharness/sdk-js`.

## Usage

```ts
import { PayHarnessClient } from '@payharness/sdk-js';

const payharness = new PayHarnessClient({
  apiKey: process.env.PAYHARNESS_API_KEY!,
  baseUrl: process.env.PAYHARNESS_API_URL,
});

const payment = await payharness.payments.create(
  {
    amountCents: 1500,
    currency: 'KES',
    environment: 'SANDBOX',
    provider: 'MPESA',
    metadata: { orderId: 'order-123' },
  },
  'order-123',
);
```

## Resources

- `payments.create(input, idempotencyKey?)`
- `payments.get(paymentId)`
- `payments.query(paymentId)`
- `payments.refund(paymentId, input?, idempotencyKey?)`
- `refunds.create(paymentId, input?, idempotencyKey?)`
- `payouts.create(input, idempotencyKey)`
- `payouts.get(payoutId)`
- `payouts.list(query?)`
- `payouts.execute(payoutId)`

Every API request uses the configured server-side API key. Never expose a PayHarness API key in browser code.

## Webhook verification

PayHarness signs the raw request body with:

`HMAC_SHA256(SHA256(webhook_secret), `${timestamp}.${raw_body}`)`

The SDK provides constant-time verification with a five-minute replay tolerance:

```ts
import { verifyWebhookSignature } from '@payharness/sdk-js';

const valid = verifyWebhookSignature(
  process.env.PAYHARNESS_WEBHOOK_SECRET!,
  request.headers['x-payharness-signature'],
  rawBody,
);
```

Always verify the raw request body before parsing JSON.

## Errors

Failed HTTP responses throw `PayHarnessError`, exposing `status`, `requestId`, `code`, and the original response in `details`.

## Development

```bash
npm --workspace packages/sdk-js run build
npm --workspace packages/sdk-js test
npm --workspace packages/sdk-js run pack:check
```
