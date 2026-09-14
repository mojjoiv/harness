# PayHarness webhook signatures

PayHarness signs merchant webhook deliveries with HMAC-SHA256.

## Headers

Every signed delivery includes:

```text
Content-Type: application/json
X-PayHarness-Event: payment.succeeded
X-PayHarness-Signature: t=1720000000,v1=<64-char-hex-signature>
```

The signature is calculated over the exact raw JSON request body, prefixed by the Unix timestamp:

```text
HMAC_SHA256(SHA256(webhook_secret), `${timestamp}.${raw_body}`)
```

The stored database value is the SHA-256 digest of the merchant's webhook secret, so the plaintext secret is never stored.

## Verification

1. Read the raw request body without parsing and re-serializing JSON.
2. Parse `t` and `v1` from `X-PayHarness-Signature`.
3. Reject the request when the timestamp is more than **300 seconds** away from the current Unix time.
4. Compute `SHA256(webhook_secret)`.
5. Compute `HMAC-SHA256(signing_key, `${timestamp}.${raw_body}`)`.
6. Compare the received and expected signatures using a constant-time comparison.
7. Only process the webhook after signature and timestamp verification succeed.
8. Treat the event as idempotent using the PayHarness event/payment identifier before applying business changes.

The timestamp check prevents an intercepted signed request from being replayed indefinitely. Merchants should still use their own event-idempotency store when processing webhooks.

## Secret rotation

Webhook secrets are displayed only when an endpoint is created or its secret is rotated. Store the secret securely on the merchant server. Rotating a secret invalidates signatures generated with the previous secret for subsequent deliveries.

Use the PayHarness dashboard's **Rotate secret** action when a secret may have been exposed. The new secret must be deployed to the receiving application before testing deliveries against the rotated endpoint.

## Example verification

```ts
import { verifyWebhookSignatureHeader } from '@payharness/api/webhook-signature';

const valid = verifyWebhookSignatureHeader(
  process.env.PAYHARNESS_WEBHOOK_SECRET!,
  request.headers.get('x-payharness-signature') ?? '',
  rawBody,
);

if (!valid) {
  return new Response('Invalid webhook signature', { status: 401 });
}
```

For production integrations, never log the webhook secret, signing key, or complete authorization/signature header.
