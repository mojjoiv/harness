# PayHarness for Joomla / VirtueMart

Phase 25 provides a Joomla payment integration for stores using VirtueMart. VirtueMart payment methods are backed by payment plugins, and the PayHarness plugin follows that model.

## Supported flow

- PayHarness API-key authentication.
- Sandbox/live environment selection.
- M-Pesa and PayPal provider selection.
- VirtueMart order → PayHarness payment mapping.
- Stable checkout idempotency using the VirtueMart order number.
- PayPal approval redirect when PayHarness returns an approval URL.
- M-Pesa asynchronous confirmation through a signed webhook.
- `payment.succeeded` → VirtueMart `C` (Confirmed).
- `payment.failed` → VirtueMart `X` (Cancelled).
- `payment.refunded` → VirtueMart `R` (Refunded).

## Installation

1. Install VirtueMart first.
2. Install the PayHarness payment plugin from `payharness.xml`.
3. Install and enable the PayHarness webhook system plugin from `payharnesswebhook.xml`.
4. In VirtueMart → Payment Methods, create a new PayHarness method and publish it.
5. Configure the PayHarness API URL, `ph_sandbox_...` or `ph_live_...` API key, environment, provider, and webhook secret.

Keep the API key server-side. Never place it in browser JavaScript.

## Webhook URL

The system plugin exposes:

```text
https://YOUR-JOOMLA-SITE.example/?payharness_webhook=1
```

Create a PayHarness webhook endpoint using that URL and subscribe to payment success, failure, and refund events.

The webhook verifies the raw request body with the Phase 21 signature format:

```text
HMAC_SHA256(SHA256(webhook_secret), `${timestamp}.${raw_body}`)
```

Signatures older than five minutes are rejected and `hash_equals()` is used for constant-time comparison.

## Order flow

VirtueMart creates the order first and invokes the payment plugin. The plugin creates a PayHarness payment using the order total and currency, stores the PayHarness payment ID in the order note, and redirects to an approval URL when one is supplied.

The webhook then transitions the order when PayHarness sends the final payment event.

## Refunds

The integration maps the PayHarness `payment.refunded` webhook to VirtueMart's Refunded (`R`) order status.

Provider-side refunds are initiated through PayHarness and synchronized back to VirtueMart by the signed webhook. The extension does not duplicate provider credentials or expose them to browser code.

## Files

```text
integrations/joomla/
├── payharness.xml
├── payharness.php
├── payharnesswebhook.xml
├── payharnesswebhook.php
├── pkg_payharness.xml
└── README.md
```
