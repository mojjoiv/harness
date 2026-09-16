# PayHarness for WooCommerce

PayHarness provides a native WooCommerce payment gateway that sends server-to-server payment requests to PayHarness and keeps WooCommerce order state synchronized through signed webhooks.

## Included

- PayHarness API-key configuration.
- Sandbox/live environment selection with environment-matched API-key validation.
- M-Pesa and PayPal provider selection.
- WooCommerce order → PayHarness payment mapping.
- Stable payment idempotency for checkout creation and WooCommerce refund retries.
- PayPal approval redirect support over HTTPS only.
- M-Pesa asynchronous payment confirmation through PayHarness webhooks.
- WooCommerce refunds routed through `POST /payments/:id/refund` with the WooCommerce refund reason when supplied.
- HTTPS-only PayHarness API transport.
- Signed webhook verification with the PayHarness Phase 21 format.
- Webhook event-header/payload consistency validation.
- Duplicate webhook protection using a bounded per-order event fingerprint history.
- Automatic order transitions for `payment.succeeded`, `payment.failed`, and `payment.refunded`.

## Installation

1. Copy `integrations/woocommerce` into `wp-content/plugins/payharness`.
2. Activate **PayHarness for WooCommerce** from WordPress plugins.
3. Open WooCommerce → Settings → Payments → PayHarness.
4. Configure the PayHarness API URL and API key.
5. Select Sandbox or Live.
6. Select M-Pesa or PayPal.
7. Save settings.

For production, use a `ph_live_...` API key and keep it server-side in WordPress. Never put a PayHarness API key into browser JavaScript.

The plugin rejects an API key whose environment prefix does not match the configured environment and rejects non-HTTPS PayHarness API URLs.

## Webhook configuration

The plugin exposes:

```text
https://YOUR-WORDPRESS-SITE.example/wp-json/payharness/v1/webhook
```

Create a webhook endpoint for that URL in the PayHarness dashboard. Subscribe to payment success, failure, and refund events, then paste the returned `whsec_...` secret into the WooCommerce gateway settings.

PayHarness signs the raw JSON body with:

```text
HMAC_SHA256(SHA256(webhook_secret), `${timestamp}.${raw_body}`)
```

The plugin rejects malformed signatures and timestamps older than five minutes, uses constant-time comparison with `hash_equals`, and checks that `X-PayHarness-Event` matches the event type in the signed payload when the header is present.

Repeated delivery of the same signed event is treated as an idempotent duplicate and does not re-apply the WooCommerce state transition.

## Payment flow

### PayPal

WooCommerce creates a PayHarness payment. PayHarness returns the PayPal approval URL, and WooCommerce redirects the shopper there. Only HTTPS approval/redirect URLs are accepted. PayHarness webhook confirmation completes the WooCommerce order.

### M-Pesa

WooCommerce creates a PayHarness payment and leaves the order on hold while PayHarness processes the provider interaction. A signed `payment.succeeded` or `payment.failed` webhook updates the WooCommerce order automatically.

### Stripe

Stripe is intentionally not enabled in this first WooCommerce gateway release because the current PayHarness API exposes a PaymentIntent client secret rather than a PayHarness-hosted checkout URL. Stripe support should be enabled only after the hosted/client-side checkout contract is added rather than asking merchants to duplicate Stripe credentials in WordPress.

## Refunds

WooCommerce refunds call the PayHarness refund endpoint using the order's stored PayHarness payment ID. Partial refunds pass `amountCents`; full refunds omit the amount. The gateway uses a deterministic idempotency key derived from the WooCommerce order, refund sequence, and amount so a retry of the same WooCommerce refund can safely reuse the PayHarness request identity.

## Stored order metadata

The plugin stores:

- `_payharness_payment_id`
- `_payharness_provider`
- `_payharness_environment`
- `_payharness_processed_webhook_events`

These values are server-side WooCommerce order metadata and are not exposed as payment credentials.

## Certification

Run from `payharness/`:

```bash
npm run verify:woocommerce
```

The certification checks the gateway's API-key/environment isolation, HTTPS requirements, stable checkout/refund idempotency, webhook event handling, duplicate-event protection, and refund contract. It also executes the real PHP webhook signature verifier against a known-good signature and verifies that a signature outside the five-minute replay window is rejected.

The normal CI pipeline also validates PHP syntax and the broader PayHarness integration contracts.

## Package layout

```text
payharness/
├── payharness.php
├── includes/
│   ├── class-payharness-api.php
│   ├── class-payharness-webhook.php
│   └── class-wc-gateway-payharness.php
└── README.md
```
