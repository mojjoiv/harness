# Stripe Sandbox E2E smoke test

This script intentionally does not contain Stripe or PayHarness credentials.

## Run

From `payharness/apps/api`:

```bash
PAYHARNESS_BASE_URL=https://harness-m6qs.onrender.com \
PAYHARNESS_API_KEY='<your SANDBOX PayHarness API key>' \
node scripts/stripe-e2e-smoke.mjs
```

The script creates a Stripe SANDBOX PaymentIntent through PayHarness and prints the
`paymentId`, Stripe `providerReference`, and client-secret presence. It does not
confirm the payment because confirmation should use Stripe's Sandbox APIs and a
test PaymentMethod without putting Stripe credentials in this repository.

After creation, confirm the PaymentIntent using Stripe Sandbox tooling with a
Stripe test PaymentMethod such as `pm_card_visa`, then poll:

```text
GET /payments/:paymentId/query
```

A successful end-to-end result should ultimately report `SUCCEEDED` in PayHarness.
