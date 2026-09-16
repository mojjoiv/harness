# PayHarness Developer Portal

This is the integration starting point for merchants building against PayHarness.

## Start here

1. Create or obtain a merchant API key from the PayHarness dashboard.
2. Use a `ph_sandbox_...` key while developing.
3. Keep the key on your trusted backend and send it as `Authorization: Bearer <key>`.
4. Create a payment and persist the returned PayHarness payment ID beside your order ID.
5. Verify signed webhooks and make webhook processing idempotent.
6. Move to a `ph_live_...` key only after the sandbox integration is verified.

### Core references

- [Public API](./public-api.md) — integration contract and endpoint examples.
- [Sandbox](./sandbox.md) — test environment and payment flow.
- [Webhook signatures](./webhook-signatures.md) — signature verification and replay protection.
- [Payment idempotency](./PAYMENT_IDEMPOTENCY.md) — safe retry behavior.
- [API reference](./api.md) — API endpoint overview.

## Environment model

PayHarness API keys are environment-bound. Sandbox keys must not be used for live resources, and live keys must not be used for sandbox resources.

| Environment | Key prefix | Intended use |
|---|---|---|
| Sandbox | `ph_sandbox_` | Development, automated tests, certification |
| Live | `ph_live_` | Production merchant traffic |

Keep the API base URL configurable in every application and SDK integration. Never embed environment credentials in frontend code.

## SDK ecosystem

PayHarness maintains official SDK packages for the most common server-side integration languages:

| SDK | Package path | Status | Primary distribution target |
|---|---|---|---|
| Node.js / TypeScript | `packages/sdk-js` | Publish-ready | npm |
| PHP | `packages/sdk-php` | Publish-ready | Composer / Packagist |
| Python | `packages/sdk-python` | Publish-ready | PyPI |
| Go | `packages/sdk-go` | Publish-ready | Go modules |

The SDKs are intentionally server-side. They cover the common payment, refund, payout, and webhook-signature workflows while preserving access to the HTTP API for provider-specific functionality.

Before publishing a release, keep the SDK version aligned with the supported PayHarness API contract and run the repository's SDK validation checks.

## Language quickstarts

### Node.js / TypeScript

```ts
import { PayHarnessClient } from '@payharness/sdk-js';

const client = new PayHarnessClient({
  apiKey: process.env.PAYHARNESS_API_KEY!,
  baseUrl: process.env.PAYHARNESS_API_URL,
});

const payment = await client.payments.create(
  {
    amountCents: 2500,
    currency: 'KES',
    provider: 'MPESA',
    environment: 'SANDBOX',
    metadata: { orderId: 'order-1001' },
  },
  'order-1001',
);

console.log(payment.id);
```

### PHP

```php
$client = new PayHarness\Client($_ENV['PAYHARNESS_API_KEY']);

$payment = $client->createPayment([
    'amountCents' => 2500,
    'currency' => 'KES',
    'provider' => 'MPESA',
    'reference' => 'order-1001',
], 'order-1001');
```

### Python

```python
from payharness import PayHarnessClient

client = PayHarnessClient("ph_sandbox_...")
payment = client.create_payment(
    {
        "amountCents": 2500,
        "currency": "KES",
        "provider": "MPESA",
        "reference": "order-1001",
    },
    idempotency_key="order-1001",
)
```

### Go

```go
client := payharness.NewClient("ph_sandbox_...")

payment, err := client.CreatePayment(map[string]any{
    "amountCents": 2500,
    "currency": "KES",
    "provider": "MPESA",
    "reference": "order-1001",
}, &payharness.RequestOptions{IdempotencyKey: "order-1001"})
if err != nil {
    // Handle the API error before acknowledging the order.
}
```

## Payment integration pattern

A production integration should follow this lifecycle:

```text
Your checkout
    |
    v
Your backend
    |
    | POST /payments + stable idempotency identity
    v
PayHarness
    |
    +--> provider
    |
    v
Payment state
    |
    v
Signed webhook
    |
    v
Your webhook endpoint
    |
    +--> verify signature
    +--> enforce event idempotency
    +--> update order transactionally
```

The customer's browser redirect is not the authoritative payment confirmation. Use PayHarness payment state and verified webhooks for asynchronous completion.

## Webhook requirements

Every merchant webhook endpoint should:

- preserve the exact raw request body;
- verify `X-PayHarness-Signature` before parsing or applying business changes;
- reject stale timestamps;
- use constant-time signature comparison;
- deduplicate webhook events;
- persist the PayHarness payment/event identifiers;
- return success only after the event is safely accepted.

See [Webhook signatures](./webhook-signatures.md) for the exact signing algorithm.

## Retry and idempotency

Use a stable idempotency identity for retries of the same logical operation. A network timeout does not prove that a payment was not created.

For payment creation, refund, and payout workflows:

1. keep your own order/reference ID;
2. reuse the same idempotency identity for a retry of the same logical operation;
3. never generate a new random key for each retry;
4. persist the PayHarness resource ID when returned;
5. query or reconcile when the final outcome is unknown.

The PayHarness payment UUID is the canonical payment resource identifier; an idempotency key is not a payment ID.

## API keys and secrets

API keys are shown as one-time secrets when created or rotated. Store them immediately in your server-side secret store.

Never:

- put API keys in browser JavaScript;
- ship keys in mobile application bundles;
- commit keys to Git;
- place live keys in public CI logs;
- log `Authorization` headers;
- share webhook secrets with frontend applications.

Rotate a compromised key immediately and update the affected deployment without exposing the replacement secret.

## Certification readiness

Before requesting production access, an integration should demonstrate:

- successful sandbox payment creation;
- safe retry/idempotency behavior;
- payment retrieval and controlled provider querying;
- signed webhook verification;
- webhook event deduplication;
- refund handling where supported;
- environment isolation;
- secure API-key storage;
- correct handling of non-2xx responses and unknown outcomes.

WooCommerce and Joomla/VirtueMart integrations should additionally follow their platform-specific certification checks in `integrations/`.
