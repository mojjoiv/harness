# PayHarness for Joomla / VirtueMart

The PayHarness Joomla integration provides a server-side payment plugin for stores using VirtueMart. VirtueMart payment methods are backed by payment plugins, and the PayHarness plugin follows that model.

## Supported flow

- PayHarness API-key authentication.
- Sandbox/live environment selection with API-key prefix enforcement.
- M-Pesa and PayPal provider selection.
- Live PayPal is rejected until the PayHarness provider is production-enabled.
- HTTPS-only PayHarness API transport.
- VirtueMart order → PayHarness payment mapping.
- Stable checkout idempotency using the VirtueMart order number.
- HTTPS-only PayPal approval redirects.
- M-Pesa asynchronous confirmation through a signed webhook.
- `payment.succeeded` → VirtueMart `C` (Confirmed).
- `payment.failed` → VirtueMart `X` (Cancelled), unless the order is already terminal/paid.
- `payment.refunded` → VirtueMart `R` (Refunded), unless the order is cancelled.
- Bounded per-order duplicate webhook protection.
- Event-header validation against the signed JSON payload.

VirtueMart's standard statuses include `P` Pending, `U` Confirmed by Shopper, `C` Confirmed, `R` Refunded, and `X` Cancelled.

## Installation

1. Install Joomla and VirtueMart.
2. Install the PayHarness Joomla package.
3. Enable the PayHarness VirtueMart payment plugin.
4. Enable the PayHarness webhook system plugin.
5. In VirtueMart → Payment Methods, create a PayHarness method and publish it.
6. Configure the PayHarness API URL, `ph_sandbox_...` or `ph_live_...` API key, environment, provider, and webhook secret.

Keep the API key and webhook secret server-side. Never place either value in browser JavaScript.

## Webhook URL

The system plugin exposes:

```text
https://YOUR-JOOMLA-SITE.example/?payharness_webhook=1
```

Create a PayHarness webhook endpoint using that URL and subscribe to payment success, failure, and refund events.

The webhook verifies the raw request body with the PayHarness signature format:

```text
HMAC_SHA256(SHA256(webhook_secret), `${timestamp}.${raw_body}`)
```

Signatures older than five minutes are rejected and `hash_equals()` is used for constant-time comparison. The `X-PayHarness-Event` header, when present, must match the signed payload event type.

## Order flow

VirtueMart creates the order before the payment plugin is invoked, so the order number is stable for payment idempotency.

The plugin creates a PayHarness payment using the fixed order total and currency, stores the PayHarness payment ID in the order note, and redirects only to an HTTPS approval URL when one is supplied.

The webhook then transitions the order when PayHarness sends a final payment event. Paid, refunded, shipped, completed, and cancelled states are protected from inappropriate late-event regression.

## Refunds

Provider-side refunds are initiated through PayHarness. The Joomla integration synchronizes a successful `payment.refunded` event back to VirtueMart as status `R`.

## Certification

Run from `payharness/`:

```bash
npm run verify:joomla
```

The certification verifies PHP syntax, environment isolation, HTTPS transport, stable idempotency, webhook event validation, duplicate protection, terminal-state handling, package metadata, and real PHP HMAC/replay-window verification.

The broader integration certification is also run with:

```bash
npm run verify:integrations
```

## Files

```text
integrations/joomla/
├── payharness.xml
├── payharness.php
├── payharnesswebhook.xml
├── payharnesswebhook.php
├── payharnesswebhookhelper.php
├── pkg_payharness.xml
└── README.md
```
