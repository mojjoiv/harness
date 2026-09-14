# PayHarness for WooCommerce

PayHarness provides a native WooCommerce payment gateway that sends server-to-server payment requests to PayHarness and keeps WooCommerce order state synchronized through signed webhooks.

## Included

- PayHarness API-key configuration.
- Sandbox/live environment selection.
- M-Pesa and PayPal provider selection.
- WooCommerce order → PayHarness payment mapping.
- Stable payment idempotency for checkout creation.
- PayPal approval redirect support.
- M-Pesa asynchronous payment confirmation through PayHarness webhooks.
- WooCommerce refunds routed through `POST /payments/:id/refund`.
- Signed webhook verification with the PayHarness Phase 21 format.
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

The plugin rejects malformed signatures and timestamps older than five minutes, and uses constant-time comparison with `hash_equals`.

## Payment flow

### PayPal

WooCommerce creates a PayHarness payment. PayHarness returns the PayPal approval URL, and WooCommerce redirects the shopper there. PayHarness webhook confirmation completes the WooCommerce order.

### M-Pesa

WooCommerce creates a PayHarness payment and leaves the order on hold while PayHarness processes the provider interaction. A signed `payment.succeeded` or `payment.failed` webhook updates the WooCommerce order automatically.

### Stripe

Stripe is intentionally not enabled in this first WooCommerce gateway release because the current PayHarness API exposes a PaymentIntent client secret rather than a PayHarness-hosted checkout URL. Stripe support should be enabled only after the hosted/client-side checkout contract is added rather than asking merchants to duplicate Stripe credentials in WordPress.

## Refunds

WooCommerce refunds call the PayHarness refund endpoint using the order's stored PayHarness payment ID. Partial refunds pass `amountCents`; full refunds omit the amount.

## Stored order metadata

The plugin stores:

- `_payharness_payment_id`
- `_payharness_provider`
- `_payharness_environment`

These values are server-side WooCommerce order metadata and are not exposed as payment credentials.

## Package layout

```text
payharness/
├── payharness.php
├── includes/
│   ├── class-payharness-api.php
│   └── class-wc-gateway-payharness.php
└── README.md
```
